package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.finance.Installment;
import ro.greenstruct.agro.engine.organic.OrganicCalculator;
import ro.greenstruct.agro.engine.organic.Tranche;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.technical.OrganicPlans;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * Organic module, README §4 step 7 and §6 category 6: the monthly liquidity gap of every conversion year with the
 * instalments of the option's schedule, max(0, expenses + instalments − revenue − subsidies) against the conventional
 * farm, and whether the APIA pre-financing (F5) covers it. Call it after build_scenario.
 */
@Component
public class ComputeLiquidityGapTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_liquidity_gap";
    }

    @Override
    public String description() {
        return "Organic module only: the monthly liquidity gap of each conversion year with the option's instalments, "
                + "the peak month and the APIA pre-financing capacity (F5) to cover it. Call it after build_scenario.";
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
        if (!"organic".equals(context.module().calculator())) {
            throw new IllegalArgumentException("This tool applies only to the Organic module");
        }
        OrganicPlans.Setup setup = OrganicPlans.setup(context);
        ObjectNode result = context.newResult();
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            if (option.schedule() == null) {
                throw new IllegalArgumentException("Call build_scenario first for option " + optionId);
            }
            Configuration cfg = context.workspace().configuration(option.configId());
            List<Tranche> tranches = OrganicPlans.tranches(setup, OrganicPlans.phasing(cfg.components()));
            String p = "option_" + optionId.toLowerCase() + ".gap.";

            BigDecimal peak = BigDecimal.ZERO;
            boolean allCovered = true;
            boolean firstCovered = true;
            ArrayNode years = result.putObject(optionId).putArray("years");
            for (int n = 0; n < setup.horizonYears(); n++) {
                int year = setup.startYear() + n;
                List<BigDecimal> gap = OrganicPlans.monthlyGap(setup, tranches, year,
                        instalments(option, year));
                BigDecimal total = OrganicCalculator.total(gap);
                BigDecimal coverage = OrganicPlans.coverage(context, setup, tranches, year);
                boolean covered = total.compareTo(coverage) <= 0;
                allCovered &= covered;
                if (n == 0) {
                    firstCovered = covered;
                }
                peak = peak.max(OrganicCalculator.peak(gap));
                context.calc(p + "y" + (n + 1), "Liquidity gap in " + year + " (with loan instalments)", total,
                        Unit.EUR).formula("Σ monthly max(0, expenses + instalments − revenue − subsidies), vs conventional")
                        .add();
                context.calc(p + "coverage_y" + (n + 1), "APIA pre-financing capacity in " + year, coverage, Unit.EUR)
                        .formula("advance share × (current APIA subsidies + organic payments of the year)")
                        .source(context.paramSource("apiaPrefinancingAdvancePct")).add();
                years.addObject().put("year", year).put("covered", covered);
            }
            context.calc(p + "peak", "Largest monthly gap in the conversion years", peak, Unit.EUR_PER_MONTH).add();
            ObjectNode node = (ObjectNode) result.path(optionId);
            node.put("firstYearCovered", firstCovered);
            node.put("allYearsCovered", allCovered);
        }
        return context.ok(result, "Computed the monthly liquidity gap of the conversion years");
    }

    /** The option's installments in one calendar year, January first. */
    private static List<BigDecimal> instalments(FinancingOption option, int year) {
        List<BigDecimal> months = new ArrayList<>(OrganicPlans.noInstalments());
        for (Installment installment : option.schedule().installments()) {
            YearMonth month = installment.month();
            if (month.getYear() == year) {
                months.set(month.getMonthValue() - 1, months.get(month.getMonthValue() - 1).add(installment.paymentEur()));
            }
        }
        return months;
    }
}
