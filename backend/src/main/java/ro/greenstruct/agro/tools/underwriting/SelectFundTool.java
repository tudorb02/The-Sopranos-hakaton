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
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * The fund behind a green option (README §3.1 and §3.3): the guarantee or the grant it draws on, whether that is
 * the module's primary fund or an alternative, and the module's other funds. Only for the bank's report: the
 * farmer sees "Credit verde Raiffeisen" (README §13).
 */
@Component
public class SelectFundTool implements ToolHandler {

    @Override
    public String name() {
        return "select_fund";
    }

    @Override
    public String description() {
        return "Returns the fund (F1-F6 of config/funds.json) behind a financing option: the guarantee or the grant "
                + "programme it uses, whether it is the module's primary fund or an alternative, and the module's "
                + "other funds with their availability. Call build_funding_stack first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["optionId"], "properties": {
                  "optionId": {"type": "string", "enum": ["A", "B", "C"]}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        FinancingOption option = context.workspace().option(Params.requiredText(input, "optionId"));
        JsonNode fund = FundsConfig.backing(context, option).orElseThrow(() -> new IllegalArgumentException(
                "Opțiunea " + option.optionId() + " nu folosește o garanție sau un grant din config/funds.json"));
        String fundId = fund.path("fundId").asText();
        JsonNode module = FundsConfig.module(context);
        String role;
        if (fundId.equals(module.path("primaryFund").asText())) {
            role = "PRIMARY";
        } else if (FundsConfig.moduleFundIds(context).contains(fundId)) {
            role = "ALTERNATIVE";
        } else {
            throw new IllegalArgumentException("Fondul " + fundId + " nu e prevăzut pentru modulul "
                    + context.module().moduleId());
        }
        if (fund.has("coveragePct")) {
            context.calc("fund.coverage", "Acoperirea garanției " + fundId,
                    Params.value(fund.path("coveragePct"), "funds." + fundId + ".coveragePct"), Unit.PCT)
                    .source(fund.path("coveragePct").path("sourceRo").asText(null)).add();
        }

        ObjectNode result = context.newResult();
        result.put("fundId", fundId);
        result.put("nameRo", fund.path("nameRo").asText());
        result.put("kind", fund.path("kind").asText());
        result.put("role", role);
        ArrayNode alternatives = result.putArray("alternatives");
        for (String otherId : FundsConfig.moduleFundIds(context)) {
            if (!otherId.equals(fundId)) {
                JsonNode other = FundsConfig.requireFund(context, otherId);
                alternatives.addObject().put("fundId", otherId).put("nameRo", other.path("nameRo").asText())
                        .put("status", FundsConfig.availability(context, other));
            }
        }
        return context.ok(result, "Fondul propus: " + fundId + " (" + fund.path("nameRo").asText() + ")");
    }
}
