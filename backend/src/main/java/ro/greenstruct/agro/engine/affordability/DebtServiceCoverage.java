package ro.greenstruct.agro.engine.affordability;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import ro.greenstruct.agro.engine.finance.Installment;
import ro.greenstruct.agro.engine.finance.LoanSchedule;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * DSCR of README §4 step 7: (annual operating cash flow + annual savings) / annual debt service (principal and
 * interest paid in the year). It is computed for every full loan year (periods 1–12, 13–24, ...) and the lowest one
 * is kept, so a heavier year after the grace period is not hidden; a schedule shorter than a year counts as one year.
 * The 40% affordability check of {@link AffordabilityCalculator} stays as an extra test.
 */
public final class DebtServiceCoverage {

    private static final int MONTHS_IN_YEAR = 12;

    private DebtServiceCoverage() {
    }

    /** debtServiceByYearEur has one entry per full loan year; dscr is null when nothing is due in any year. */
    public record Result(BigDecimal dscr, List<BigDecimal> debtServiceByYearEur) {
        public Result {
            debtServiceByYearEur = List.copyOf(debtServiceByYearEur);
        }
    }

    /**
     * annualSavingsEur may be negative: an investment that costs more to run (a sprinkler pumping at higher pressure
     * than furrows) leaves less cash for the installments.
     */
    public static Result compute(BigDecimal annualOperatingCashFlowEur, BigDecimal annualSavingsEur, LoanSchedule schedule) {
        if (annualSavingsEur == null) {
            throw new IllegalArgumentException("annualSavingsEur is required");
        }
        if (annualOperatingCashFlowEur == null) {
            throw new IllegalArgumentException("annualOperatingCashFlowEur is required");
        }
        List<BigDecimal> byYear = debtServiceByYear(schedule.installments());
        BigDecimal available = annualOperatingCashFlowEur.add(annualSavingsEur, MC);
        BigDecimal dscr = null;
        for (BigDecimal debtService : byYear) {
            if (debtService.signum() == 0) {
                continue;
            }
            BigDecimal yearDscr = available.divide(debtService, MC);
            if (dscr == null || yearDscr.compareTo(dscr) < 0) {
                dscr = yearDscr;
            }
        }
        return new Result(dscr, byYear);
    }

    static List<BigDecimal> debtServiceByYear(List<Installment> installments) {
        List<BigDecimal> years = new ArrayList<>();
        int fullYears = installments.size() / MONTHS_IN_YEAR;
        if (fullYears == 0) {
            years.add(sum(installments));
            return years;
        }
        for (int year = 0; year < fullYears; year++) {
            years.add(sum(installments.subList(year * MONTHS_IN_YEAR, (year + 1) * MONTHS_IN_YEAR)));
        }
        return years;
    }

    private static BigDecimal sum(List<Installment> installments) {
        return installments.stream().map(Installment::paymentEur).reduce(BigDecimal.ZERO, (a, b) -> a.add(b, MC));
    }
}
