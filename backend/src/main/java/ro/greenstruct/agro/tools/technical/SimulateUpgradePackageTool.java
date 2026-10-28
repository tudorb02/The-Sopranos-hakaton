package ro.greenstruct.agro.tools.technical;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;

/** Creates a new configuration from a base one plus catalog items, and stores it for the next agents. */
@Component
public class SimulateUpgradePackageTool implements ToolHandler {

    @Override
    public String name() {
        return "simulate_upgrade_package";
    }

    @Override
    public String description() {
        return "Creates configuration configId from baseConfigId by adding catalog items and/or replacing named "
                + "components, then computes its indicator, savings and cost. Stored for the funding agent.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["baseConfigId", "configId"], "properties": {
                  "baseConfigId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"},
                  "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"},
                  "add": {"type": "array", "items": {"type": "string"}, "description": "Catalog ids to add."},
                  "replace": {"type": "object", "additionalProperties": {"type": "string"},
                    "description": "componentId → catalogId to put in its place."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration base = context.workspace().configuration(Params.requiredText(input, "baseConfigId"));
        String configId = Params.requiredText(input, "configId");
        if (configId.equals(base.configId())) {
            throw new IllegalArgumentException("configId trebuie să fie diferit de baseConfigId");
        }
        Map<String, String> replace = new LinkedHashMap<>();
        input.path("replace").fields().forEachRemaining(e -> replace.put(e.getKey(), e.getValue().asText()));

        var components = UpgradePackages.apply(context, base, Params.textList(input, "add"), replace);
        Configuration cfg = ConfigurationMetrics.build(context, configId, base.configId(), components);
        context.workspace().putConfiguration(cfg);
        ConfigurationMetrics.emit(context, cfg, UpgradePackages.root(context, cfg));

        ObjectNode result = context.newResult();
        result.put("configId", configId);
        result.put("thresholdResult", cfg.passesThreshold() ? "PASS" : "FAIL");
        result.put("meetsSafetyMargin", ConfigurationMetrics.meetsSafetyMargin(context, cfg));
        if (cfg.metrics().containsKey("hp_per_ha") || cfg.metrics().containsKey("export_share_pct")) {
            result.put("sizing", ConfigurationMetrics.sizingOk(context, cfg.metrics()) ? "PASS" : "FAIL");
        }
        return context.ok(result, "Configurația " + configId + (cfg.passesThreshold() ? " trece" : " nu trece")
                + " pragul verde");
    }
}
