package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.machinery.FuelComparison;
import ro.greenstruct.agro.engine.machinery.MachineryCalculator;
import ro.greenstruct.agro.engine.machinery.PowerCheck;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * Machinery and precision farming (README §6, category 3). Today: litres per hectare from the diesel invoices and
 * the hectares worked, kg N from the fertiliser invoices. After: the offered tractor's consumption per hectare
 * (data sheet or catalog) times the precision upgrades; nitrogen cut by the catalog reductions. The green indicator
 * is the larger of the diesel and the nitrogen reduction.
 */
@Component
public class MachineryModule implements ModuleCalculator {

    /** Offer attribute names (also the effect keys of data/catalog/utilaje.json). */
    static final String DIESEL_L_PER_HA = "dieselLPerHa";
    static final String DIESEL_SAVING_VS_OLD_PCT = "dieselSavingVsOldPct";
    static final String DIESEL_REDUCTION_PCT = "dieselReductionPct";
    static final String NITROGEN_REDUCTION_PCT = "nitrogenReductionPct";
    static final String STAGE_V = "stageV";

    private static final Pattern STAGE_V_TEXT = Pattern.compile("(?i)\\bstage\\s*(v|5)\\b");

    @Override
    public String id() {
        return "machinery";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        List<String> warnings = new ArrayList<>();

        Optional<BigDecimal> invoicedFuel = context.workspace().documentOfType("FUEL_INVOICES")
                .flatMap(doc -> doc.number("FUEL_LITRES"));
        BigDecimal fuel = invoicedFuel.orElseGet(() -> {
            warnings.add("Lipsesc facturile de motorină: folosim norma de " + context.param("baselineLitresPerHa")
                    .toPlainString() + " l/ha, de confirmat înainte de tragere");
            return area.multiply(context.param("baselineLitresPerHa"), MC);
        });
        BigDecimal litresPerHa = MachineryCalculator.litresPerHa(fuel, area);

        Optional<BigDecimal> invoicedNitrogen = context.workspace().documentOfType("FERTILIZER_INVOICES")
                .flatMap(doc -> doc.number("FERTILIZER_KG_N"));
        JsonNode nitrogenAnswer = context.questionnaire().path("nitrogen_kg_ha");
        BigDecimal nitrogen = invoicedNitrogen.orElseGet(() -> {
            BigDecimal perHa = nitrogenAnswer.isNumber() ? nitrogenAnswer.decimalValue()
                    : context.param("nitrogenKgPerHaDefault");
            warnings.add("Lipsesc facturile de îngrășăminte: azotul vine din " + (nitrogenAnswer.isNumber()
                    ? "chestionar" : "norma implicită") + " (" + perHa.toPlainString() + " kg N/ha)");
            return area.multiply(perHa, MC);
        });
        BigDecimal nitrogenPerHa = nitrogen.divide(area, MC);
        BigDecimal co2 = MachineryCalculator.co2eTonnes(fuel, RuleValues.factor(context, "dieselKgCo2PerLitre"),
                nitrogen, RuleValues.factor(context, "nitrogenKgCo2ePerKgN"));

        Calc areaCalc = context.calc("baseline.area", "Suprafața lucrată pe an", area, Unit.HA).source("APIA").add();
        Calc fuelCalc = context.calc("baseline.fuel", "Motorină consumată pe an", fuel, Unit.L_PER_YEAR)
                .formula(invoicedFuel.isPresent() ? "din facturile de motorină pe 12 luni" : "ha × l/ha (normă, fără facturi)")
                .dependsOn(areaCalc).add();
        Calc perHaCalc = context.calc("baseline.fuel_per_ha", "Motorină pe hectar acum", litresPerHa, Unit.L_PER_HA)
                .formula("l_ha_vechi = litri pe an / hectare lucrate").dependsOn(fuelCalc, areaCalc).add();
        Calc nitrogenCalc = context.calc("baseline.nitrogen", "Azot aplicat pe an", nitrogen, Unit.KG_N_PER_YEAR)
                .formula(invoicedNitrogen.isPresent() ? "din facturile de îngrășăminte pe 12 luni"
                        : "ha × kg N/ha (chestionar sau normă)").dependsOn(areaCalc).add();
        context.calc("baseline.nitrogen_per_ha", "Azot pe hectar acum", nitrogenPerHa, Unit.KG_N_PER_HA)
                .formula("kg N pe an / hectare lucrate").dependsOn(nitrogenCalc, areaCalc).add();
        context.calc("baseline.co2", "CO₂e emis acum (motorină și azot)", co2, Unit.T_CO2_PER_YEAR)
                .formula("(l × factor motorină + kg N × factor azot) / 1000").dependsOn(fuelCalc, nitrogenCalc).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("fuel_l", fuel);
        baseline.put("fuel_l_per_ha", litresPerHa);
        baseline.put("nitrogen_kg", nitrogen);
        baseline.put("co2_t", co2);

        ObjectNode replaced = context.newResult();
        replacedMachine(context, baseline, replaced, warnings);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoicedFuel.isPresent() && invoicedNitrogen.isPresent() ? "INVOICES"
                : invoicedFuel.isPresent() ? "MIXED" : "NORM");
        result.set("replacedMachine", replaced);
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: " + perHaCalc.display() + " de motorină");
    }

    /** The machine that leaves the farm: year and power from the questionnaire, else from its data sheet. */
    private void replacedMachine(ToolContext context, Map<String, BigDecimal> baseline, ObjectNode out,
                                 List<String> warnings) {
        Optional<DocumentFacts> sheet = context.workspace().documentOfType("CURRENT_EQUIPMENT");
        JsonNode year = context.questionnaire().path("replaced_machine_year");
        JsonNode power = context.questionnaire().path("replaced_machine_hp");
        Optional<BigDecimal> builtIn = year.isNumber() ? Optional.of(year.decimalValue())
                : sheet.flatMap(doc -> doc.number("MANUFACTURE_YEAR"));
        Optional<BigDecimal> hp = power.isNumber() ? Optional.of(power.decimalValue())
                : sheet.flatMap(doc -> doc.number("ENGINE_POWER_HP"));
        builtIn.ifPresentOrElse(value -> {
            int age = Math.max(0, context.today().getYear() - value.intValue());
            baseline.put("replaced_age_years", BigDecimal.valueOf(age));
            out.put("manufactureYear", value.intValue());
            context.calc("baseline.replaced_age", "Vechimea utilajului înlocuit", BigDecimal.valueOf(age), Unit.YEARS)
                    .formula("anul analizei − anul de fabricație").add();
        }, () -> warnings.add("Nu știm anul de fabricație al utilajului înlocuit; de completat înainte de tragere"));
        hp.ifPresent(value -> {
            baseline.put("replaced_hp", value);
            out.put("powerHp", value);
            context.calc("baseline.replaced_power", "Puterea utilajului înlocuit", value, Unit.HP)
                    .source(year.isNumber() || power.isNumber() ? "chestionar" : "fișa utilajului vechi").add();
        });
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal area = baseline.get("area_ha");
        BigDecimal litresPerHaOld = baseline.get("fuel_l_per_ha");
        List<InvestmentComponent> tractors = components.stream().filter(MachineryModule::isTractor).toList();

        BigDecimal tractorCount = tractors.stream().map(InvestmentComponent::quantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal hp = tractors.stream().filter(c -> c.attribute("hp") != null)
                .map(c -> c.attribute("hp").multiply(c.quantity(), MC)).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tractorLitresPerHa = tractorLitresPerHa(tractors, litresPerHaOld);

        FuelComparison fuel = MachineryCalculator.fuel(area, litresPerHaOld, tractorLitresPerHa,
                attributes(components, DIESEL_REDUCTION_PCT));
        BigDecimal nitrogenPct = MachineryCalculator.nitrogenReductionPct(attributes(components, NITROGEN_REDUCTION_PCT));
        BigDecimal nitrogenSaved = MachineryCalculator.nitrogenSavedKg(baseline.get("nitrogen_kg"), nitrogenPct);
        BigDecimal dieselEur = MachineryCalculator.dieselSavingEur(fuel.savedLitres(),
                RuleValues.dieselNetEurPerLitre(context));
        BigDecimal nitrogenEur = MachineryCalculator.nitrogenSavingEur(nitrogenSaved, context.param("nitrogenEurPerKg"));

        BigDecimal precisionCost = components.stream().filter(c -> c.category().startsWith("PRECISION_"))
                .map(InvestmentComponent::costEur).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCost = components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        PowerCheck power = MachineryCalculator.power(hp, area, context.param("maxHpPerHa"));

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("tractor_count", tractorCount);
        m.put("hp_total", hp);
        m.put("hp_per_ha", power.hpPerHa());
        m.put("tractor_l_per_ha", tractorLitresPerHa);
        m.put("fuel_l_per_ha", fuel.litresPerHaAfter());
        m.put("fuel_l", fuel.litresPerHaAfter().multiply(area, MC));
        m.put("fuel_saved_l", fuel.savedLitres());
        m.put("fuel_saving_pct", fuel.savingPct());
        m.put("nitrogen_saving_pct", nitrogenPct);
        m.put("nitrogen_saved_kg", nitrogenSaved);
        m.put("indicator_pct", fuel.savingPct().max(nitrogenPct));
        m.put("precision_cost", precisionCost);
        m.put("precision_share_pct", totalCost.signum() == 0 ? BigDecimal.ZERO
                : toPct(precisionCost.divide(totalCost, MC)));
        m.put("stage_v_ok", stageVOk(tractors) ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("co2_avoided_t", MachineryCalculator.co2eTonnes(fuel.savedLitres(),
                RuleValues.factor(context, "dieselKgCo2PerLitre"), nitrogenSaved,
                RuleValues.factor(context, "nitrogenKgCo2ePerKgN")));
        m.put("savings_fuel_eur", dieselEur);
        m.put("savings_inputs_eur", nitrogenEur);
        return m;
    }

    private static boolean isTractor(InvestmentComponent c) {
        return "TRACTOR".equals(c.category()) || "COMBINE".equals(c.category());
    }

    /**
     * Consumption per hectare of the offered tractors, weighted by power × quantity: the data sheet's figure, or
     * the catalog's saving over today's consumption for a catalog machine. Tractors without either say nothing;
     * with no figure at all the farm keeps today's consumption (a precision-only offer).
     */
    private static BigDecimal tractorLitresPerHa(List<InvestmentComponent> tractors, BigDecimal litresPerHaOld) {
        List<BigDecimal> values = new ArrayList<>();
        List<BigDecimal> weights = new ArrayList<>();
        for (InvestmentComponent tractor : tractors) {
            BigDecimal value = tractor.attribute(DIESEL_L_PER_HA);
            if (value == null && tractor.attribute(DIESEL_SAVING_VS_OLD_PCT) != null) {
                value = litresPerHaOld.multiply(BigDecimal.ONE.subtract(
                        tractor.attribute(DIESEL_SAVING_VS_OLD_PCT).movePointLeft(2)), MC);
            }
            if (value != null) {
                values.add(value);
                BigDecimal hp = tractor.attribute("hp");
                weights.add((hp == null ? BigDecimal.ONE : hp).multiply(tractor.quantity(), MC));
            }
        }
        return values.isEmpty() ? litresPerHaOld : MachineryCalculator.weightedAverage(values, weights);
    }

    /** A tractor whose engine stage is known and is not Stage V fails the eligibility condition. */
    private static boolean stageVOk(List<InvestmentComponent> tractors) {
        return tractors.stream().map(c -> c.attribute(STAGE_V)).noneMatch(v -> v != null && v.signum() == 0);
    }

    private static List<BigDecimal> attributes(List<InvestmentComponent> components, String attribute) {
        return components.stream().map(c -> c.attribute(attribute)).filter(v -> v != null).toList();
    }

    /** Fleet power per hectare within the AFIR sizing limit, and a Stage V engine on the new tractors. */
    @Override
    public boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        BigDecimal hpPerHa = metrics.get("hp_per_ha");
        BigDecimal stageV = metrics.get("stage_v_ok");
        return (hpPerHa == null || hpPerHa.compareTo(context.param("maxHpPerHa")) <= 0)
                && (stageV == null || stageV.signum() > 0);
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "tractor_per_ha", "Consumul tractorului ofertat", cfg.metric("tractor_l_per_ha"),
                Unit.L_PER_HA).formula("din fișa tehnică a ofertei sau din catalog").add());
        calcs.add(context.calc(p + "fuel_per_ha", "Motorină pe hectar după investiție", cfg.metric("fuel_l_per_ha"),
                Unit.L_PER_HA).formula("l_ha_tractor × Π(1 − reducerea fiecărui upgrade de precizie)").add());
        calcs.add(context.calc(p + "fuel_saving_pct", "Reducerea de motorină pe hectar",
                cfg.metric("fuel_saving_pct"), Unit.PCT).formula("1 − l_ha_nou / l_ha_vechi").add());
        calcs.add(context.calc(p + "nitrogen_saving_pct", "Reducerea de azot pe hectar",
                cfg.metric("nitrogen_saving_pct"), Unit.PCT).formula("Σ reducerile de dozare din catalog").add());
        calcs.add(context.calc(p + "fuel_saved", "Motorină economisită pe an", cfg.metric("fuel_saved_l"),
                Unit.L_PER_YEAR).formula("(l_ha_vechi − l_ha_nou) × ha").add());
        calcs.add(context.calc(p + "fuel_use", "Consum de motorină după investiție", cfg.metric("fuel_l"),
                Unit.L_PER_YEAR).add());
        calcs.add(context.calc(p + "nitrogen_saved", "Azot economisit pe an", cfg.metric("nitrogen_saved_kg"),
                Unit.KG_N_PER_YEAR).formula("kg N pe an × reducerea de azot").add());
        calcs.add(context.calc(p + "savings", "Economie pe an (motorină și azot)",
                cfg.metric("savings_fuel_eur").add(cfg.metric("savings_inputs_eur")), Unit.EUR_PER_YEAR)
                .formula("Δl × preț motorină + ΔkgN × preț azot").add());
        calcs.add(context.calc(p + "hp_per_ha", "Putere pe hectar", cfg.metric("hp_per_ha"), Unit.HP_PER_HA)
                .formula("CP total ofertat / ha").add());
        if (cfg.metricOrZero("precision_cost").signum() > 0) {
            calcs.add(context.calc(p + "precision_share", "Ponderea agriculturii de precizie",
                    cfg.metric("precision_share_pct"), Unit.PCT).formula("cost precizie / cost total").add());
        }
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("fuel_use", "FUEL_USE_L", "fuel_saved", "FUEL_SAVED_L", "fuel_saving_pct", "FUEL_SAVING_PCT",
                "nitrogen_saved", "NITROGEN_SAVED_KG", "precision_share", "PRECISION_SHARE_PCT", "co2_avoided",
                "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.area", "AREA_HA", "baseline.fuel", "FUEL_USE_L", "baseline.nitrogen",
                "NITROGEN_USE_KG", "baseline.co2", "CO2_EMITTED_T");
    }

    /** Diesel and nitrogen savings in EUR; nitrogen is reported under the contract's "inputs" cost metric. */
    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_fuel_eur", "fuel_eur", "savings_inputs_eur", "inputs_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
        context.calc("rules.threshold.reduction", "Pragul verde: reducere de motorină sau de azot pe hectar",
                RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
        context.calc("rules.norm.l_per_ha", "Norma de motorină (doar fără facturi)",
                context.param("baselineLitresPerHa"), Unit.L_PER_HA).source(context.paramSource("baselineLitresPerHa")).add();
        context.calc("rules.price.fuel_net", "Costul net al motorinei", RuleValues.dieselNetEurPerLitre(context),
                Unit.EUR_PER_L).formula("(preț la pompă / (1 + TVA) − acciză rambursată) / curs EUR")
                .source(RuleValues.priceSource(context, "dieselExciseRefundLeiPerLitre")).add();
        context.calc("rules.price.nitrogen", "Prețul azotului", context.param("nitrogenEurPerKg"), Unit.EUR_PER_KG_N)
                .source(context.paramSource("nitrogenEurPerKg")).add();
        context.calc("rules.factor.diesel", "Factor de emisie motorină",
                RuleValues.factor(context, "dieselKgCo2PerLitre"), Unit.KG_CO2_PER_L)
                .source(RuleValues.factorSource(context, "dieselKgCo2PerLitre")).add();
        context.calc("rules.factor.nitrogen", "Factor de emisie azot",
                RuleValues.factor(context, "nitrogenKgCo2ePerKgN"), Unit.COUNT)
                .source(RuleValues.factorSource(context, "nitrogenKgCo2ePerKgN")).add();
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
        result.put("stageV", cfg.metricOrZero("stage_v_ok").signum() > 0);
        var withoutStage = result.putArray("tractorsWithoutStage");
        var withoutConsumption = result.putArray("tractorsWithoutConsumption");
        cfg.components().stream().filter(MachineryModule::isTractor).forEach(c -> {
            if (c.attribute(STAGE_V) == null) {
                withoutStage.add(c.componentId());
            }
            if (c.attribute(DIESEL_L_PER_HA) == null && c.attribute(DIESEL_SAVING_VS_OLD_PCT) == null) {
                withoutConsumption.add(c.componentId());
            }
        });
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
        context.calc("impact.nitrogen_horizon", "Azot economisit pe orizont",
                cfg.metric("nitrogen_saved_kg").multiply(years, MC), Unit.KG_N_PER_YEAR).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        if (!"TRACTOR".equals(line.category()) && !"COMBINE".equals(line.category())) {
            return;
        }
        BigDecimal hp = line.numbers().get("ENGINE_POWER_HP");
        if (hp != null) {
            attributes.put("hp", hp);
        }
        BigDecimal litresPerHa = line.numbers().containsKey("DIESEL_L_PER_HA") ? line.numbers().get("DIESEL_L_PER_HA")
                : offer.numbers().get("DIESEL_L_PER_HA");
        if (litresPerHa != null) {
            attributes.put(DIESEL_L_PER_HA, litresPerHa);
        }
        String stage = line.texts().get("EMISSION_STAGE");
        if (stage != null) {
            attributes.put(STAGE_V, STAGE_V_TEXT.matcher(stage).find() ? BigDecimal.ONE : BigDecimal.ZERO);
        }
    }
}
