package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.affordability.DebtServiceCoverage;
import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * DSCR of README §4 step 7 for each option: the farm's net cash flow plus the option's savings, over the heaviest
 * loan year. The bridge loan is left out: it is repaid from the grant, not from the farm's cash flow.
 */
@Component
public class ComputeDscrTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_dscr";
    }

    @Override
    public String description() {
        return "Computes each option's DSCR: (the farm's annual net cash flow from Open Banking + the option's yearly "
                + "savings) / the principal and interest due in a loan year, the lowest over the full loan years. "
                + "The bridge loan, repaid from the grant, is left out. Call build_scenario first.";
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
            throw new IllegalArgumentException("Without Open Banking consent we cannot compute the DSCR");
        }
        ObjectNode result = context.newResult();
        ArrayNode computed = result.putArray("optionIds");
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            if (option.schedule() == null) {
                throw new IllegalArgumentException("Call build_scenario first for option " + optionId);
            }
            DebtServiceCoverage.Result coverage = DebtServiceCoverage.compute(cashflow.annualNetEur(),
                    option.total("savings_year"), option.schedule());
            if (coverage.dscr() == null) {
                throw new IllegalArgumentException("Option " + optionId + " has no instalments to pay");
            }
            String p = "option_" + optionId.toLowerCase() + ".";
            BigDecimal heaviestYear = coverage.debtServiceByYearEur().stream().max(BigDecimal::compareTo).orElseThrow();
            Calc debtService = context.calc(p + "debt_service_year", "Principal and interest in the heaviest loan year",
                    heaviestYear, Unit.EUR_PER_YEAR).add();
            context.calc(p + "dscr", "DSCR: instalment coverage from cash flow and savings", coverage.dscr(), Unit.RATIO)
                    .formula("(annual net cash flow + annual savings) / yearly principal and interest, minimum over the loan years")
                    .source("Open Banking (12-month cash flow)").dependsOn(debtService).add();
            computed.add(optionId);
        }
        return context.ok(result, "Computed the DSCR for " + computed.size() + " options");
    }
}
