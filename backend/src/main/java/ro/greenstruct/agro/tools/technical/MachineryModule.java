package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;
import ro.greenstruct.agro.engine.Decimals;
import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.CropArea;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.engine.machinery.FuelComparison;
import ro.greenstruct.agro.engine.machinery.MachineryCalculator;
import ro.greenstruct.agro.engine.machinery.PowerCheck;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/** Machinery and precision farming: diesel and nitrogen saving (README §6, category 3). */
@Component
public class MachineryModule implements ModuleCalculator {

    @Override
    public String id() {
        return "machinery";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        BigDecimal norm = area.multiply(context.param("baselineLitresPerHa"), MC);
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("FUEL_INVOICES")
                .flatMap(doc -> doc.number("FUEL_LITRES"));
        BigDecimal tolerance = context.param("invoiceToleranceRatio");
        BigDecimal deviation = invoiced.map(l -> l.subtract(norm).abs().divide(norm, MC)).orElse(null);
        boolean useInvoices = deviation != null && deviation.compareTo(tolerance) > 0;
        BigDecimal fuel = useInvoices ? invoiced.get() : norm;

        JsonNode nitrogenAnswer = context.questionnaire().path("nitrogen_kg_ha");
        BigDecimal nitrogenPerHa = nitrogenAnswer.isNumber() ? nitrogenAnswer.decimalValue()
                : context.param("nitrogenKgPerHaDefault");
        BigDecimal nitrogen = area.multiply(nitrogenPerHa, MC);
        BigDecimal co2 = ImpactCalculator.co2Tonnes(fuel, RuleValues.factor(context, "dieselKgCo2PerLitre"));

        Calc areaCalc = context.calc("baseline.area", "Suprafața lucrată", area, Unit.HA).source("APIA").add();
        String fuelFormula = invoiced.isEmpty() ? "ha × l/ha (normă, fără facturi)"
                : useInvoices ? "din facturi (abatere față de normă peste toleranță)"
                : "ha × l/ha, confirmat de facturi (abatere sub toleranță)";
        Calc fuelCalc = context.calc("baseline.fuel", "Motorină consumată azi", fuel, Unit.L_PER_YEAR)
                .formula(fuelFormula).dependsOn(areaCalc).add();
        context.calc("baseline.nitrogen", "Azot aplicat azi", nitrogen, Unit.KG_N_PER_YEAR)
                .formula("ha × kg N/ha (chestionar)").dependsOn(areaCalc).add();
        context.calc("baseline.co2", "CO₂ din motorină azi", co2, Unit.T_CO2_PER_YEAR).formula("l × factor motorină")
                .dependsOn(fuelCalc).add();

        List<String> warnings = new ArrayList<>();
        Fleet fleet = fleet(input, context, warnings);
        context.calc("baseline.fleet_total", "Tractoare în fermă azi", BigDecimal.valueOf(fleet.total()), Unit.COUNT)
                .add();
        context.calc("baseline.fleet_replaced", "Tractoare scoase din fermă după investiție",
                BigDecimal.valueOf(fleet.replaced()), Unit.COUNT).add();
        context.calc("baseline.replaced_age", "Vechimea tractoarelor înlocuite", BigDecimal.valueOf(fleet.ageYears()),
                Unit.YEARS).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("fuel_l", fuel);
        baseline.put("nitrogen_kg", nitrogen);
        baseline.put("co2_t", co2);
        baseline.put("fleet_total", BigDecimal.valueOf(fleet.total()));
        baseline.put("fleet_replaced", BigDecimal.valueOf(fleet.replaced()));
        baseline.put("replaced_age_years", BigDecimal.valueOf(fleet.ageYears()));
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("invoicesConfirmNorm", invoiced.isPresent() && !useInvoices);
        result.put("fleetChange", fleet.replaced() == 0 ? "EXPANSION" : fleet.replaced() < fleet.total() ? "PARTIAL_REPLACEMENT"
                : "FULL_REPLACEMENT");
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: " + fuelCalc.display() + " de motorină");
    }

