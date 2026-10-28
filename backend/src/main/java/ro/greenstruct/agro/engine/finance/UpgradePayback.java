package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.util.Optional;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.TWELVE;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/** README §4 step 4: months to recover the upgrade = upgrade cost / extra monthly savings. */
public final class UpgradePayback {

    private UpgradePayback() {
    }

    /** Empty when the upgrade saves nothing extra, so it never pays back. */
    public static Optional<BigDecimal> months(BigDecimal upgradeCostEur, BigDecimal requestedAnnualSavingsEur,
                                              BigDecimal upgradedAnnualSavingsEur) {
        requireNonNegative(upgradeCostEur, "upgradeCostEur");
        requireNonNegative(requestedAnnualSavingsEur, "requestedAnnualSavingsEur");
        requireNonNegative(upgradedAnnualSavingsEur, "upgradedAnnualSavingsEur");
        BigDecimal extraMonthly = upgradedAnnualSavingsEur.subtract(requestedAnnualSavingsEur, MC).divide(TWELVE, MC);
        if (extraMonthly.signum() <= 0) {
            return Optional.empty();
        }
        return Optional.of(upgradeCostEur.divide(extraMonthly, MC));
    }
}
