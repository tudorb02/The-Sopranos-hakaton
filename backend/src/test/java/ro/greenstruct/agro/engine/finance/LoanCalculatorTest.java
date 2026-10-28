package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.util.Set;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ro.greenstruct.agro.engine.Decimals.money;

class LoanCalculatorTest {

    private static final YearMonth JAN_2027 = YearMonth.of(2027, 1);

    @Test
    void monthlyScheduleUsesPmtAndRepaysPrincipal() {
        LoanSchedule schedule = LoanCalculator.monthly(new BigDecimal("440000"), new BigDecimal("7.5"), 84, JAN_2027);

        assertThat(money(schedule.installmentEur())).isEqualByComparingTo("6748.84");
        assertThat(money(schedule.totalInterestEur())).isEqualByComparingTo("126902.68");
        assertThat(schedule.paymentCount()).isEqualTo(84);
        assertThat(money(schedule.installments().getLast().balanceEur())).isEqualByComparingTo("0.00");
    }

    @Test
    void seasonalSchedulePaysOnlyInHarvestMonths() {
        LoanSchedule schedule = LoanCalculator.seasonal(new BigDecimal("100000"), new BigDecimal("6.2"), 60, JAN_2027,
                Set.of(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER), 0);

        assertThat(schedule.paymentCount()).isEqualTo(15);
        assertThat(money(schedule.installmentEur())).isEqualByComparingTo("7872.31");
        assertThat(money(schedule.totalInterestEur())).isEqualByComparingTo("18084.60");
        assertThat(money(schedule.installments().getLast().balanceEur())).isEqualByComparingTo("0.00");
        assertThat(schedule.installments())
                .filteredOn(i -> i.paymentEur().signum() > 0)
                .allSatisfy(i -> assertThat(i.month().getMonth()).isIn(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER));
    }

    @Test
    void graceMonthsSkipPaymentsAndCapitaliseInterest() {
        LoanSchedule withGrace = LoanCalculator.seasonal(new BigDecimal("100000"), new BigDecimal("6.2"), 60, JAN_2027,
                Set.of(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER), 12);
        LoanSchedule withoutGrace = LoanCalculator.seasonal(new BigDecimal("100000"), new BigDecimal("6.2"), 60,
                JAN_2027, Set.of(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER), 0);

        assertThat(withGrace.paymentCount()).isEqualTo(12);
        assertThat(withGrace.installments().subList(0, 12)).allSatisfy(i -> assertThat(i.paymentEur()).isZero());
        assertThat(withGrace.totalInterestEur()).isGreaterThan(withoutGrace.totalInterestEur());
        assertThat(money(withGrace.installments().getLast().balanceEur())).isEqualByComparingTo("0.00");
    }

    @Test
    void seasonalScheduleNeedsAtLeastOnePaymentPeriod() {
        assertThatThrownBy(() -> LoanCalculator.seasonal(BigDecimal.TEN, BigDecimal.ONE, 6, JAN_2027,
                Set.of(Month.DECEMBER), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
