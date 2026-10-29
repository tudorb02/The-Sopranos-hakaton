package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.livestock.EnergyUse;
import ro.greenstruct.agro.engine.livestock.LivestockCalculator;
import ro.greenstruct.agro.engine.livestock.MethaneComparison;
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
 * Livestock and biogas: methane reduction on manure management, with the manure valorised as energy or
 * fertiliser (README §6, category 4). Species and heads come from the ANSVSA register (FarmInfo.livestock), the
 * storage system from the questionnaire, the emission factors and prices from config.
 */
@Component
public class LivestockModule implements ModuleCalculator {

    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    @Override
    public String id() {
        return "livestock";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        String storage = context.questionnaire().path("manure_storage").asText("");
        if (storage.isBlank()) {
            throw new IllegalArgumentException("The answer 'manure_storage' is missing (how you store manure today)");
        }
        JsonNode register = context.farm().farm().livestock();
        if (register == null || !register.isArray() || register.isEmpty()) {
            throw new IllegalArgumentException("The ANSVSA register shows no animals at this farm");
        }
        BigDecimal heads = BigDecimal.ZERO;
        BigDecimal methane = BigDecimal.ZERO;
        BigDecimal energyNorm = BigDecimal.ZERO;
        BigDecimal nitrogenNorm = BigDecimal.ZERO;
        List<String> species = new ArrayList<>();
        for (JsonNode entry : register) {
            String kind = entry.path("species").asText();
            BigDecimal count = entry.path("heads").decimalValue();
            heads = heads.add(count);
            methane = methane.add(LivestockCalculator.methaneKg(count, perHead(context, "ch4KgPerHeadYear", kind, storage)));
            energyNorm = energyNorm.add(LivestockCalculator.energyKwh(count, perHead(context, "biogasKwhPerHead", kind, null)));
            nitrogenNorm = nitrogenNorm.add(LivestockCalculator.nitrogenKg(count,
                    perHead(context, "nitrogenKgPerHeadYear", kind, null)));
            species.add(kind);
        }
        BigDecimal gwp = RuleValues.factor(context, "methaneGwp");
        BigDecimal co2e = LivestockCalculator.co2eTonnes(methane, gwp);
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"));

        Calc headsCalc = context.calc("baseline.heads", "Animals on the farm (ANSVSA register)", heads, Unit.COUNT)
                .source("ANSVSA").add();
        Calc methaneCalc = context.calc("baseline.methane", "Methane from manure today", methane,
                Unit.KG_CH4_PER_YEAR).formula("heads × CH₄ factor (species, storage system)")
                .source(context.paramSource("ch4KgPerHeadYear")).dependsOn(headsCalc).add();
        context.calc("baseline.co2", "Manure emissions today", co2e, Unit.T_CO2_PER_YEAR)
                .formula("kg CH₄ × GWP / 1000").dependsOn(methaneCalc).add();
        if (invoiced.isPresent()) {
            context.calc("baseline.farm_energy", "Electricity used on the farm", invoiced.get(),
                    Unit.KWH_PER_YEAR).formula("from the 12-month energy invoices").add();
        }

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("heads", heads);
        baseline.put("ch4_kg", methane);
        baseline.put("co2e_t", co2e);
        baseline.put("farm_energy_kwh", invoiced.orElse(BigDecimal.ZERO));
        baseline.put("energy_norm_kwh", energyNorm);
        baseline.put("nitrogen_norm_kg", nitrogenNorm);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("manureStorage", storage);
        result.set("species", context.mapper().valueToTree(species));
        List<String> warnings = new ArrayList<>();
        if (!context.questionnaire().path("livestock_confirmed").asBoolean(false)) {
            warnings.add("The number of animals in the ANSVSA register has not been confirmed by the farmer");
        }
        if (invoiced.isEmpty()) {
            warnings.add("No energy invoices: all energy produced is treated as sold to the grid");
        }
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Current situation: " + methaneCalc.display() + " from " + heads.toPlainString()
                + " animals");
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal reductionPct = LivestockCalculator.systemReductionPct(components.stream()
                .map(c -> c.attribute("methaneReductionPct")).filter(v -> v != null).toList());
        MethaneComparison methane = LivestockCalculator.methane(baseline.get("ch4_kg"), reductionPct);

        boolean digester = components.stream().anyMatch(c -> "DIGESTER".equals(c.category()));
        BigDecimal offered = components.stream().map(c -> c.attribute("energyKwh")).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Biogas becomes electricity only with a cogeneration unit: its data sheet gives the energy, else the norm.
        boolean cogeneration = components.stream().anyMatch(c -> "COGENERATION".equals(c.category()));
        BigDecimal energy = offered.signum() > 0 ? offered : cogeneration ? baseline.get("energy_norm_kwh")
                : BigDecimal.ZERO;
        EnergyUse use = LivestockCalculator.energyUse(energy, baseline.get("farm_energy_kwh"));

