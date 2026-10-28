package ro.greenstruct.agro.engine.monitoring;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImpactMonitoringTest {

    @Test
    void movesTheEstimateByTheDeviation() {
        // 1000 m³ estimated, −4% → 960 m³ (by hand: 1000 × 0.96)
        var comparison = ImpactMonitoring.compare(new BigDecimal("1000"), new BigDecimal("-4"), new BigDecimal("10"));

        assertThat(comparison.actual()).isEqualByComparingTo("960");
        assertThat(comparison.withinTolerance()).isTrue();
    }

    @Test
    void toleranceIsInclusiveAndOnlyDownwards() {
        assertThat(ImpactMonitoring.compare(new BigDecimal("200"), new BigDecimal("-10"), new BigDecimal("10"))
                .withinTolerance()).isTrue();
        assertThat(ImpactMonitoring.compare(new BigDecimal("200"), new BigDecimal("-10.5"), new BigDecimal("10"))
                .withinTolerance()).isFalse();
        // 12% above the estimate is still a confirmation
        assertThat(ImpactMonitoring.compare(new BigDecimal("200"), new BigDecimal("12"), new BigDecimal("10"))
                .withinTolerance()).isTrue();
    }

    @Test
    void bonusLowersTheRateOnlyWhenConfirmed() {
        // README §4 step 6: green rate 6.28%, bonus −0.25 pp → 6.03%
        assertThat(ImpactMonitoring.rateAfterBonus(new BigDecimal("6.28"), new BigDecimal("-0.25"), true))
                .isEqualByComparingTo("6.03");
        assertThat(ImpactMonitoring.rateAfterBonus(new BigDecimal("6.28"), new BigDecimal("-0.25"), false))
                .isEqualByComparingTo("6.28");
    }

    @Test
    void rejectsNegativeInputs() {
        assertThatThrownBy(() -> ImpactMonitoring.compare(new BigDecimal("-1"), BigDecimal.ZERO, BigDecimal.TEN))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ImpactMonitoring.compare(BigDecimal.ONE, BigDecimal.ZERO, new BigDecimal("-1")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
