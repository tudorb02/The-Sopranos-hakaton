package ro.greenstruct.agro.engine.upgrade;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.engine.upgrade.UpgradeSelector.Candidate;

import static org.assertj.core.api.Assertions.assertThat;

class UpgradeSelectorTest {

    private static Candidate c(String id, String cost, String pct, boolean passes, boolean safe) {
        return new Candidate(id, new BigDecimal(cost), new BigDecimal(pct), passes, safe);
    }

    private static final BigDecimal THRESHOLD = new BigDecimal("25");
    private static final BigDecimal MULTIPLIER = new BigDecimal("1.5");
    private static final BigDecimal EXTRA = new BigDecimal("15");

    @Test
    void picksTheCheapestPassingPackage() {
        var drip = c("drip", "68000", "33.33", true, true);
        var sensorsOnly = c("sensors", "58500", "28", true, true);
        var failing = c("meter", "53200", "20", false, false);

        // Verde Plus needs 37.5%; none reaches it, so the cheapest passing one wins
        assertThat(UpgradeSelector.select(List.of(drip, failing, sensorsOnly), THRESHOLD, MULTIPLIER, EXTRA))
                .contains(sensorsOnly);
    }

    @Test
    void prefersVerdePlusWhenItCostsLittleMore() {
        var drip = c("drip", "68000", "33.33", true, true);
        // 68000 × 1.15 = 78200 ≥ 74500; 40% ≥ 25 × 1.5 = 37.5
        var dripSensors = c("drip_sensors", "74500", "40", true, true);

        assertThat(UpgradeSelector.select(List.of(drip, dripSensors), THRESHOLD, MULTIPLIER, EXTRA))
                .contains(dripSensors);
    }

    @Test
    void keepsTheCheapestWhenVerdePlusCostsTooMuch() {
        var drip = c("drip", "68000", "33.33", true, true);
        // 68000 × 1.15 = 78200 < 90000
        var expensive = c("premium", "90000", "45", true, true);

        assertThat(UpgradeSelector.select(List.of(drip, expensive), THRESHOLD, MULTIPLIER, EXTRA)).contains(drip);
    }

    @Test
    void safetyMarginBeatsAThinPass() {
        var thin = c("thin", "60000", "25.5", true, false);
        var safe = c("safe", "65000", "30", true, true);

        assertThat(UpgradeSelector.select(List.of(thin, safe), THRESHOLD, MULTIPLIER, EXTRA)).contains(safe);
        assertThat(UpgradeSelector.select(List.of(thin), THRESHOLD, MULTIPLIER, EXTRA)).contains(thin);
    }

    @Test
    void emptyWhenNothingPasses() {
        assertThat(UpgradeSelector.select(List.of(c("a", "1", "10", false, false)), THRESHOLD, MULTIPLIER, EXTRA))
                .isEmpty();
    }

    @Test
    void modulesWithoutAPercentThresholdTakeTheCheapestPassing() {
        var cheap = c("pv100", "72000", "0", true, true);
        var big = c("pv300", "210000", "0", true, true);

        assertThat(UpgradeSelector.select(List.of(big, cheap), null, null, null)).contains(cheap);
    }
}
