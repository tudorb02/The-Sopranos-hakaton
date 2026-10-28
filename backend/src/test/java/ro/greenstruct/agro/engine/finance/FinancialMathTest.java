package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ro.greenstruct.agro.engine.Decimals.money;

class FinancialMathTest {

    // Expected values cross-checked with Excel =PMT(rate/12; n; -principal).
    @ParameterizedTest
    @CsvSource({
            "100000, 8.9, 60, 2070.99",
            "104500, 6.2, 60, 2030.01",
            "440000, 7.5, 84, 6748.84",
            "292000, 6.0, 84, 4265.70"
    })
    void pmtMatchesSpreadsheet(BigDecimal principal, BigDecimal ratePct, int months, BigDecimal expected) {
        assertThat(money(FinancialMath.pmt(principal, ratePct, months))).isEqualByComparingTo(expected);
    }

    @Test
    void pmtWithZeroRateSplitsPrincipalEvenly() {
        assertThat(FinancialMath.pmt(new BigDecimal("1200"), BigDecimal.ZERO, 12)).isEqualByComparingTo("100");
    }

    @Test
    void pmtRejectsNonPositiveTerm() {
        assertThatThrownBy(() -> FinancialMath.pmt(BigDecimal.TEN, BigDecimal.ONE, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void recurringCostAddsYearlyCostsOverHorizon() {
        assertThat(FinancialMath.recurringCost(new BigDecimal("1250"), new BigDecimal("300"), 5))
                .isEqualByComparingTo("2750");
    }

    @Test
    void paybackMonthsDividesExtraCostBySavings() {
        assertThat(FinancialMath.paybackMonths(new BigDecimal("18200"), new BigDecimal("700")))
                .hasValueSatisfying(months -> assertThat(months).isEqualByComparingTo("26"));
    }

    @Test
    void paybackIsEmptyWithoutSavings() {
        assertThat(FinancialMath.paybackMonths(BigDecimal.TEN, BigDecimal.ZERO)).isEmpty();
    }
}
