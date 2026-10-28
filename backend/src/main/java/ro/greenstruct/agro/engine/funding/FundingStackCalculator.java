package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.TWELVE;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * Splits an investment into grant, own contribution and bank loans:
 * grant = min(eligible cost × intensity, cap); co-financing loan = investment − grant − own contribution;
 * guaranteed amount = co-financing loan × guarantee %; bridge loan = grant, interest-only until the grant is paid.
 */
public final class FundingStackCalculator {

    private FundingStackCalculator() {
    }

    public static FundingStack build(FundingRequest request) {
        BigDecimal grant = request.grant()
                .map(terms -> request.eligibleCostEur().multiply(fraction(terms.intensityPct()), MC).min(terms.capEur()))
                .orElse(BigDecimal.ZERO);

        BigDecimal cofinancingLoan = request.investmentEur().subtract(grant).subtract(request.ownContributionEur());
        if (cofinancingLoan.signum() < 0) {
            throw new IllegalArgumentException("own contribution exceeds the part not covered by the grant");
        }

        BigDecimal guaranteed = cofinancingLoan.multiply(fraction(request.guaranteePct()), MC);
        BigDecimal bridgeInterest = grant
                .multiply(fraction(request.bridgeAnnualRatePct()), MC)
                .multiply(BigDecimal.valueOf(request.monthsUntilGrantPaid()), MC)
                .divide(TWELVE, MC);

        return new FundingStack(request.investmentEur(), grant, request.ownContributionEur(), cofinancingLoan,
                guaranteed, grant, bridgeInterest);
    }

    /** Rolling 3-year de minimis ceiling: aid already received plus the new aid must not exceed it. */
    public static DeMinimisCheck deMinimis(BigDecimal ceilingEur, BigDecimal receivedLastThreeYearsEur,
                                           BigDecimal newAidEur) {
        requireNonNegative(ceilingEur, "ceilingEur");
        requireNonNegative(receivedLastThreeYearsEur, "receivedLastThreeYearsEur");
        requireNonNegative(newAidEur, "newAidEur");
        BigDecimal headroom = ceilingEur.subtract(receivedLastThreeYearsEur);
        return new DeMinimisCheck(newAidEur.compareTo(headroom) <= 0, headroom.max(BigDecimal.ZERO));
    }
}
