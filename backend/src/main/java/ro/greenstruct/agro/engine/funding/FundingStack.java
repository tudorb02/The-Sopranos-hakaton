package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;

public record FundingStack(
        BigDecimal investmentEur,
        BigDecimal grantEur,
        BigDecimal ownContributionEur,
        BigDecimal cofinancingLoanEur,
        BigDecimal guaranteedAmountEur,
        BigDecimal bridgeLoanEur,
        BigDecimal bridgeInterestEur) {
}
