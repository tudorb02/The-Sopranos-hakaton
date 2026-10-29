package ro.greenstruct.agro.engine.monitoring;

import java.math.BigDecimal;
import java.util.Objects;

import static ro.greenstruct.agro.engine.Decimals.HUNDRED;
import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Compares the impact measured after 12 months with the estimate made at approval (README §13, "Simulate 12 months").
 * The measured value is the estimate moved by a deviation in percent; the estimate is confirmed when the measured
 * value is not more than the tolerance below it. A result above the estimate always confirms it.
 */
public final class ImpactMonitoring {

    private ImpactMonitoring() {
    }

    /** actual = estimated × (1 + deviationPct / 100); withinTolerance when deviationPct ≥ −tolerancePct. */
    public record Comparison(BigDecimal estimated, BigDecimal actual, BigDecimal deviationPct, boolean withinTolerance) {
    }

    public static Comparison compare(BigDecimal estimated, BigDecimal deviationPct, BigDecimal tolerancePct) {
        Objects.requireNonNull(estimated, "estimated");
        Objects.requireNonNull(deviationPct, "deviationPct");
        if (estimated.signum() < 0) {
            throw new IllegalArgumentException("estimated must be >= 0, was " + estimated);
        }
        if (tolerancePct == null || tolerancePct.signum() < 0) {
            throw new IllegalArgumentException("tolerancePct must be >= 0, was " + tolerancePct);
        }
        BigDecimal actual = estimated.multiply(BigDecimal.ONE.add(deviationPct.divide(HUNDRED, MC), MC), MC);
        return new Comparison(estimated, actual, deviationPct, deviationPct.compareTo(tolerancePct.negate()) >= 0);
    }

    /** The green rate after the impact bonus: rate + bonus, the bonus being negative (−0.25 pp); unchanged otherwise. */
    public static BigDecimal rateAfterBonus(BigDecimal ratePct, BigDecimal bonusPp, boolean confirmed) {
        return confirmed ? ratePct.add(bonusPp, MC) : ratePct;
    }
}
