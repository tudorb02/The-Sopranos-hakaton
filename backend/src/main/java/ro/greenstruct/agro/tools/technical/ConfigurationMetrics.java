package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.engine.machinery.FuelComparison;
import ro.greenstruct.agro.engine.machinery.MachineryCalculator;
import ro.greenstruct.agro.engine.machinery.PowerCheck;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * Computes a configuration's indicator and savings with the module's calculator, always against the
 * baseline from compute_baseline. Shared by compute_indicator, search_upgrades and simulate_upgrade_package.
 */
public final class ConfigurationMetrics {

    private ConfigurationMetrics() {
    }

    public static Configuration build(ToolContext context, String configId, String baseConfigId,
                                      List<InvestmentComponent> components) {
        Map<String, BigDecimal> metrics = switch (calculator(context)) {
            case "irrigation" -> irrigation(context, components);
            case "machinery" -> machinery(context, components);
            default -> throw new IllegalArgumentException("Modulul " + context.module().moduleId()
                    + " nu are încă un calculator");
        };
        metrics.put("total_cost", components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        boolean passes = metrics.get("indicator_pct").compareTo(RuleValues.thresholdPct(context)) >= 0
                && sizingOk(context, metrics) && emissionStageOk(metrics);
        return new Configuration(configId, baseConfigId, components, metrics, passes);
    }

    /** Machinery only: fleet power per hectare within the AFIR sizing limit. */
    public static boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        BigDecimal hpPerHa = metrics.get("hp_per_ha");
        return hpPerHa == null || hpPerHa.compareTo(context.param("maxHpPerHa")) <= 0;
    }

    /** Machinery only: every tractor or combine whose offer states the emission stage is Stage V (README §6.3). */
    public static boolean emissionStageOk(Map<String, BigDecimal> metrics) {
        BigDecimal stage = metrics.get("emission_stage_ok");
        return stage == null || stage.signum() > 0;
    }

    public static boolean meetsSafetyMargin(ToolContext context, Configuration configuration) {
        return configuration.metric("indicator_pct")
                .compareTo(RuleValues.thresholdPct(context).add(RuleValues.safetyMarginPct(context))) >= 0;
    }

