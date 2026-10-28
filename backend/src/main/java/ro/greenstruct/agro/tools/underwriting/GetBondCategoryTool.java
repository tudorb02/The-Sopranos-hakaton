package ro.greenstruct.agro.tools.underwriting;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * The category of the bank's green-bond framework (fund F2) for this module, README §3.3. The mapping is our
 * proposal; the final classification is the bank's, so the status is ELIGIBLE only as a proposal.
 */
@Component
public class GetBondCategoryTool implements ToolHandler {

    @Override
    public String name() {
        return "get_bond_category";
    }

    @Override
    public String description() {
        return "Returns the green-bond framework category (Agriculture and forestry, Renewable energy, Energy "
                + "efficiency, Pollution prevention) for the module and the amount of the green loan that can be "
                + "allocated to it. Call after the funding options were built.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "optionId": {"type": "string", "enum": ["A", "B", "C"], "description": "The green option; default B."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        JsonNode entry = Funds.moduleEntry(context);
        JsonNode categories = entry.path("bondCategories");
        String category = categories.path(0).asText();
        GreenTierResult tier = context.workspace().tier();
        FinancingOption option = context.workspace().option(input.path("optionId").asText("B"));

        ObjectNode result = context.newResult();
        result.put("category", category);
        ArrayNode all = result.putArray("frameworkCategories");
        categories.forEach(c -> all.add(c.asText()));
        boolean eligible = tier.tier().isGreen();
        result.put("status", eligible ? "ELIGIBLE" : "NOT_ELIGIBLE");
        result.put("noteRo", "Încadrare propusă de aplicație după denumirile din cadrul public al băncii; "
                + "încadrarea finală o face banca.");
        BigDecimal amount = eligible ? option.mainLoanEur() : BigDecimal.ZERO;
        context.calc("bond.eligible_amount", "Suma alocabilă în cadrul obligațiunilor verzi", amount, Unit.EUR)
                .formula("creditul verde principal, dacă nivelul este verde")
                .source(context.reference().funds().path("bondCategoriesSourceRo").asText(null)).add();
        return context.ok(result, "Categoria obligațiunilor verzi: " + category);
    }
}
