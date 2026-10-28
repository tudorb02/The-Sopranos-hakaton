package ro.greenstruct.agro.engine.affordability;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import ro.greenstruct.agro.engine.finance.Installment;
import ro.greenstruct.agro.engine.finance.LoanSchedule;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;

/**
 * Checks the first year of a schedule against the farm's typical monthly free cash flow (from Open Banking,
 * before the new loan). Seasonal schedules should leave no deficit months; equal monthly ones often do on farms.
 */
public final class AffordabilityCalculator {

    private static final int MONTHS_IN_YEAR = 12;

    private AffordabilityCalculator() {
    }

    public static AffordabilityResult check(LoanSchedule schedule, Map<Month, BigDecimal> freeCashFlowByMonth,
                                            BigDecimal minDscr) {
        requirePositive(minDscr, "minDscr");
        if (!freeCashFlowByMonth.keySet().containsAll(List.of(Month.values()))) {
            throw new IllegalArgumentException("free cash flow must cover all 12 months");
        }

        List<Installment> firstYear = schedule.installments().stream().limit(MONTHS_IN_YEAR).toList();
        BigDecimal debtService = BigDecimal.ZERO;
        BigDecimal cashFlow = BigDecimal.ZERO;
        List<YearMonth> deficits = new ArrayList<>();
        for (Installment installment : firstYear) {
            BigDecimal monthCashFlow = freeCashFlowByMonth.get(installment.month().getMonth());
            debtService = debtService.add(installment.paymentEur());
            cashFlow = cashFlow.add(monthCashFlow);
            if (installment.paymentEur().signum() > 0 && installment.paymentEur().compareTo(monthCashFlow) > 0) {
                deficits.add(installment.month());
            }
        }

        BigDecimal dscr = debtService.signum() == 0 ? null : cashFlow.divide(debtService, MC);
        boolean meets = dscr == null || dscr.compareTo(minDscr) >= 0;
        return new AffordabilityResult(dscr, minDscr, meets, deficits);
    }
}
