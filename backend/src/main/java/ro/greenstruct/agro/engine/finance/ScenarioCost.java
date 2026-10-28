package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * Everything a financing option costs the farm over the comparison horizon.
 * financingCostEur covers all interest (main loan and bridge loan); feesEur covers mortgage and other costs.
 * operatingSavingsEur is negative when the investment costs more to run than today (a sprinkler pumping at higher
 * pressure than furrows), which raises the net cost.
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
        if (operatingSavingsEur == null) {
            throw new IllegalArgumentException("operatingSavingsEur is required");
        }
    }

    /** capex − grant + financing cost + fees − operating savings. */
    public BigDecimal netCostEur() {
        return capexEur.subtract(grantEur).add(financingCostEur).add(feesEur).subtract(operatingSavingsEur);
    }
}
