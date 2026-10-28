package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.affordability.AffordabilityCalculator;
import ro.greenstruct.agro.engine.affordability.AffordabilityResult;
import ro.greenstruct.agro.engine.affordability.DebtServiceCoverage;
import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

import static ro.greenstruct.agro.engine.Decimals.HUNDRED;
import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Can the farm carry the loan? FAIL when the DSCR with the investment's savings is under the minimum;
 * PASS_WITH_WARNING when some months of today's cash flow run short of the installment; PASS otherwise.
 * The bridge loan is excluded: it is repaid by the grant.
 */
@Component
public class CheckAffordabilityTool implements ToolHandler {

    @Override
    public String name() {
        return "check_affordability";
    }

    @Override
    public String description() {
        return "Checks each option against the minimum DSCR (today's net cash flow from Open Banking plus the "
                + "option's yearly savings, over the heaviest loan year) and lists the months where the installment "
                + "exceeds that month's cash flow. The first-year ratio to today's cash flow is reported for information.";
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
            throw new IllegalArgumentException("Fără acord Open Banking nu putem verifica capacitatea de plată");
        }
        // An investment loan is repaid from today's cash flow plus the savings the investment brings, so the
        // minimum is on the DSCR with savings. The old rule (installments ≤ 40% of today's cash flow) failed both
        // the classic and the green biogas loan and then still recommended the classic one (29.10.2026).
        BigDecimal minDscr = RuleValues.financingDefault(context, "minDscr");

        ObjectNode result = context.newResult();
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            if (option.schedule() == null) {
                throw new IllegalArgumentException("Apelează întâi build_scenario pentru opțiunea " + optionId);
            }
            // months where today's cash flow alone does not cover the installment are reported as a warning
            AffordabilityResult check = AffordabilityCalculator.check(option.schedule(), cashflow.netByCalendarMonth(),
                    BigDecimal.ONE);
            DebtServiceCoverage.Result coverage = DebtServiceCoverage.compute(cashflow.annualNetEur(),
                    option.total("savings_year"), option.schedule());
            boolean meetsMinimum = coverage.dscr() != null && coverage.dscr().compareTo(minDscr) >= 0;
            BigDecimal firstYear = option.schedule().installments().stream().limit(12)
                    .map(i -> i.paymentEur()).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal ratio = firstYear.divide(cashflow.annualNetEur(), MC).multiply(HUNDRED, MC);
            context.calc("option_" + optionId.toLowerCase() + ".affordability_ratio",
                    "Ratele din primul an față de cashflow-ul net", ratio, Unit.PCT)
                    .formula("rate pe 12 luni / cashflow net anual (Open Banking)").add();

            String verdict = !meetsMinimum ? "FAIL"
                    : check.deficitMonths().isEmpty() ? "PASS" : "PASS_WITH_WARNING";
            ObjectNode node = result.putObject(optionId);
            node.put("result", verdict);
            List<String> deficits = check.deficitMonths().stream().map(Object::toString).toList();
            node.set("deficitMonths", context.mapper().valueToTree(deficits));
        }
        return context.ok(result, "Am verificat capacitatea de plată");
    }
}
