package ro.greenstruct.agro.tools.underwriting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;

/** The green label of every component of a configuration, so no component is called green without a rule. */
@Component
public class GetLabelingRulesTool implements ToolHandler {

    @Override
    public String name() {
        return "get_labeling_rules";
    }

    @Override
    public String description() {
        return "Returns the label of each component of a configuration: TAXONOMY_ALIGNED (with the EU Taxonomy "
                + "activity), MARKET_GREEN, TRANSITION or NONE. Use only these labels in the report.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["configId"], "properties": {
                  "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration cfg = context.workspace().configuration(Params.requiredText(input, "configId"));
        ObjectNode result = context.newResult();
        ArrayNode rules = result.putArray("rules");
        cfg.components().forEach(component -> {
            ObjectNode node = rules.addObject();
            node.put("componentId", component.componentId());
            node.put("category", component.category());
            node.put("label", ComponentLabels.label(context, cfg, component));
            var rule = ComponentLabels.rule(context, component);
            if (rule != null && rule.taxonomyActivity() != null) {
                node.put("taxonomyActivity", rule.taxonomyActivity());
            }
        });
        return context.ok(result, "Am etichetat componentele configurației " + cfg.configId());
    }
}
