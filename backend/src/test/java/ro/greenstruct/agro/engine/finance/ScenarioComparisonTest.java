package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static ro.greenstruct.agro.engine.Decimals.money;

/** The 4-tractor example from the funding research, over 7 years. */
class ScenarioComparisonTest {

    @Test
    void greenPackageWithGrantBeatsStandardLoan() {
        ScenarioCost standard = new ScenarioCost("A", new BigDecimal("440000"), BigDecimal.ZERO,
                new BigDecimal("126902.68"), BigDecimal.ZERO, new BigDecimal("35383.82"));
        ScenarioCost green = new ScenarioCost("B", new BigDecimal("492000"), new BigDecimal("200000"),
                new BigDecimal("66318.62").add(new BigDecimal("14000")), BigDecimal.ZERO, new BigDecimal("82331.96"));

        ScenarioComparison comparison = ScenarioComparison.of(standard, green);

        assertThat(money(standard.netCostEur())).isEqualByComparingTo("531518.86");
        assertThat(money(green.netCostEur())).isEqualByComparingTo("289986.66");
        assertThat(money(comparison.netAdvantageEur())).isEqualByComparingTo("241532.20");
        assertThat(comparison.proposedIsBetter()).isTrue();
    }

    @Test
    void higherRunningCostsAddToTheNetCost() {
        // 52,000 capex + 12,614.75 interest + 1,450 mortgage fees + 23,646.31 extra running cost = 89,711.06
        ScenarioCost sprinkler = new ScenarioCost("A", new BigDecimal("52000"), BigDecimal.ZERO,
                new BigDecimal("12614.75"), new BigDecimal("1450"), new BigDecimal("-23646.31"));

        assertThat(money(sprinkler.netCostEur())).isEqualByComparingTo("89711.06");
    }
}
