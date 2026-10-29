package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.finance.FinancialMath;
import ro.greenstruct.agro.engine.finance.ScenarioComparison;
import ro.greenstruct.agro.engine.finance.ScenarioCost;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.TWELVE;

/**
 * Net advantage of one option over another and where it comes from (grant, investment, interest,
 * collateral, savings), plus how fast the extra investment pays back from extra savings alone.
 */
@Component
public class CompareScenariosTool implements ToolHandler {

    @Override
    public String name() {
        return "compare_scenarios";
    }

    @Override
    public String description() {
        return "Compares two options over the horizon: net advantage of the second over the first, its drivers "
                + "(grant, investment, interest, collateral, savings) and the payback of the extra investment.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["optionIds"], "properties": {
                  "optionIds": {"type": "array", "minItems": 2, "maxItems": 2,
                    "items": {"type": "string", "enum": ["A", "B", "C"]},
                    "description": "[baseline, proposed], e.g. [\\"A\\", \\"B\\"]."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        List<String> ids = Params.textList(input, "optionIds");
        if (ids.size() != 2) {
            throw new IllegalArgumentException("optionIds must have exactly two options: [baseline, proposed]");
        }
        FinancingOption a = context.workspace().option(ids.get(0));
        FinancingOption b = context.workspace().option(ids.get(1));
        ScenarioComparison comparison = ScenarioComparison.of(cost(a), cost(b));

        context.calc("compare.net_advantage", "Net advantage of " + b.optionId() + " over " + a.optionId(),
                comparison.netAdvantageEur(), Unit.EUR)
                .formula("net cost " + a.optionId() + " − net cost " + b.optionId()).add();
        driver(context, "grant", b.total("grant").subtract(a.total("grant")));
        driver(context, "investment", a.total("capex").subtract(b.total("capex")));
        driver(context, "interest", a.total("interest").subtract(b.total("interest")));
        driver(context, "collateral", a.total("collateral").subtract(b.total("collateral")));
        driver(context, "savings", b.total("savings_horizon").subtract(a.total("savings_horizon")));

        BigDecimal extraCapex = b.total("capex").subtract(a.total("capex"));
        BigDecimal extraMonthlySavings = b.total("savings_year").subtract(a.total("savings_year")).divide(TWELVE, MC);
        if (extraCapex.signum() > 0) {
            FinancialMath.paybackMonths(extraCapex, extraMonthlySavings).ifPresent(months ->
                    context.calc("compare.upgrade_payback", "Payback of the extra investment from savings", months,
                            Unit.MONTHS).formula("extra cost / extra monthly saving (excluding grant)").add());
        }

        ObjectNode result = context.newResult();
        result.put("better", comparison.proposedIsBetter() ? b.optionId() : a.optionId());
        return context.ok(result, "Option " + (comparison.proposedIsBetter() ? b.optionId() : a.optionId())
                + " costs less over the analysed horizon");
    }

    private static ScenarioCost cost(FinancingOption option) {
        return new ScenarioCost(option.optionId(), option.total("capex"), option.total("grant"),
                option.total("interest"), option.total("collateral"), option.total("savings_horizon"));
    }

    private static void driver(ToolContext context, String name, BigDecimal value) {
        if (value.signum() != 0) {
            context.calc("compare.driver." + name, "Contribution to the advantage: " + name, value, Unit.EUR).add();
        }
    }
}
