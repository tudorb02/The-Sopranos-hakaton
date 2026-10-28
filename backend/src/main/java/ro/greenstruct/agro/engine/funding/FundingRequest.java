package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;
import java.util.Optional;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;

/**
 * Inputs for one funding stack. grant is empty when no programme is open or the farm is not eligible;
 * the bridge loan pre-finances the grant until the paying agency reimburses it.
 */
public record FundingRequest(
        BigDecimal investmentEur,
        BigDecimal eligibleCostEur,
        Optional<GrantTerms> grant,
        BigDecimal ownContributionEur,
        BigDecimal guaranteePct,
        int monthsUntilGrantPaid,
        BigDecimal bridgeAnnualRatePct) {

    public FundingRequest {
        requireNonNegative(investmentEur, "investmentEur");
        requireNonNegative(eligibleCostEur, "eligibleCostEur");
        if (eligibleCostEur.compareTo(investmentEur) > 0) {
            throw new IllegalArgumentException("eligibleCostEur cannot exceed investmentEur");
        }
        requireNonNegative(ownContributionEur, "ownContributionEur");
        requirePct(guaranteePct, "guaranteePct");
        if (monthsUntilGrantPaid < 0) {
            throw new IllegalArgumentException("monthsUntilGrantPaid must be >= 0");
        }
        requireNonNegative(bridgeAnnualRatePct, "bridgeAnnualRatePct");
    }
}