    private record Fleet(int total, int replaced, int ageYears) {
    }

    /**
     * Which tractors leave the farm: from the input, else the questionnaire, else the assumption that the
     * offered tractors replace as many tractors older than 15 years (stated as a warning).
     */
    private Fleet fleet(JsonNode input, ToolContext context, List<String> warnings) {
        JsonNode given = input.path("currentFleet");
        JsonNode answers = context.questionnaire();
        int offered = context.workspace().documentOfType("OFFER").map(offer -> offer.lines().stream()
                .filter(line -> "TRACTOR".equals(line.category()))
                .mapToInt(line -> line.numbers().getOrDefault("QUANTITY", BigDecimal.ONE).intValue()).sum())
                .orElse(0);

        int replaced = given.has("replacedCount") ? given.path("replacedCount").asInt()
                : answers.has("replaced_tractors") ? answers.path("replaced_tractors").asInt() : -1;
        if (replaced < 0) {
            replaced = offered;
            warnings.add("Nu știm câte tractoare scoateți: presupunem că cele " + offered + " din ofertă înlocuiesc tot atâtea");
        }
        int total = given.has("totalCount") ? given.path("totalCount").asInt()
                : answers.has("current_tractors") ? answers.path("current_tractors").asInt() : Math.max(replaced, 1);
        if (replaced > total) {
            throw new IllegalArgumentException("Nu se pot scoate " + replaced + " tractoare dintr-o flotă de " + total);
        }
        int age;
        if (given.has("averageAgeYears")) {
            age = given.path("averageAgeYears").asInt();
        } else if (answers.has("replaced_fleet_age")) {
            JsonNode ages = context.module().parameters().path("fleetAgeYears").path("value");
            String band = answers.path("replaced_fleet_age").asText();
            if (!ages.has(band)) {
                throw new IllegalArgumentException("Vechime necunoscută a flotei: " + band);
            }
            age = ages.path(band).asInt();
        } else {
            age = context.module().parameters().path("fleetAgeYears").path("value").path("PESTE_15_ANI").asInt();
            warnings.add("Nu știm vechimea tractoarelor înlocuite: presupunem peste 15 ani");
        }
        if (replaced == 0) {
            warnings.add("Investiția extinde flota fără să scoată tractoare: economia de motorină a tractoarelor e zero");
        }
        return new Fleet(total, replaced, age);
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal area = baseline.get("area_ha");
        BigDecimal tractors = components.stream().filter(c -> "TRACTOR".equals(c.category()))
                .map(InvestmentComponent::quantity).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal hp = components.stream().filter(c -> "TRACTOR".equals(c.category()) && c.attribute("hp") != null)
                .map(c -> c.attribute("hp").multiply(c.quantity(), MC)).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal tractorSaving = tractorSavingPct(context, components, baseline);
        List<BigDecimal> fuelSavings = new ArrayList<>();
        fuelSavings.add(tractorSaving);
        components.stream().map(c -> c.attribute("fuelSavingPct")).filter(v -> v != null).forEach(fuelSavings::add);
        FuelComparison fuel = MachineryCalculator.fuel(BigDecimal.ONE, baseline.get("fuel_l"), fuelSavings);

        BigDecimal nitrogenPerHa = baseline.get("nitrogen_kg").divide(area, MC);
        BigDecimal nitrogenSaved = MachineryCalculator.nitrogenSavedKg(area, nitrogenPerHa,
                sumAttribute(components, "nitrogenSavingPct"));
        BigDecimal inputsSaved = area.multiply(context.param("inputsEurPerHa"), MC)
                .multiply(fraction(sumAttribute(components, "inputSavingPct")), MC);
        BigDecimal precisionCost = components.stream().filter(c -> c.category().startsWith("PRECISION_"))
                .map(InvestmentComponent::costEur).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCost = components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        PowerCheck power = MachineryCalculator.power(hp, area, context.param("maxHpPerHa"));

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("tractor_count", tractors);
        m.put("tractor_saving_pct", tractorSaving);
        m.put("hp_total", hp);
        m.put("hp_per_ha", power.hpPerHa());
        m.put("fuel_l", fuel.proposedLitres());
        m.put("fuel_saved_l", fuel.savedLitres());
        m.put("indicator_pct", fuel.savingPct());
        m.put("nitrogen_saved_kg", nitrogenSaved);
        m.put("inputs_saved_eur", inputsSaved);
        m.put("precision_cost", precisionCost);
        m.put("precision_share_pct", totalCost.signum() == 0 ? BigDecimal.ZERO
                : toPct(precisionCost.divide(totalCost, MC)));
        m.put("co2_avoided_t", ImpactCalculator.co2Tonnes(fuel.savedLitres(),
                RuleValues.factor(context, "dieselKgCo2PerLitre")));
        m.put("savings_fuel_eur", fuel.savedLitres().multiply(RuleValues.dieselNetEurPerLitre(context), MC));
        m.put("savings_inputs_eur", inputsSaved);
        return m;
    }