        String digestateUse = context.questionnaire().path("digestate_use").asText("");
        boolean fertiliser = listParam(context, "fertiliserDigestateUses").contains(digestateUse);
        boolean valorising = listParam(context, "valorisingDigestateUses").contains(digestateUse);
        BigDecimal nitrogen = digester && fertiliser ? baseline.get("nitrogen_norm_kg") : BigDecimal.ZERO;

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("indicator_pct", methane.reductionPct());
        m.put("ch4_new_kg", methane.newKg());
        m.put("ch4_saved_kg", methane.savedKg());
        m.put("co2_avoided_t", LivestockCalculator.co2eTonnes(methane.savedKg(), RuleValues.factor(context, "methaneGwp")));
        m.put("energy_kwh", use.producedKwh());
        m.put("energy_own_kwh", use.ownKwh());
        m.put("energy_sold_kwh", use.soldKwh());
        m.put("nitrogen_kg", nitrogen);
        m.put("manure_valorised", LivestockCalculator.isValorised(energy, valorising) ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("savings_energy_eur", LivestockCalculator.energyValueEur(use,
                RuleValues.price(context, "electricityEurPerKwh"), context.param("electricitySellEurPerKwh")));
        m.put("savings_fertiliser_eur", LivestockCalculator.fertiliserValueEur(nitrogen, context.param("nitrogenEurPerKg")));
        return m;
    }

