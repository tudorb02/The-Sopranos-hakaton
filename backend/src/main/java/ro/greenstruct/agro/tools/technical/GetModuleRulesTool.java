package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.Decimals;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/** The module's green threshold, norms, prices and factors, each as a calc with its source. */
@Component
public class GetModuleRulesTool implements ToolHandler {

    @Override
    public String name() {
        return "get_module_rules";
    }

    @Override
    public String description() {
        return "Returns the green threshold of the dossier's module, the norms, prices and emission factors used "
                + "by the calculations, and the upgrade catalog (ids, categories, roles). Call it first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.EMPTY_OBJECT;
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        var module = context.module();
        context.calculator().describeRules(context);

        ObjectNode result = context.newResult();
        result.put("indicator", module.indicator());
        result.put("calculator", module.calculator());
        result.put("thresholdKind", module.threshold().kind());
        ArrayNode catalog = result.putArray("catalog");
        context.catalog().path("items").forEach(item -> catalog.addObject()
                .put("catalogId", item.path("catalogId").asText())
                .put("category", item.path("category").asText())
                .put("role", item.path("role").asText())
                .put("nameRo", item.path("nameRo").asText()));
        return context.ok(result, "Rules of module " + module.nameRo() + " loaded");
    }
}