    /**
     * Fuel saved by the offered tractors over the ones leaving the farm: per tractor 1 − g/kWh(its age) /
     * g/kWh(age of the replaced fleet), weighted by power, times the share of the fleet actually replaced.
     * Adding tractors without retiring any saves nothing.
     */
    private static BigDecimal tractorSavingPct(ToolContext context, List<InvestmentComponent> components,
                                               Map<String, BigDecimal> baseline) {
        BigDecimal total = baseline.getOrDefault("fleet_total", BigDecimal.ZERO);
        BigDecimal replaced = baseline.getOrDefault("fleet_replaced", BigDecimal.ZERO);
        if (total.signum() == 0 || replaced.signum() == 0) {
            return BigDecimal.ZERO;
        }
        int replacedAge = baseline.get("replaced_age_years").intValue();
        BigDecimal weighted = BigDecimal.ZERO;
        BigDecimal power = BigDecimal.ZERO;
        for (InvestmentComponent tractor : components) {
            if (!"TRACTOR".equals(tractor.category()) || tractor.attribute("hp") == null) {
                continue;
            }
            BigDecimal tractorPower = tractor.attribute("hp").multiply(tractor.quantity(), MC);
            BigDecimal saving = EquipmentAge.savingFraction(context, EquipmentAge.ageYears(context, tractor), replacedAge);
            weighted = weighted.add(saving.multiply(tractorPower, MC));
            power = power.add(tractorPower);
        }
        if (power.signum() == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal share = replaced.min(total).divide(total, MC);
        return toPct(weighted.divide(power, MC).multiply(share, MC));
    }

    /** Machinery only: fleet power per hectare within the AFIR sizing limit. */
    @Override
    public boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        BigDecimal hpPerHa = metrics.get("hp_per_ha");
        return hpPerHa == null || hpPerHa.compareTo(context.param("maxHpPerHa")) <= 0;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
            calcs.add(context.calc(p + "tractor_saving_pct", "Economie din tractoare (vechime, flotă înlocuită)",
                    cfg.metric("tractor_saving_pct"), Unit.PCT)
                    .formula("(1 − g/kWh tractor ofertat / g/kWh tractor înlocuit) × tractoare scoase / flotă").add());
            calcs.add(context.calc(p + "fuel_saving_pct", "Economie de motorină", cfg.metric("indicator_pct"), Unit.PCT)
                    .formula("1 − (1 − s_tractor) × (1 − s_precizie)").add());
            calcs.add(context.calc(p + "fuel_saved", "Motorină economisită pe an", cfg.metric("fuel_saved_l"),
                    Unit.L_PER_YEAR).add());
            calcs.add(context.calc(p + "fuel_use", "Consum de motorină după investiție", cfg.metric("fuel_l"),
                    Unit.L_PER_YEAR).add());
            calcs.add(context.calc(p + "hp_per_ha", "Putere pe hectar", cfg.metric("hp_per_ha"), Unit.HP_PER_HA)
                    .formula("CP total / ha").add());
            if (cfg.metricOrZero("precision_cost").signum() > 0) {
                calcs.add(context.calc(p + "nitrogen_saved", "Azot economisit pe an", cfg.metric("nitrogen_saved_kg"),
                        Unit.KG_N_PER_YEAR).formula("ha × kg N/ha × s_doză_variabilă").add());
                calcs.add(context.calc(p + "inputs_saved", "Inputuri economisite pe an", cfg.metric("inputs_saved_eur"),
                        Unit.EUR_PER_YEAR).formula("ha × EUR/ha × s_inputuri").add());
                calcs.add(context.calc(p + "precision_share", "Ponderea agriculturii de precizie",
                        cfg.metric("precision_share_pct"), Unit.PCT).formula("cost precizie / cost total").add());
            }
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("fuel_use", "FUEL_USE_L", "fuel_saved", "FUEL_SAVED_L", "nitrogen_saved", "NITROGEN_SAVED_KG",
                "precision_share", "PRECISION_SHARE_PCT", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.area", "AREA_HA", "baseline.fuel", "FUEL_USE_L", "baseline.nitrogen",
                "NITROGEN_USE_KG", "baseline.co2", "CO2_EMITTED_T");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_fuel_eur", "fuel_eur", "savings_inputs_eur", "inputs_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
            context.calc("rules.threshold.fuel_saving", "Pragul verde: economie de motorină",
                    RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
            context.calc("rules.norm.l_per_ha", "Norma de motorină", context.param("baselineLitresPerHa"), Unit.L_PER_HA)
                    .source(context.paramSource("baselineLitresPerHa")).add();
            context.calc("rules.saving.new_vs_old", "Economie tractor nou față de unul de peste 15 ani",
                    EquipmentAge.savingFraction(context, 0, 20).multiply(Decimals.HUNDRED), Unit.PCT)
                    .formula("1 − g/kWh tractor nou / g/kWh tractor vechi")
                    .source(context.paramSource("specificFuelByAge")).add();
            context.calc("rules.price.fuel_net", "Costul net al motorinei", RuleValues.dieselNetEurPerLitre(context),
                    Unit.EUR_PER_L).formula("(preț la pompă / (1 + TVA) − acciză rambursată) / curs EUR")
                    .source(RuleValues.priceSource(context, "dieselExciseRefundLeiPerLitre")).add();
            context.calc("rules.factor.diesel", "Factor de emisie motorină",
                    RuleValues.factor(context, "dieselKgCo2PerLitre"), Unit.KG_CO2_PER_L)
                    .source(RuleValues.factorSource(context, "dieselKgCo2PerLitre")).add();
            context.calc("rules.sizing.max_hp_ha", "Putere maximă pe hectar", context.param("maxHpPerHa"),
                    Unit.HP_PER_HA).source(context.paramSource("maxHpPerHa")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
            var stages = result.putArray("emissionStages");
            context.workspace().documentOfType("OFFER").ifPresent(offer -> offer.lines().forEach(line -> {
                String stage = line.texts().get("EMISSION_STAGE");
                if (stage != null) {
                    stages.add(line.lineId() + ": " + stage);
                }
            }));
            result.put("tillage", context.questionnaire().path("tillage").asText("NECUNOSCUT"));
            var used = result.putArray("usedEquipment");
            cfg.components().stream().filter(EquipmentAge::isUsed).forEach(c -> used.addObject()
                    .put("componentId", c.componentId())
                    .put("ageYears", EquipmentAge.ageYears(context, c)));
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
            context.calc("impact.fuel_horizon", "Motorină economisită pe orizont",
                    cfg.metric("fuel_saved_l").multiply(years, MC), Unit.L).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        switch (line.category()) {
                case "TRACTOR", "COMBINE" -> {
                    BigDecimal hp = line.numbers().get("ENGINE_POWER_HP");
                    if (hp != null) {
                        attributes.put("hp", hp);
                    }
                }
            default -> {
            }
        }
    }

    private static BigDecimal sumAttribute(List<InvestmentComponent> components, String attribute) {
        return components.stream().map(c -> c.attribute(attribute)).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
