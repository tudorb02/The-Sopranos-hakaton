package ro.greenstruct.agro.engine.affordability;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.engine.finance.Installment;
import ro.greenstruct.agro.engine.finance.LoanSchedule;

import static org.assertj.core.api.Assertions.assertThat;
import static ro.greenstruct.agro.engine.Decimals.money;

class DebtServiceCoverageTest {

    private static final BigDecimal CASH_FLOW = new BigDecimal("95000");
    private static final BigDecimal SAVINGS = new BigDecimal("5000");

    /** One installment per month from January 2027; amounts in EUR, interest and balance are not used. */
    private static LoanSchedule schedule(int... payments) {
        List<Installment> installments = new ArrayList<>();
        YearMonth month = YearMonth.of(2027, 1);
        for (int i = 0; i < payments.length; i++) {
            BigDecimal payment = BigDecimal.valueOf(payments[i]);
            installments.add(new Installment(i + 1, month.plusMonths(i), payment, BigDecimal.ZERO, payment, BigDecimal.ZERO));
        }
        BigDecimal total = installments.stream().map(Installment::paymentEur).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new LoanSchedule(total, BigDecimal.ZERO, BigDecimal.ZERO, installments, total, BigDecimal.ZERO);
    }

    @Test
    void keepsTheLowestFullYear() {
        // Year 1: grace, 6 × 400 interest only, then 4 × 4,000 at harvest = 18,400.
        // Year 2: 4 × 5,000 at harvest = 20,000.
        LoanSchedule seasonal = schedule(
                400, 400, 400, 400, 400, 400, 4000, 4000, 4000, 4000, 0, 0,
                0, 0, 0, 0, 0, 0, 5000, 5000, 5000, 5000, 0, 0);

        DebtServiceCoverage.Result result = DebtServiceCoverage.compute(CASH_FLOW, SAVINGS, seasonal);

        assertThat(result.debtServiceByYearEur()).extracting(BigDecimal::intValue).containsExactly(18400, 20000);
        // (95,000 + 5,000) / 18,400 = 5.43; / 20,000 = 5.00 → the lowest, 5.00
        assertThat(money(result.dscr())).isEqualByComparingTo("5.00");
    }

    @Test
    void aScheduleShorterThanAYearCountsAsOneYear() {
        DebtServiceCoverage.Result result = DebtServiceCoverage.compute(CASH_FLOW, SAVINGS, schedule(1000, 1000, 1000, 1000, 1000, 1000));

        // 100,000 / 6,000 = 16.67
        assertThat(money(result.dscr())).isEqualByComparingTo("16.67");
    }

    @Test
    void nothingDueMeansNoRatio() {
        assertThat(DebtServiceCoverage.compute(CASH_FLOW, SAVINGS, schedule(0, 0, 0)).dscr()).isNull();
    }
}
