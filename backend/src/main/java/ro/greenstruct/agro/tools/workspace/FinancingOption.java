package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import ro.greenstruct.agro.engine.finance.LoanSchedule;

/**
 * Option A / B / C: a configuration plus how it is financed. Amounts come from build_funding_stack, the main loan's
 * rate from price_loan (null until then), the schedule and the totals from build_scenario.
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
        BigDecimal ratePct,
        LoanSchedule schedule,
        Map<String, BigDecimal> totals) {

    public FinancingOption {
        products = List.copyOf(products);
        totals = totals == null ? Map.of() : Map.copyOf(totals);
    }

    public FinancingOption withRate(BigDecimal newRatePct) {
        return new FinancingOption(optionId, configId, products, mainLineId, mainLoanEur, grantEur, grantProgram,
                guaranteeEur, guaranteeId, bridgeLoanEur, bridgeInterestEur, bridgeLineId, newRatePct, schedule, totals);
    }

    public FinancingOption withScenario(LoanSchedule newSchedule, Map<String, BigDecimal> newTotals) {
        return new FinancingOption(optionId, configId, products, mainLineId, mainLoanEur, grantEur, grantProgram,
                guaranteeEur, guaranteeId, bridgeLoanEur, bridgeInterestEur, bridgeLineId, ratePct, newSchedule,
                newTotals);
    }

    public BigDecimal total(String name) {
        BigDecimal value = totals.get(name);
        if (value == null) {
            throw new IllegalArgumentException("Opțiunea " + optionId + " nu are încă scenariul calculat; "
                    + "apelează build_scenario");
        }
        return value;
    }
}
