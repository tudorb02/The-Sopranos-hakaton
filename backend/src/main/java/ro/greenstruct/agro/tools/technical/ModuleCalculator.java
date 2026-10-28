package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * The calculation of one module (category): today's situation, the indicator and savings of a configuration, the
 * calcs shown for it, and the few module-specific inputs of DNSH and impact. Selected by the module's
 * {@code calculator} field in config/modules/&lt;id&gt;.json; a new module is one new Spring component, no other
 * tool changes. Every number comes from engine/ functions and config/, never from the model.
 */
public interface ModuleCalculator {

    /** The value of {@code calculator} in the module's config file. */
    String id();

    /** compute_baseline: today's consumption on the selected parcels; stores the baseline in the workspace. */
    ToolOutput baseline(JsonNode input, ToolContext context);

    /**
     * Metrics of a configuration against the stored baseline. Must contain indicator_pct (the green indicator),
     * co2_avoided_t and the savings metrics named by {@link #savingsMetrics()}; total_cost is added by the caller.
     */
    Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components);

    /** The module-specific calcs of a configuration (the caller adds total_cost, upgrade_cost and CO2). */
    List<Calc> emit(ToolContext context, Configuration configuration);

    /** Metric name → short key of the yearly savings in EUR that build_scenario adds up (savings_water_eur → water_eur). */
    Map<String, String> savingsMetrics();

    /** get_module_rules: the thresholds, norms and prices of the module as calcs. */
    void describeRules(ToolContext context);

    /** check_dnsh_inputs: the facts the DNSH objectives need, beyond parcels and risks. */
    void dnshInputs(ToolContext context, Configuration configuration, ObjectNode result);

    /** calculate_impact: impact over the comparison horizon, as calcs. */
    void horizonImpact(ToolContext context, Configuration configuration, BigDecimal years);

    /** Whether the configuration is sized sensibly (e.g. power per hectare); true when the module has no such rule. */
    default boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        return true;
    }

    /** Extra attributes of an offer line by category (efficiency, power, kWp, ...), read from the extraction. */
    default void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
    }
}
