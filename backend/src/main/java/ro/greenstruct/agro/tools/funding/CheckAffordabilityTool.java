package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.affordability.AffordabilityCalculator;
import ro.greenstruct.agro.engine.affordability.AffordabilityResult;
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
 * Do the first year's installments fit the farm's Open Banking cash flow? PASS when the yearly ratio is under
 * the limit and no month runs short; PASS_WITH_WARNING when some months run short; FAIL over the limit.
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
        return "Checks each option's first-year installments against the farm's net cash flow from Open Banking: "
                + "yearly ratio against the limit and months where the installment exceeds that month's cash flow.";
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
        BigDecimal limitPct = RuleValues.financingDefault(context, "affordabilityLimitPct");
        BigDecimal minDscr = HUNDRED.divide(limitPct, MC);

        ObjectNode result = context.newResult();
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            if (option.schedule() == null) {
                throw new IllegalArgumentException("Apelează întâi build_scenario pentru opțiunea " + optionId);
            }
            AffordabilityResult check = AffordabilityCalculator.check(option.schedule(), cashflow.netByCalendarMonth(),
                    minDscr);
            BigDecimal firstYear = option.schedule().installments().stream().limit(12)
                    .map(i -> i.paymentEur()).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal ratio = firstYear.divide(cashflow.annualNetEur(), MC).multiply(HUNDRED, MC);
            context.calc("option_" + optionId.toLowerCase() + ".affordability_ratio",
                    "Ratele din primul an față de cashflow-ul net", ratio, Unit.PCT)
                    .formula("rate pe 12 luni / cashflow net anual (Open Banking)").add();

            String verdict = !check.meetsMinimum() ? "FAIL"
                    : check.deficitMonths().isEmpty() ? "PASS" : "PASS_WITH_WARNING";
            ObjectNode node = result.putObject(optionId);
            node.put("result", verdict);
            List<String> deficits = check.deficitMonths().stream().map(Object::toString).toList();
            node.set("deficitMonths", context.mapper().valueToTree(deficits));
        }
        return context.ok(result, "Am verificat capacitatea de plată");
    }
}
