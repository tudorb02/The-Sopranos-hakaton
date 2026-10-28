package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.IntPredicate;
import java.util.stream.IntStream;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;

/**
 * Level-installment loans. Interest accrues every month; installments are equal and fall only in
 * payment periods, sized so that their present value at the loan rate equals the principal:
 * X = P / Σ v^k over payment periods k. With every month a payment period this is the classic PMT.
 * Months without a payment (grace, off-season) capitalise their interest.
 */
public final class LoanCalculator {

    private LoanCalculator() {
    }

    public static LoanSchedule monthly(BigDecimal principalEur, BigDecimal annualRatePct, int termMonths,
                                       YearMonth firstMonth) {
        return level(principalEur, annualRatePct, termMonths, firstMonth, period -> true);
    }

    /** Installments only in the given calendar months (e.g. after harvest), none during the first graceMonths. */
    public static LoanSchedule seasonal(BigDecimal principalEur, BigDecimal annualRatePct, int termMonths,
                                        YearMonth firstMonth, Set<Month> paymentMonths, int graceMonths) {
        if (paymentMonths.isEmpty()) {
            throw new IllegalArgumentException("paymentMonths must not be empty");
        }
        return level(principalEur, annualRatePct, termMonths, firstMonth,
                period -> period > graceMonths && paymentMonths.contains(monthOf(firstMonth, period).getMonth()));
    }

    static LoanSchedule level(BigDecimal principalEur, BigDecimal annualRatePct, int termMonths,
                              YearMonth firstMonth, IntPredicate isPaymentPeriod) {
        requirePositive(principalEur, "principalEur");
        if (termMonths <= 0) {
            throw new IllegalArgumentException("termMonths must be > 0, was " + termMonths);
        }
        int[] paymentPeriods = IntStream.rangeClosed(1, termMonths).filter(isPaymentPeriod).toArray();
        if (paymentPeriods.length == 0) {
            throw new IllegalArgumentException("schedule has no payment periods");
        }

        BigDecimal r = FinancialMath.monthlyRate(annualRatePct);
        BigDecimal installment = levelInstallment(principalEur, r, paymentPeriods);
        int lastPaymentPeriod = paymentPeriods[paymentPeriods.length - 1];

        List<Installment> rows = new ArrayList<>(termMonths);
        BigDecimal balance = principalEur;
        BigDecimal totalPaid = BigDecimal.ZERO;
        for (int period = 1; period <= termMonths; period++) {
            BigDecimal interest = balance.multiply(r, MC);
            BigDecimal payment;
            if (period == lastPaymentPeriod) {
                payment = balance.add(interest);
            } else if (isPaymentPeriod.test(period)) {
                payment = installment;
            } else {
                payment = BigDecimal.ZERO;
            }
            BigDecimal principalPart = payment.subtract(interest);
            balance = balance.add(interest).subtract(payment);
            totalPaid = totalPaid.add(payment);
            rows.add(new Installment(period, monthOf(firstMonth, period), payment, interest, principalPart, balance));
        }
        return new LoanSchedule(principalEur, annualRatePct, installment, rows, totalPaid,
                totalPaid.subtract(principalEur));
    }

    private static BigDecimal levelInstallment(BigDecimal principal, BigDecimal r, int[] paymentPeriods) {
        if (r.signum() == 0) {
            return principal.divide(BigDecimal.valueOf(paymentPeriods.length), MC);
        }
        BigDecimal presentValueOfOne = BigDecimal.ZERO;
        for (int period : paymentPeriods) {
            presentValueOfOne = presentValueOfOne.add(FinancialMath.discountFactor(r, period));
        }
        return principal.divide(presentValueOfOne, MC);
    }

    private static YearMonth monthOf(YearMonth firstMonth, int period) {
        return firstMonth.plusMonths(period - 1L);
    }
}
