package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.util.Optional;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.TWELVE;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;

public final class FinancialMath {

    private FinancialMath() {
    }

    /** r = annual rate / 12, as a fraction. */
    public static BigDecimal monthlyRate(BigDecimal annualRatePct) {
        return fraction(requireNonNegative(annualRatePct, "annualRatePct")).divide(TWELVE, MC);
    }

    /** v^k = 1 / (1 + r)^k. */
    public static BigDecimal discountFactor(BigDecimal monthlyRate, int period) {
        return BigDecimal.ONE.divide(BigDecimal.ONE.add(monthlyRate).pow(period, MC), MC);
    }

    /** PMT = P · r · (1+r)^n / ((1+r)^n − 1); P / n when r = 0. */
    public static BigDecimal pmt(BigDecimal principal, BigDecimal annualRatePct, int months) {
        requirePositive(principal, "principal");
        if (months <= 0) {
            throw new IllegalArgumentException("months must be > 0, was " + months);
        }
        BigDecimal r = monthlyRate(annualRatePct);
        if (r.signum() == 0) {
            return principal.divide(BigDecimal.valueOf(months), MC);
        }
        BigDecimal growth = BigDecimal.ONE.add(r).pow(months, MC);
        return principal.multiply(r, MC).multiply(growth, MC).divide(growth.subtract(BigDecimal.ONE), MC);
    }

    /** One-off costs plus yearly costs over the horizon, e.g. mortgage valuation + notary + yearly insurance. */
    public static BigDecimal recurringCost(BigDecimal upfrontEur, BigDecimal annualEur, int years) {
        requireNonNegative(upfrontEur, "upfrontEur");
        requireNonNegative(annualEur, "annualEur");
        return upfrontEur.add(annualEur.multiply(BigDecimal.valueOf(years), MC));
    }

    /** Months needed for extra monthly savings to repay an extra cost; empty when savings are not positive. */
    public static Optional<BigDecimal> paybackMonths(BigDecimal extraCostEur, BigDecimal extraMonthlySavingsEur) {
        requireNonNegative(extraCostEur, "extraCostEur");
        if (extraMonthlySavingsEur.signum() <= 0) {
            return Optional.empty();
        }
        return Optional.of(extraCostEur.divide(extraMonthlySavingsEur, MC));
    }
}
