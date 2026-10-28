package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static ro.greenstruct.agro.engine.Decimals.money;

class UpgradePaybackTest {

    @Test
    void dripAndSensorsPayBackInAboutTwentyEightMonths() {
        // 8,000 EUR more for drip + sensors; savings 1,940 → 5,320 EUR/year: 3,380 / 12 = 281.67 a month;
        // 8,000 / 281.67 = 28.40 months
        BigDecimal months = UpgradePayback.months(new BigDecimal("8000"), new BigDecimal("1940"), new BigDecimal("5320"))
                .orElseThrow();

        assertThat(money(months)).isEqualByComparingTo("28.40");
    }

    @Test
    void noExtraSavingsNeverPaysBack() {
        assertThat(UpgradePayback.months(new BigDecimal("8000"), new BigDecimal("1940"), new BigDecimal("1940"))).isEmpty();
    }
}