    /** The calcs shown for a configuration; keys are prefixed with the configId (cfg_initial.water_saving_pct). */
    public static List<Calc> emit(ToolContext context, Configuration cfg, Configuration root) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "total_cost", "Cost total " + cfg.configId(), cfg.totalCost(), Unit.EUR).add());
        if (root != null && !root.configId().equals(cfg.configId())) {
            calcs.add(context.calc(p + "upgrade_cost", "Cost suplimentar față de oferta inițială",
                    cfg.totalCost().subtract(root.totalCost()), Unit.EUR).add());
        }
        if ("irrigation".equals(calculator(context))) {
            calcs.add(context.calc(p + "water", "Apă extrasă pe an", cfg.metric("water_m3"), Unit.M3_PER_YEAR)
                    .formula("NIR × (1 − s senzori) / η").add());
            calcs.add(context.calc(p + "water_saving_pct", "Economie de apă", cfg.metric("indicator_pct"), Unit.PCT)
                    .formula("1 − apă nouă / apă actuală").add());
            calcs.add(context.calc(p + "water_saved", "Apă economisită pe an", cfg.metric("water_saved_m3"),
                    Unit.M3_PER_YEAR).add());
            calcs.add(context.calc(p + "pumping_energy", "Energie de pompare", cfg.metric("pumping_kwh"),
                    Unit.KWH_PER_YEAR).formula("m³ × (H ridicare + H presiune) × 0,002725 / η pompă").add());
            if (cfg.metricOrZero("pv_kwh").signum() > 0) {
                calcs.add(context.calc(p + "pv_kwh", "Energie produsă de pompa solară", cfg.metric("pv_kwh"),
                        Unit.KWH_PER_YEAR).formula("min(kWp × kWh/kWp, consum de pompare)").add());
                calcs.add(context.calc(p + "grid_kwh", "Energie rămasă din rețea", cfg.metric("grid_kwh"),
                        Unit.KWH_PER_YEAR).add());
            }
            calcs.add(context.calc(p + "energy_saved", "Energie economisită pe an", cfg.metric("energy_saved_kwh"),
                    Unit.KWH_PER_YEAR).formula("kWh azi − kWh din rețea după investiție (negativ = consum mai mare)")
                    .add());
        } else {
            calcs.add(context.calc(p + "tractor_saving_pct", "Economie din tractoare (vechime, flotă înlocuită)",
                    cfg.metric("tractor_saving_pct"), Unit.PCT)
                    .formula("(1 − g/kWh tractor ofertat / g/kWh tractor înlocuit) × tractoare scoase / flotă").add());
            calcs.add(context.calc(p + "fuel_saving_pct", "Economie de motorină pe hectar", cfg.metric("fuel_saving_pct"),
                    Unit.PCT).formula("1 − l/ha nou / l/ha azi = 1 − (1 − s_tractor) × (1 − s_precizie)").add());
            calcs.add(context.calc(p + "fuel_saved", "Motorină economisită pe an", cfg.metric("fuel_saved_l"),
                    Unit.L_PER_YEAR).add());
            calcs.add(context.calc(p + "fuel_use", "Consum de motorină după investiție", cfg.metric("fuel_l"),
                    Unit.L_PER_YEAR).add());
            calcs.add(context.calc(p + "hp_per_ha", "Putere pe hectar", cfg.metric("hp_per_ha"), Unit.HP_PER_HA)
                    .formula("CP total / ha").add());
            if (cfg.metricOrZero("precision_cost").signum() > 0) {
                calcs.add(context.calc(p + "nitrogen_saving_pct", "Reducerea dozei de azot",
                        cfg.metric("nitrogen_saving_pct"), Unit.PCT).add());
                calcs.add(context.calc(p + "nitrogen_saved", "Azot economisit pe an", cfg.metric("nitrogen_saved_kg"),
                        Unit.KG_N_PER_YEAR).formula("ha × kg N/ha × reducerea dozei").add());
                calcs.add(context.calc(p + "nitrogen_cost_saved", "Cost cu azotul economisit pe an",
                        cfg.metric("savings_nitrogen_eur"), Unit.EUR_PER_YEAR).formula("kg N × preț azot").add());
                calcs.add(context.calc(p + "precision_share", "Ponderea agriculturii de precizie",
                        cfg.metric("precision_share_pct"), Unit.PCT).formula("cost precizie / cost total").add());
            }
        }
        calcs.add(context.calc(p + "co2_avoided", "irrigation".equals(calculator(context)) ? "CO₂ evitat pe an"
                        : "CO₂e evitat pe an (motorină + azot)", cfg.metric("co2_avoided_t"), Unit.T_CO2_PER_YEAR)
                .formula("irrigation".equals(calculator(context)) ? "kWh economisiți × factor rețea"
                        : "(Δ litri × 2,68 + Δ kg N × 4,29) / 1000").add());
        return calcs;
    }

    private static String calculator(ToolContext context) {
        return context.module().calculator() == null ? "" : context.module().calculator();
    }

    /** README §6.1: same net need as today, the configuration's system and sensors, its working pressure. */
    private static Map<String, BigDecimal> irrigation(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        IrrigationSystem system = IrrigationFacts.system(context, IrrigationFacts.systemOf(context, components),
                IrrigationFacts.hasSensors(components));
        BigDecimal water = IrrigationCalculator.withdrawalM3(baseline.get("net_need_m3"), system);
        BigDecimal baselineWater = baseline.get("water_m3");
        BigDecimal pumping = IrrigationCalculator.pumpingKwh(water, baseline.get("lift_m"), system.pressureHeadM(),
                RuleValues.factor(context, "pumpingKwhPerM3PerM"), context.param("pumpEfficiencyPct"));
        BigDecimal pv = IrrigationCalculator.solarCoveredKwh(pumping, sumAttribute(components, "pvKwp"),
                context.param("pvYieldKwhPerKwp"));
        BigDecimal grid = pumping.subtract(pv);
        BigDecimal energySaved = baseline.get("energy_kwh").subtract(grid);

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("water_m3", water);
        m.put("indicator_pct", toPct(BigDecimal.ONE.subtract(water.divide(baselineWater, MC))));
        m.put("water_saved_m3", baselineWater.subtract(water));
        m.put("efficiency_pct", system.efficiencyPct());
        m.put("demand_reduction_pct", system.demandReductionPct());
        m.put("pumping_kwh", pumping);
        m.put("pv_kwh", pv);
        m.put("grid_kwh", grid);
        m.put("energy_saved_kwh", energySaved);
        m.put("co2_avoided_t", ImpactCalculator.co2AvoidedTonnes(energySaved,
                RuleValues.factor(context, "gridKgCo2PerKwh")));
        m.put("savings_water_eur", m.get("water_saved_m3").multiply(baseline.get("water_price_eur_m3"), MC));
        m.put("savings_energy_eur", energySaved.multiply(RuleValues.price(context, "electricityEurPerKwh"), MC));
        m.put("has_water_meter", components.stream().anyMatch(c -> "WATER_METER".equals(c.category()))
                ? BigDecimal.ONE : BigDecimal.ZERO);
        return m;
    }

    /**
     * README §6.3: diesel per hectare (the offered tractors by age, the precision package), nitrogen from variable
     * rate; the green indicator is the larger of the two reductions (≥ 20% on either passes).
     */
    private static Map<String, BigDecimal> machinery(ToolContext context, List<InvestmentComponent> components) {
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
        FuelComparison fuel = MachineryCalculator.fuel(area, baseline.get("fuel_per_ha"), fuelSavings);

        BigDecimal nitrogenPerHa = baseline.get("nitrogen_kg").divide(area, MC);
        BigDecimal nitrogenSavingPct = sumAttribute(components, "nitrogenSavingPct");
        BigDecimal nitrogenSaved = MachineryCalculator.nitrogenSavedKg(area, nitrogenPerHa, nitrogenSavingPct);
        BigDecimal precisionCost = components.stream().filter(c -> c.category().startsWith("PRECISION_"))
                .map(InvestmentComponent::costEur).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCost = components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        PowerCheck power = MachineryCalculator.power(hp, area, context.param("maxHpPerHa"));
        boolean stageOk = components.stream()
                .filter(c -> ("TRACTOR".equals(c.category()) || "COMBINE".equals(c.category()))
                        && c.attribute(EquipmentAge.STAGE_V) != null)
                .allMatch(c -> c.attribute(EquipmentAge.STAGE_V).signum() > 0);

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("tractor_count", tractors);
        m.put("tractor_saving_pct", tractorSaving);
        m.put("hp_total", hp);
        m.put("hp_per_ha", power.hpPerHa());
        m.put("fuel_l", fuel.proposedLitres());
        m.put("fuel_saved_l", fuel.savedLitres());
        m.put("fuel_saving_pct", fuel.savingPct());
        m.put("nitrogen_saving_pct", nitrogenSavingPct);
        m.put("indicator_pct", fuel.savingPct().max(nitrogenSavingPct));
        m.put("nitrogen_saved_kg", nitrogenSaved);
        m.put("precision_cost", precisionCost);
        m.put("precision_share_pct", totalCost.signum() == 0 ? BigDecimal.ZERO
                : toPct(precisionCost.divide(totalCost, MC)));
        m.put("emission_stage_ok", stageOk ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("co2_avoided_t", ImpactCalculator.co2eFromDieselAndNitrogenTonnes(fuel.savedLitres(),
                RuleValues.factor(context, "dieselKgCo2PerLitre"), nitrogenSaved,
                RuleValues.factor(context, "nitrogenKgCo2ePerKgN")));
        m.put("savings_fuel_eur", fuel.savedLitres().multiply(RuleValues.dieselNetEurPerLitre(context), MC));
        m.put("savings_nitrogen_eur", nitrogenSaved.multiply(RuleValues.price(context, "nitrogenEurPerKgN"), MC));
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

    private static BigDecimal sumAttribute(List<InvestmentComponent> components, String attribute) {
        return components.stream().map(c -> c.attribute(attribute)).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
