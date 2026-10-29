package ro.greenstruct.agro.tools.underwriting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;

/** The objective the investment contributes to and the five DNSH checks of the module, with their evidence. */
@Component
public class GetDnshCriteriaTool implements ToolHandler {

    @Override
    public String name() {
        return "get_dnsh_criteria";
    }

    @Override
    public String description() {
        return "Returns the environmental objective the module contributes to and the DNSH criterion for each of "
                + "the other five objectives, with the evidence expected. Combine with check_dnsh_inputs facts.";
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
        ObjectNode result = context.newResult();
        result.put("substantialContribution", context.module().substantialContribution());
        ArrayNode objectives = result.putArray("objectives");
        context.module().dnsh().forEach(check -> objectives.addObject()
                .put("objective", check.objective())
                .put("checkRo", check.checkRo())
                .put("evidence", check.evidence()));
        return context.ok(result, "Loaded the module's DNSH criteria");
    }
}
