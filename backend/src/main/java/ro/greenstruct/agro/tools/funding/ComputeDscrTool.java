package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.affordability.DebtServiceCoverage;
import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/** README §4 step 7: DSCR = (annual operating cash flow + annual savings) / (instalments + interest per year). */
@Component
public class ComputeDscrTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_dscr";
    }

    @Override
    public String description() {
        return "Computes the DSCR of an option: (annual operating cash flow from Open Banking + yearly savings of the "
                + "financed configuration) / annual debt service. The lowest full loan year counts. Call it after "
                + "build_scenario.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["optionIds"], "properties": {
                  "optionIds": {"type": "array", "minItems": 1, "items": {"type": "string", "enum": ["A", "B", "C"]}}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        CashflowInfo cashflow = context.farm().cashflow();
        if (cashflow == null) {
            throw new IllegalArgumentException("Fără acord Open Banking nu putem calcula DSCR-ul");
        }
        ObjectNode result = context.newResult();
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            if (option.schedule() == null) {
                throw new IllegalArgumentException("Apelează întâi build_scenario pentru opțiunea " + optionId);
            }
            BigDecimal savings = option.total("savings_year");
            DebtServiceCoverage.Result dscr = DebtServiceCoverage.compute(cashflow.annualNetEur(), savings,
                    option.schedule());
            if (dscr.dscr() == null) {
                throw new IllegalArgumentException("Opțiunea " + optionId + " nu are rate de plătit");
            }
            context.calc("option_" + optionId.toLowerCase() + ".dscr", "DSCR, opțiunea " + optionId, dscr.dscr(),
                    Unit.RATIO).formula("(cashflow operațional anual + economii anuale) / (rate + dobânzi pe an), "
                    + "cel mai slab an complet").source("Open Banking + economiile configurației").add();
            result.putObject(optionId).put("dscrAbove1", dscr.dscr().compareTo(BigDecimal.ONE) >= 0);
        }
        return context.ok(result, "Am calculat DSCR-ul");
    }
}
