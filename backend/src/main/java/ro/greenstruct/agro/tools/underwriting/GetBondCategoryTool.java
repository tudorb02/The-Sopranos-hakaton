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

/** The categories of Raiffeisen's green bond framework (F2) that fit the module (README §3.3). */
@Component
public class GetBondCategoryTool implements ToolHandler {

    @Override
    public String name() {
        return "get_bond_category";
    }

    @Override
    public String description() {
        return "Returns the categories of the bank's green bond framework that fit the dossier's module; the first "
                + "one is the proposed category. The bank makes the final classification.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.EMPTY_OBJECT;
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        JsonNode categories = context.reference().funds().path("bondCategories");
        ObjectNode result = context.newResult();
        ArrayNode fitting = result.putArray("categories");
        for (JsonNode id : FundsConfig.module(context).path("bondCategories")) {
            JsonNode category = Params.findById(categories, "categoryId", id.asText());
            fitting.addObject().put("categoryId", id.asText()).put("nameEn", category.path("nameEn").asText())
                    .put("nameRo", category.path("nameRo").asText());
        }
        if (fitting.isEmpty()) {
            throw new IllegalArgumentException("Module " + context.module().moduleId()
                    + " has no green bond category in config/funds.json");
        }
        result.put("proposed", fitting.get(0).path("categoryId").asText());
        result.put("sourceRo", context.reference().funds().path("bondCategoriesSourceRo").asText());
        return context.ok(result, "Proposed category: " + fitting.get(0).path("nameEn").asText());
    }
}
