package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import ro.greenstruct.agro.engine.finance.LoanSchedule;

/**
 * Option A / B / C: a configuration plus how it is financed. Amounts come from build_funding_stack; the
 * schedule and the totals from build_scenario.
 */
public record FinancingOption(
        String optionId,
        String configId,
        List<String> products,
        String mainLineId,
        BigDecimal mainLoanEur,
        BigDecimal grantEur,
        String grantProgram,
        BigDecimal guaranteeEur,
        String guaranteeId,
        BigDecimal bridgeLoanEur,
        BigDecimal bridgeInterestEur,
        String bridgeLineId,
        LoanSchedule schedule,
        Map<String, BigDecimal> totals) {

    public FinancingOption {
        products = List.copyOf(products);
        totals = totals == null ? Map.of() : Map.copyOf(totals);
    }

    public FinancingOption withScenario(LoanSchedule newSchedule, Map<String, BigDecimal> newTotals) {
        return new FinancingOption(optionId, configId, products, mainLineId, mainLoanEur, grantEur, grantProgram,
                guaranteeEur, guaranteeId, bridgeLoanEur, bridgeInterestEur, bridgeLineId, newSchedule, newTotals);
    }

    public BigDecimal total(String name) {
        BigDecimal value = totals.get(name);
        if (value == null) {
            throw new IllegalArgumentException("Option " + optionId + " has no computed scenario yet; "
                    + "call build_scenario");
        }
        return value;
    }
}
