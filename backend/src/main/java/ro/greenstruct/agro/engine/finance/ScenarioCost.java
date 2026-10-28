package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * Everything a financing option costs the farm over the comparison horizon.
 * financingCostEur covers all interest (main loan and bridge loan); feesEur covers mortgage and other costs.
 */
public record ScenarioCost(
        String scenarioId,
        BigDecimal capexEur,
        BigDecimal grantEur,
        BigDecimal financingCostEur,
        BigDecimal feesEur,
        BigDecimal operatingSavingsEur) {

    public ScenarioCost {
        requireNonNegative(capexEur, "capexEur");
        requireNonNegative(grantEur, "grantEur");
        requireNonNegative(financingCostEur, "financingCostEur");
        requireNonNegative(feesEur, "feesEur");
        // operatingSavingsEur may be negative: an investment can raise running costs
        // (a sprinkler needs more pumping pressure than furrow irrigation), which adds to the net cost.
    }

    /** capex − grant + financing cost + fees − operating savings. */
    public BigDecimal netCostEur() {
        return capexEur.subtract(grantEur).add(financingCostEur).add(feesEur).subtract(operatingSavingsEur);
    }
}
