package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.postharvest.EnergyComparison;
import ro.greenstruct.agro.engine.postharvest.PostHarvestCalculator;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Cold stores, dryers and greenhouses: energy saving per tonne (or m²) against today's consumption from the
 * invoices, plus the refrigerant check for DNSH pollution prevention (README §6, category 5).
 */
@Component
public class PostHarvestModule implements ModuleCalculator {

    /** Components whose data sheet carries the specific consumption and the refrigerant of the new equipment. */
    private static final Set<String> EQUIPMENT = Set.of("REFRIGERATION_UNIT", "DRYER", "GREENHOUSE_SCREEN",
            "HEAT_RECOVERY");

    @Override
    public String id() {
        return "postharvest";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        String activity = context.questionnaire().path("activity").asText("");
        JsonNode unitByActivity = context.module().parameters().path("unitByActivity").path("value");
        if (!unitByActivity.has(activity)) {
            List<String> known = new ArrayList<>();
            unitByActivity.fieldNames().forEachRemaining(known::add);
            throw new IllegalArgumentException("Unknown activity '" + activity + "'; values: " + known);
        }
        boolean perM2 = "M2".equals(unitByActivity.path(activity).asText());
        BigDecimal quantity = context.questionnaire().path("quantity").decimalValue();
        if (quantity.signum() <= 0) {
            throw new IllegalArgumentException("The answer 'quantity' is missing (tonnes per year or m² of greenhouse)");
        }
        BigDecimal electricity = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"))
                .orElseThrow(() -> new IllegalArgumentException("Extract the 12-month energy invoices first"));
        BigDecimal gas = context.questionnaire().path("gas_kwh_year").decimalValue();
        Optional<BigDecimal> months = context.questionnaire().path("operating_months").isNumber()
                ? Optional.of(context.questionnaire().path("operating_months").decimalValue()) : Optional.empty();
        BigDecimal specific = PostHarvestCalculator.specificConsumption(electricity.add(gas), quantity);
        BigDecimal co2 = PostHarvestCalculator.co2Tonnes(electricity, RuleValues.factor(context, "gridKgCo2PerKwh"), gas,
                RuleValues.factor(context, "gasKgCo2PerKwh"));

        Calc quantityCalc = context.calc("baseline.quantity", perM2 ? "Greenhouse area" : "Produce stored per year",
                quantity, perM2 ? Unit.M2 : Unit.T).source("questionnaire").add();
        Calc electricityCalc = context.calc("baseline.energy", "Electricity used today", electricity,
                Unit.KWH_PER_YEAR).formula("from the 12-month energy invoices").add();
        Calc gasCalc = null;
        if (gas.signum() > 0) {
            gasCalc = context.calc("baseline.gas", "Gas used today", gas, Unit.KWH_PER_YEAR).formula("questionnaire").add();
        }
        List<Calc> inputs = new ArrayList<>(List.of(quantityCalc, electricityCalc));
        if (gasCalc != null) {
            inputs.add(gasCalc);
        }
        Calc specificCalc = context.calc("baseline.specific", "Consumption per unit today", specific,
                perM2 ? Unit.KWH_PER_M2 : Unit.KWH_PER_T).formula("(electricity kWh + gas kWh) per year / " + (perM2 ? "m²" : "tonnes"))
                .dependsOn(inputs.toArray(Calc[]::new)).add();
        context.calc("baseline.co2", "CO₂ from energy today", co2, Unit.T_CO2_PER_YEAR)
                .formula("electricity MWh × grid factor + gas MWh × gas factor").dependsOn(electricityCalc).add();
        months.ifPresent(m -> context.calc("baseline.months", "Operating months per year", m, Unit.MONTHS)
                .source("questionnaire").add());

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("quantity", quantity);
        baseline.put("electricity_kwh", electricity);
        baseline.put("gas_kwh", gas);
        baseline.put("specific", specific);
        baseline.put("co2_t", co2);
        baseline.put("per_m2", perM2 ? BigDecimal.ONE : BigDecimal.ZERO);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", "INVOICES");
        result.put("activity", activity);
        result.put("unit", perM2 ? "M2" : "T");
        List<String> warnings = new ArrayList<>();
        if (months.isEmpty()) {
            warnings.add("We do not know how many months a year the facility operates");
        }
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Current situation: " + specificCalc.display());
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal quantity = baseline.get("quantity");
        BigDecimal oldElectricity = baseline.get("electricity_kwh");
        BigDecimal oldGas = baseline.get("gas_kwh");

        boolean natural = components.stream().anyMatch(c -> positive(c.attribute("naturalRefrigerant")));
        Optional<BigDecimal> offered = min(components, "specificKwhPerUnit");
        Optional<BigDecimal> bundle = natural ? min(components, "specificKwhPerUnitWithNaturalRefrigerant")
                : Optional.empty();
        BigDecimal newElectricity = offered.orElse(oldElectricity.divide(quantity, MC));
        if (bundle.isPresent()) {
            newElectricity = newElectricity.min(bundle.get());
        }
        BigDecimal newGas = min(components, "specificGasKwhPerUnit").orElse(oldGas.divide(quantity, MC));
        EnergyComparison comparison = PostHarvestCalculator.compare(oldElectricity, oldGas, newElectricity, newGas, quantity);

        BigDecimal gridFactor = RuleValues.factor(context, "gridKgCo2PerKwh");
        BigDecimal gasFactor = RuleValues.factor(context, "gasKgCo2PerKwh");
        Map<String, BigDecimal> m = new HashMap<>();
        m.put("indicator_pct", comparison.savingPct());
        m.put("specific_old", comparison.oldSpecific());
        m.put("specific_new", comparison.newSpecific());
        m.put("electricity_saved_kwh", comparison.savedElectricityKwh());
        m.put("gas_saved_kwh", comparison.savedGasKwh());
        m.put("energy_saved_kwh", comparison.savedElectricityKwh().add(comparison.savedGasKwh()));
        m.put("co2_avoided_t", PostHarvestCalculator.co2Tonnes(comparison.savedElectricityKwh(), gridFactor,
                comparison.savedGasKwh(), gasFactor));
        m.put("savings_electricity_eur", PostHarvestCalculator.savingEur(comparison.savedElectricityKwh(),
                RuleValues.price(context, "electricityEurPerKwh")));
        m.put("savings_gas_eur", PostHarvestCalculator.savingEur(comparison.savedGasKwh(), context.param("gasEurPerKwh")));
        min(components, "refrigerantGwp").ifPresent(gwp -> {
            m.put("refrigerant_gwp", gwp);
            m.put("refrigerant_ok", PostHarvestCalculator.refrigerantOk(gwp, context.param("maxRefrigerantGwp"))
                    ? BigDecimal.ONE : BigDecimal.ZERO);
        });
        return m;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        boolean perM2 = context.workspace().baseline().get("per_m2").signum() > 0;
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "energy_saving_pct", "Energy saving", cfg.metric("indicator_pct"), Unit.PCT)
                .formula("1 − new I / old I").add());
        calcs.add(context.calc(p + "specific_new", "Consumption per unit after the investment", cfg.metric("specific_new"),
                perM2 ? Unit.KWH_PER_M2 : Unit.KWH_PER_T)
                .formula("from the technical data sheet (specific consumption); with a natural refrigerant, the panels bring the catalog consumption")
                .add());
        calcs.add(context.calc(p + "energy_saved", "Energy saved per year", cfg.metric("energy_saved_kwh"),
                Unit.KWH_PER_YEAR).formula("(old I − new I) × tonnes or m²").add());
        calcs.add(context.calc(p + "electricity_saved", "Electricity saved per year",
                cfg.metric("electricity_saved_kwh"), Unit.KWH_PER_YEAR).add());
        if (cfg.metricOrZero("gas_saved_kwh").signum() != 0) {
            calcs.add(context.calc(p + "gas_saved", "Gas saved per year", cfg.metric("gas_saved_kwh"),
                    Unit.KWH_PER_YEAR).add());
        }
        if (cfg.metrics().containsKey("refrigerant_gwp")) {
            calcs.add(context.calc(p + "refrigerant_gwp", "Refrigerant GWP", cfg.metric("refrigerant_gwp"),
                    Unit.COUNT).source(context.paramSource("maxRefrigerantGwp")).add());
        }
        calcs.add(context.calc(p + "savings_electricity", "Electricity saving per year", cfg.metric("savings_electricity_eur"),
                Unit.EUR_PER_YEAR).formula("electricity kWh saved × price").add());
        calcs.add(context.calc(p + "savings_gas", "Gas saving per year", cfg.metric("savings_gas_eur"),
                Unit.EUR_PER_YEAR).formula("gas kWh saved × price").add());
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("energy_saved", "ENERGY_SAVED_KWH", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.co2", "CO2_EMITTED_T");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_electricity_eur", "electricity_eur", "savings_gas_eur", "gas_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
        context.calc("rules.threshold.energy_saving", "Green threshold: energy saving",
                RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
        context.calc("rules.dnsh.max_refrigerant_gwp", "Maximum refrigerant GWP",
                context.param("maxRefrigerantGwp"), Unit.COUNT).source(context.paramSource("maxRefrigerantGwp")).add();
        context.calc("rules.price.electricity", "Electricity price", RuleValues.price(context, "electricityEurPerKwh"),
                Unit.EUR_PER_KWH).source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
        context.calc("rules.price.gas", "Gas price", context.param("gasEurPerKwh"), Unit.EUR_PER_KWH)
                .source(context.paramSource("gasEurPerKwh")).add();
        context.calc("rules.factor.grid", "Grid emission factor", RuleValues.factor(context, "gridKgCo2PerKwh"),
                Unit.KG_CO2_PER_KWH).source(RuleValues.factorSource(context, "gridKgCo2PerKwh")).add();
        context.calc("rules.factor.gas", "Gas emission factor", RuleValues.factor(context, "gasKgCo2PerKwh"),
                Unit.KG_CO2_PER_KWH).source(RuleValues.factorSource(context, "gasKgCo2PerKwh")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
        BigDecimal max = context.param("maxRefrigerantGwp");
        result.put("maxRefrigerantGwp", max);
        if (cfg.metrics().containsKey("refrigerant_gwp")) {
            result.put("refrigerantGwp", cfg.metric("refrigerant_gwp"));
            result.put("refrigerantLowGwp", cfg.metric("refrigerant_ok").signum() > 0);
        } else {
            result.put("refrigerantLowGwp", true);
            result.put("refrigerantNote", "The configuration contains no equipment with a refrigerant");
        }
        result.put("naturalRefrigerant", cfg.components().stream().anyMatch(c -> positive(c.attribute("naturalRefrigerant"))));
        context.workspace().documentOfType("OFFER").map(offer -> offer.texts().get("REFRIGERANT_TYPE"))
                .ifPresent(type -> result.put("offeredRefrigerant", type));
        result.put("oldEquipmentDocument", context.workspace().documentOfType("CURRENT_EQUIPMENT").isPresent());
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
        context.calc("impact.energy_horizon", "Energy saved over the horizon",
                cfg.metric("energy_saved_kwh").multiply(years, MC), Unit.KWH).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        if (!EQUIPMENT.contains(line.category())) {
            return;
        }
        put(attributes, "specificKwhPerUnit", line, offer, "SPECIFIC_CONSUMPTION_KWH_PER_UNIT");
        put(attributes, "specificGasKwhPerUnit", line, offer, "SPECIFIC_GAS_CONSUMPTION_KWH_PER_UNIT");
        put(attributes, "refrigerantGwp", line, offer, "REFRIGERANT_GWP");
    }

    private static void put(Map<String, BigDecimal> attributes, String name, DocumentFacts.LineFacts line,
                            DocumentFacts offer, String field) {
        BigDecimal value = line.numbers().getOrDefault(field, offer.numbers().get(field));
        if (value != null) {
            attributes.put(name, value);
        }
    }

    private static Optional<BigDecimal> min(List<InvestmentComponent> components, String attribute) {
        return components.stream().map(c -> c.attribute(attribute)).filter(v -> v != null).reduce(BigDecimal::min);
    }

    private static boolean positive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }
}
