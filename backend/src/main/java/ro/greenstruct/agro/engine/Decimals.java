package ro.greenstruct.agro.engine;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Shared numeric conventions for the engine: full DECIMAL128 precision inside calculations,
 * percentages expressed as percentage points (24.5 = 24.5%), rounding only at the output edge.
 */
public final class Decimals {

    public static final MathContext MC = MathContext.DECIMAL128;
    public static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    public static final BigDecimal TWELVE = BigDecimal.valueOf(12);

    private Decimals() {
    }

    public static BigDecimal fraction(BigDecimal pct) {
        return pct.divide(HUNDRED, MC);
    }

    public static BigDecimal toPct(BigDecimal fraction) {
        return fraction.multiply(HUNDRED, MC);
    }

    public static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    public static BigDecimal requireNonNegative(BigDecimal value, String name) {
        if (value == null || value.signum() < 0) {
            throw new IllegalArgumentException(name + " must be >= 0, was " + value);
        }
        return value;
    }

    public static BigDecimal requirePositive(BigDecimal value, String name) {
        if (value == null || value.signum() <= 0) {
            throw new IllegalArgumentException(name + " must be > 0, was " + value);
        }
        return value;
    }

    public static BigDecimal requirePct(BigDecimal value, String name) {
        requireNonNegative(value, name);
        if (value.compareTo(HUNDRED) > 0) {
            throw new IllegalArgumentException(name + " must be <= 100, was " + value);
        }
        return value;
    }
}
