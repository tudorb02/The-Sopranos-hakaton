package ro.greenstruct.agro.engine.affordability;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.engine.finance.LoanCalculator;
import ro.greenstruct.agro.engine.finance.LoanSchedule;

import static org.assertj.core.api.Assertions.assertThat;

class AffordabilityCalculatorTest {

    private static final YearMonth JAN_2027 = YearMonth.of(2027, 1);
    private static final BigDecimal LOAN = new BigDecimal("100000");
    private static final BigDecimal RATE = new BigDecimal("6.2");

    /** A vegetable farm: little cash in winter and spring, most of it after the summer harvest. */
    private static Map<Month, BigDecimal> harvestHeavyCashFlow() {
        Map<Month, BigDecimal> cashFlow = new EnumMap<>(Month.class);
        for (Month month : Month.values()) {
            cashFlow.put(month, new BigDecimal("500"));
        }
        cashFlow.put(Month.AUGUST, new BigDecimal("20000"));
        cashFlow.put(Month.SEPTEMBER, new BigDecimal("20000"));
        cashFlow.put(Month.OCTOBER, new BigDecimal("15000"));
        return cashFlow;
    }

    @Test
    void equalMonthlyInstallmentsLeaveDeficitMonths() {
        LoanSchedule monthly = LoanCalculator.monthly(LOAN, RATE, 60, JAN_2027);

        AffordabilityResult result = AffordabilityCalculator.check(monthly, harvestHeavyCashFlow(), new BigDecimal("1.2"));

        assertThat(result.deficitMonths()).hasSize(9);
        assertThat(result.meetsMinimum()).isTrue();
    }

    @Test
    void seasonalInstallmentsFitTheHarvestMonths() {
        LoanSchedule seasonal = LoanCalculator.seasonal(LOAN, RATE, 60, JAN_2027,
                Set.of(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER), 0);

        AffordabilityResult result = AffordabilityCalculator.check(seasonal, harvestHeavyCashFlow(), new BigDecimal("1.2"));

        assertThat(result.deficitMonths()).isEmpty();
        assertThat(result.meetsMinimum()).isTrue();
    }

    @Test
    void monthsWithoutInstallmentAreNeverDeficits() {
        Map<Month, BigDecimal> cashFlow = harvestHeavyCashFlow();
        cashFlow.put(Month.MARCH, new BigDecimal("-7000"));
        LoanSchedule seasonal = LoanCalculator.seasonal(LOAN, RATE, 60, JAN_2027,
                Set.of(Month.AUGUST, Month.SEPTEMBER, Month.OCTOBER), 0);

        AffordabilityResult result = AffordabilityCalculator.check(seasonal, cashFlow, new BigDecimal("1.2"));

        assertThat(result.deficitMonths()).isEmpty();
    }

    @Test
    void tooLowCashFlowFailsTheMinimumDscr() {
        Map<Month, BigDecimal> thin = new EnumMap<>(Month.class);
        for (Month month : Month.values()) {
            thin.put(month, new BigDecimal("1000"));
        }

        AffordabilityResult result = AffordabilityCalculator.check(
                LoanCalculator.monthly(LOAN, RATE, 60, JAN_2027), thin, new BigDecimal("1.2"));

        assertThat(result.meetsMinimum()).isFalse();
    }
}
