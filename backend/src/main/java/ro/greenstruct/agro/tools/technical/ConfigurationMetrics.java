package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.CropArea;
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
import static ro.greenstruct.agro.engine.Decimals.fraction;
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
        Map<String, BigDecimal> metrics = new HashMap<>(context.calculator().metrics(context, components));
        metrics.put("total_cost", components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        boolean passes = meetsThreshold(context, metrics.get("indicator_pct")) && sizingOk(context, metrics);
        return new Configuration(configId, baseConfigId, components, metrics, passes);
    }

    /** Module sizing rule, e.g. machinery: fleet power per hectare within the AFIR limit. */
    public static boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        return context.calculator().sizingOk(context, metrics);
    }

    /**
     * MIN_PCT modules: indicator at or above the threshold. Modules without a percentage threshold (BY_NATURE,
     * e.g. energy) are eligible as such: only the module's sizing and site checks decide. CERTIFICATION (organic) has
     * no numeric threshold either: its indicator_pct is the share of the farm certified or in conversion, which is
     * 0 without a certificate or a conversion contract, so it must be above 0.
     */
    private static boolean meetsThreshold(ToolContext context, java.math.BigDecimal indicatorPct) {
        String kind = context.module().threshold().kind();
        if ("CERTIFICATION".equals(kind)) {
            return indicatorPct.signum() > 0;
        }
        return !"MIN_PCT".equals(kind) || indicatorPct.compareTo(RuleValues.thresholdPct(context)) >= 0;
    }

    public static boolean meetsSafetyMargin(ToolContext context, Configuration configuration) {
        if (!"MIN_PCT".equals(context.module().threshold().kind())) {
            return configuration.passesThreshold();
        }
        return configuration.metric("indicator_pct")
                .compareTo(RuleValues.thresholdPct(context).add(RuleValues.safetyMarginPct(context))) >= 0;
    }

    /** The calcs shown for a configuration; keys are prefixed with the configId (cfg_initial.water_saving_pct). */
    public static List<Calc> emit(ToolContext context, Configuration cfg, Configuration root) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "total_cost", "Total cost " + cfg.configId(), cfg.totalCost(), Unit.EUR).add());
        if (root != null && !root.configId().equals(cfg.configId())) {
            calcs.add(context.calc(p + "upgrade_cost", "Extra cost over the initial offer",
                    cfg.totalCost().subtract(root.totalCost()), Unit.EUR).add());
        }
        calcs.add(context.calc(p + "indicator", "Green indicator of the configuration", cfg.metric("indicator_pct"), Unit.PCT)
                .formula("module indicator against the current situation").add());
        for (var component : cfg.components()) {
            calcs.add(context.calc(p + "cmp." + component.componentId() + ".cost", "Cost: " + component.nameRo(),
                    component.costEur(), Unit.EUR).add());
        }
        calcs.addAll(context.calculator().emit(context, cfg));
        calcs.add(context.calc(p + "co2_avoided", "CO₂ avoided per year", cfg.metric("co2_avoided_t"),
                Unit.T_CO2_PER_YEAR).add());
        return calcs;
    }
}
