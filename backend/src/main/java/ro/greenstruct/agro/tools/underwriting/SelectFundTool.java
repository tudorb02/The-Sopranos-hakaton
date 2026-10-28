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
import ro.greenstruct.agro.tools.Unit;

/**
 * README §3.3: the fund that finances the green loan and its alternatives, from config/funds.json. The AFIR grant (F6)
 * is only offered when check_program_eligibility found the farm eligible in an open session. The farmer never sees
 * this; it goes to the officer's report.
 */
@Component
public class SelectFundTool implements ToolHandler {

    @Override
    public String name() {
        return "select_fund";
    }

    @Override
    public String description() {
        return "Picks the Raiffeisen fund that finances this loan (F1–F6, README §3.3) for the module, plus the "
                + "alternatives that apply. F6 (AFIR grant) is listed only if the farm is eligible in an open session.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        JsonNode entry = Funds.moduleEntry(context);
        JsonNode primary = Funds.fund(context, entry.path("primaryFund").asText());
        ObjectNode result = context.newResult();
        result.put("fundCode", primary.path("fundId").asText());
        result.put("fundNameRo", primary.path("nameRo").asText());
        ArrayNode alternatives = result.putArray("alternatives");
        for (JsonNode alternative : entry.path("alternatives")) {
            String fundId = alternative.path("fundId").asText();
            if (!applicable(context, Funds.fund(context, fundId))) {
                continue;
            }
            alternatives.addObject().put("fundCode", fundId)
                    .put("fundNameRo", Funds.fund(context, fundId).path("nameRo").asText())
                    .put("noteRo", alternative.path("noteRo").asText());
        }
        if (primary.hasNonNull("coveragePct")) {
            context.calc("fund.guarantee_coverage", "Acoperirea garanției " + primary.path("fundId").asText(),
                    primary.path("coveragePct").path("value").decimalValue(), Unit.PCT)
                    .source(primary.path("coveragePct").path("sourceRo").asText(null)).add();
        }
        return context.ok(result, "Fondul propus: " + primary.path("fundId").asText() + ", " + primary.path("nameRo").asText());
    }

    /** F6 needs an eligible, open programme check; the other alternatives are always listed. */
    private static boolean applicable(ToolContext context, JsonNode fund) {
        if (!"F6".equals(fund.path("fundId").asText())) {
            return true;
        }
        for (JsonNode code : fund.path("programCodes")) {
            var check = context.workspace().programCheck(code.asText());
            if (check.isPresent() && "ELIGIBLE".equals(check.get().path("result").asText())
                    && "OPEN".equals(check.get().path("session").asText())) {
                return true;
            }
        }
        return false;
    }
}
