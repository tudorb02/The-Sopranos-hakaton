package ro.greenstruct.agro.tools.underwriting;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.technical.EquipmentAge;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * Green label of one component: TAXONOMY_ALIGNED, MARKET_GREEN, TRANSITION or NONE, from the module's
 * labels block. CONFIG_PASSES rules apply only when the whole configuration passes the threshold; second-hand
 * equipment gets the rule's usedLabel (a used diesel tractor is not labelled transition).
 */
public final class ComponentLabels {

    private ComponentLabels() {
    }

    public static ModuleDefinition.LabelRule rule(ToolContext context, InvestmentComponent component) {
        return context.module().labels() == null ? null : context.module().labels().get(component.category());
    }

    public static String label(ToolContext context, Configuration configuration, InvestmentComponent component) {
        ModuleDefinition.LabelRule rule = rule(context, component);
        if (rule == null) {
            return "NONE";
        }
        if ("CONFIG_PASSES".equals(rule.when()) && !configuration.passesThreshold()) {
            return "NONE";
        }
        if (rule.usedLabel() != null && EquipmentAge.isUsed(component)) {
            return rule.usedLabel();
        }
        return rule.label();
    }

    public static boolean isGreen(String label) {
        return "TAXONOMY_ALIGNED".equals(label) || "MARKET_GREEN".equals(label);
    }
}