    /** The green threshold also needs the manure to be valorised (README §6, category 4, C). */
    @Override
    public boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        return metrics.getOrDefault("manure_valorised", BigDecimal.ONE).signum() > 0;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "methane_reduction_pct", "Methane emission reduction", cfg.metric("indicator_pct"),
                Unit.PCT).formula("1 − new CH₄ / CH₄ today").add());
        calcs.add(context.calc(p + "methane_new", "Methane after the investment", cfg.metric("ch4_new_kg"),
                Unit.KG_CH4_PER_YEAR).formula("CH₄ today × (1 − system reduction)").add());
        calcs.add(context.calc(p + "methane_saved", "Methane avoided per year", cfg.metric("ch4_saved_kg"),
                Unit.KG_CH4_PER_YEAR).add());
        if (cfg.metricOrZero("energy_kwh").signum() > 0) {
            calcs.add(context.calc(p + "energy_produced", "Electricity produced from biogas",
                    cfg.metric("energy_kwh"), Unit.KWH_PER_YEAR).formula("from the offer data sheet, else heads × kWh per head")
                    .add());
            calcs.add(context.calc(p + "energy_own", "Energy used on the farm", cfg.metric("energy_own_kwh"),
                    Unit.KWH_PER_YEAR).formula("min(energy produced, farm consumption)").add());
            calcs.add(context.calc(p + "energy_sold", "Energy sold to the grid", cfg.metric("energy_sold_kwh"),
                    Unit.KWH_PER_YEAR).formula("energy produced − energy used on the farm").add());
        }
        if (cfg.metricOrZero("nitrogen_kg").signum() > 0) {
            calcs.add(context.calc(p + "nitrogen_digestate", "Nitrogen from digestate replacing mineral fertiliser",
                    cfg.metric("nitrogen_kg"), Unit.KG_N_PER_YEAR).formula("heads × kg N per head").add());
        }
        calcs.add(context.calc(p + "savings_energy", "Energy value per year", cfg.metric("savings_energy_eur"),
                Unit.EUR_PER_YEAR).formula("farm kWh × price + kWh sold × sell price").add());
        calcs.add(context.calc(p + "savings_fertiliser", "Value of the digestate nitrogen per year",
                cfg.metric("savings_fertiliser_eur"), Unit.EUR_PER_YEAR).formula("kg N × nitrogen price").add());
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("energy_produced", "RENEWABLE_KWH", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.co2", "CO2_EMITTED_T");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_energy_eur", "energy_eur", "savings_fertiliser_eur", "fertiliser_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
        context.calc("rules.threshold.methane_reduction", "Green threshold: methane emission reduction",
                RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
        context.calc("rules.factor.gwp_methane", "Methane GWP (100 years)", RuleValues.factor(context, "methaneGwp"),
                Unit.COUNT).source(RuleValues.factorSource(context, "methaneGwp")).add();
        String storage = context.questionnaire().path("manure_storage").asText("");
        JsonNode register = context.farm().farm().livestock();
        if (!storage.isBlank() && register != null && register.isArray() && !register.isEmpty()) {
            String species = register.get(0).path("species").asText();
            context.calc("rules.factor.ch4_per_head", "CH₄ emission factor per head and year (" + species + ", " + storage + ")",
                    perHead(context, "ch4KgPerHeadYear", species, storage), Unit.KG_CH4_PER_YEAR)
                    .source(context.paramSource("ch4KgPerHeadYear")).add();
            context.calc("rules.energy.kwh_per_head", "Electricity from biogas per head and year",
                    perHead(context, "biogasKwhPerHead", species, null), Unit.KWH_PER_YEAR)
                    .source(context.paramSource("biogasKwhPerHead")).add();
        }
        context.calc("rules.price.electricity", "Electricity price", RuleValues.price(context, "electricityEurPerKwh"),
                Unit.EUR_PER_KWH).source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
        context.calc("rules.price.electricity_sell", "Sell price of energy to the grid",
                context.param("electricitySellEurPerKwh"), Unit.EUR_PER_KWH)
                .source(context.paramSource("electricitySellEurPerKwh")).add();
        context.calc("rules.price.nitrogen", "Price of the mineral nitrogen replaced", context.param("nitrogenEurPerKg"),
                Unit.EUR_PER_KG_N).source(context.paramSource("nitrogenEurPerKg")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
        context.workspace().documentOfType("ENVIRONMENTAL_PERMIT").ifPresentOrElse(permit -> {
            String validUntil = permit.texts().get("PERMIT_VALID_UNTIL");
            result.put("permitPresent", true);
            // A permit without an end date (e.g. "subject to the annual visa") is treated as valid.
            result.put("permitValid", validUntil == null || validUntil.isBlank()
                    || !parseDate(validUntil).isBefore(context.today()));
            if (validUntil != null && !validUntil.isBlank()) {
                result.put("permitValidUntil", validUntil);
            }
        }, () -> result.put("permitPresent", false));
        result.put("manureStorage", context.questionnaire().path("manure_storage").asText("NECUNOSCUT"));
        result.put("digestateUse", context.questionnaire().path("digestate_use").asText("NECUNOSCUT"));
        result.put("fertilisationPlan", context.questionnaire().path("fertilisation_plan").asText("NECUNOSCUT"));
        result.put("digesterInConfig", cfg.components().stream().anyMatch(c -> "DIGESTER".equals(c.category())));
        result.put("digestateCoverInConfig", cfg.components().stream().anyMatch(c -> "DIGESTATE_COVER".equals(c.category())));
        result.put("manureValorised", cfg.metricOrZero("manure_valorised").signum() > 0);
        result.put("methaneReductionPct", cfg.metric("indicator_pct"));
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
        context.calc("impact.energy_horizon", "Energy produced from biogas over the horizon",
                cfg.metric("energy_kwh").multiply(years, MC), Unit.KWH).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        switch (line.category()) {
            case "DIGESTER" -> {
                BigDecimal reduction = line.numbers().getOrDefault("METHANE_REDUCTION_PCT",
                        offer.numbers().get("METHANE_REDUCTION_PCT"));
                if (reduction != null) {
                    attributes.put("methaneReductionPct", reduction);
                }
            }
            case "COGENERATION" -> {
                BigDecimal energy = line.numbers().getOrDefault("ENERGY_KWH", offer.numbers().get("ENERGY_KWH"));
                if (energy != null) {
                    attributes.put("energyKwh", energy);
                }
                BigDecimal power = line.numbers().getOrDefault("ENGINE_POWER_KW", offer.numbers().get("ENGINE_POWER_KW"));
                if (power != null) {
                    attributes.put("powerKw", power);
                }
            }
            default -> {
            }
        }
    }

    /** parameters.&lt;name&gt;.value.&lt;species&gt;[.&lt;storage&gt;] as a number; a species without a factor is an input error. */
    private static BigDecimal perHead(ToolContext context, String name, String species, String storage) {
        JsonNode node = context.module().parameters().path(name).path("value").path(species);
        if (storage != null) {
            node = node.path(storage);
        }
        if (!node.isNumber()) {
            throw new IllegalArgumentException("Config '" + name + "' has no value for species " + species
                    + (storage == null ? "" : " and storage " + storage));
        }
        return node.decimalValue();
    }

    private static List<String> listParam(ToolContext context, String name) {
        List<String> values = new ArrayList<>();
        context.module().parameters().path(name).path("value").forEach(v -> values.add(v.asText()));
        return values;
    }

    private static LocalDate parseDate(String raw) {
        try {
            return LocalDate.parse(raw.trim(), RO_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date '" + raw + "' in the permit is not in dd.mm.yyyy format");
        }
    }
}
