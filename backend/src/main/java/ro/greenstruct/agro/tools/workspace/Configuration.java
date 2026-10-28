package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * An investment variant (cfg_initial = the offer, cfg_recommended = after upgrades). metrics keep full
 * precision for the next tools: total_cost, indicator_pct, water_m3, water_saved_m3, energy_saved_kwh,
 * fuel_saved_l, inputs_saved_eur, co2_avoided_t, ...
 */
public record Configuration(
        String configId,
        String baseConfigId,
        List<InvestmentComponent> components,
        Map<String, BigDecimal> metrics,
        boolean passesThreshold) {

    public Configuration {
        components = List.copyOf(components);
        metrics = Map.copyOf(metrics);
    }

    public BigDecimal metric(String name) {
        BigDecimal value = metrics.get(name);
        if (value == null) {
            throw new IllegalStateException("Configurația " + configId + " nu are metrica " + name);
        }
        return value;
    }

    public BigDecimal metricOrZero(String name) {
        return metrics.getOrDefault(name, BigDecimal.ZERO);
    }

    public BigDecimal totalCost() {
        return metric("total_cost");
    }
}
