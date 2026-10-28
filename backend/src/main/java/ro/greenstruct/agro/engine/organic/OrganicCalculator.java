package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * Organic conversion (README §6, category 6): revenue in each conversion year and after certification,
 * organic payments, the margin against staying conventional, the monthly liquidity gap that sizes the grace period
 * and the pre-financing line, the full-versus-phased rule, and the mineral nitrogen no longer applied.
 * Soil carbon is deliberately not calculated (README: it cannot be verified without measurements).
 *
 * <p>Stages of a tranche: 0 = conventional (before startYear), 1..n = conversion year 1..n, n + 1 = certified.
 */
public final class OrganicCalculator {

    private static final int MONTHS = 12;

    private OrganicCalculator() {
    }

    public static int stage(int year, int startYear, int conversionYears) {
        return year < startYear ? 0 : Math.min(year - startYear + 1, conversionYears + 1);
    }

    /** Yield as a fraction of the conventional yield in a stage. */
    public static BigDecimal yieldFactor(int stage, OrganicParameters p) {
        if (stage == 0) {
            return BigDecimal.ONE;
        }
        return fraction(stage <= p.conversionYears() ? p.conversionYieldPct().get(stage - 1) : p.certifiedYieldPct());
    }

    /** ha × yield/ha × (1 − yield drop) × conventional price; after certification × (1 + organic premium) too. */
    public static BigDecimal cropRevenue(CropPlan crop, BigDecimal ha, int stage, OrganicParameters p) {
        BigDecimal revenue = ha.multiply(crop.yieldTPerHa(), MC).multiply(yieldFactor(stage, p), MC)
                .multiply(crop.priceEurPerT(), MC);
        return stage > p.conversionYears()
                ? revenue.multiply(BigDecimal.ONE.add(fraction(p.organicPremiumPct()), MC), MC) : revenue;
    }

    /** One calendar year of the farm with the given tranches in conversion; the rest of the farm is conventional. */
    public static YearResult year(List<CropPlan> crops, List<Tranche> tranches, int year, OrganicParameters p) {
        Objects.requireNonNull(crops, "crops");
        BigDecimal tranchesShare = tranches.stream().map(Tranche::share).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (tranchesShare.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("Tranche shares add up to " + tranchesShare + ", more than the whole farm");
        }
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;
        BigDecimal subsidies = BigDecimal.ZERO;
        for (CropPlan crop : crops) {
            requireNonNegative(crop.ha(), "ha");
            BigDecimal conventionalHa = crop.ha().multiply(BigDecimal.ONE.subtract(tranchesShare), MC);
            revenue = revenue.add(cropRevenue(crop, conventionalHa, 0, p), MC);
            expenses = expenses.add(conventionalHa.multiply(p.conventionalCostEurPerHa(), MC), MC);
            for (Tranche tranche : tranches) {
                BigDecimal ha = crop.ha().multiply(tranche.share(), MC);
                int stage = stage(year, tranche.startYear(), p.conversionYears());
                revenue = revenue.add(cropRevenue(crop, ha, stage, p), MC);
                if (stage == 0) {
                    expenses = expenses.add(ha.multiply(p.conventionalCostEurPerHa(), MC), MC);
                } else {
                    expenses = expenses.add(ha.multiply(p.organicCostEurPerHa(), MC), MC);
                    BigDecimal payment = stage <= p.conversionYears() ? p.conversionPaymentEurPerHa()
                            : p.maintenancePaymentEurPerHa();
                    subsidies = subsidies.add(ha.multiply(payment, MC), MC);
                }
            }
        }
        return new YearResult(year, revenue, expenses, subsidies);
    }

    /** The farm if it stayed conventional (any year gives the same result). */
    public static YearResult conventional(List<CropPlan> crops, int year, OrganicParameters p) {
        return year(crops, List.of(), year, p);
    }

    /** Years firstYear .. firstYear + years − 1. */
    public static List<YearResult> plan(List<CropPlan> crops, List<Tranche> tranches, int firstYear, int years,
                                        OrganicParameters p) {
        List<YearResult> results = new ArrayList<>();
        for (int i = 0; i < years; i++) {
            results.add(year(crops, tranches, firstYear + i, p));
        }
        return results;
    }

    /** Margin of the year minus the margin of the conventional farm: negative in the conversion years. */
    public static BigDecimal marginVsConventional(YearResult year, YearResult conventional) {
        return year.marginEur().subtract(conventional.marginEur());
    }

    /** Σ over the years of the margin against conventional. */
    public static BigDecimal totalMarginVsConventional(List<YearResult> years, YearResult conventional) {
        return years.stream().map(y -> marginVsConventional(y, conventional)).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Shares of the 12 calendar months (index 0 = January) from observed monthly amounts, e.g. the Open Banking
     * inflows of the last 12 months added up by calendar month. They add up to 1.
     */
    public static List<BigDecimal> monthlyShares(List<BigDecimal> observedByCalendarMonth) {
        requireTwelve(observedByCalendarMonth, "observedByCalendarMonth");
        BigDecimal total = observedByCalendarMonth.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.signum() <= 0) {
            throw new IllegalArgumentException("observed monthly amounts must add up to more than 0");
        }
        return observedByCalendarMonth.stream().map(v -> v.divide(total, MC)).toList();
    }

    public static List<BigDecimal> spread(BigDecimal annualEur, List<BigDecimal> shares) {
        requireTwelve(shares, "shares");
        return shares.stream().map(share -> annualEur.multiply(share, MC)).toList();
    }

    /**
     * README §4 step 7 and §6: for every month, max(0, expenses + instalments − revenue − subsidies). Each list has 12
     * values (January first). The caller passes the flows that the conversion changes (against staying conventional):
     * a revenue lost to the yield drop is a negative revenue, so the gap is the extra cash the farm has to find
     * while the conventional farm would have financed its own season.
     */
    public static List<BigDecimal> monthlyGap(List<BigDecimal> expensesEur, List<BigDecimal> instalmentsEur,
                                              List<BigDecimal> revenueEur, List<BigDecimal> subsidiesEur) {
        requireTwelve(expensesEur, "expensesEur");
        requireTwelve(instalmentsEur, "instalmentsEur");
        requireTwelve(revenueEur, "revenueEur");
        requireTwelve(subsidiesEur, "subsidiesEur");
        List<BigDecimal> gap = new ArrayList<>(MONTHS);
        for (int m = 0; m < MONTHS; m++) {
            BigDecimal need = expensesEur.get(m).add(instalmentsEur.get(m), MC).subtract(revenueEur.get(m), MC)
                    .subtract(subsidiesEur.get(m), MC);
            gap.add(need.max(BigDecimal.ZERO));
        }
        return gap;
    }

    public static BigDecimal total(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static BigDecimal peak(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::max);
    }

    /**
     * Grace period sized by the gap: the loan pays nothing until the last month that still has a gap, counted from the
     * first month of the loan, at most maxGraceMonths (README §13: until the first harvest, at most 12).
     * gapFromLoanStart has the monthly gap without instalments, starting with the first month of the loan.
     */
    public static int graceMonths(List<BigDecimal> gapFromLoanStart, int maxGraceMonths) {
        int grace = 0;
        for (int i = 0; i < Math.min(maxGraceMonths, gapFromLoanStart.size()); i++) {
            if (gapFromLoanStart.get(i).signum() > 0) {
                grace = i + 1;
            }
        }
        return grace;
    }

    /** What the APIA subsidy pre-financing (F5) can advance: the share of the subsidy claim of the year. */
    public static BigDecimal prefinancingCapacity(BigDecimal advanceSharePct, BigDecimal subsidyClaimEur) {
        return subsidyClaimEur.multiply(fraction(advanceSharePct), MC);
    }

    /**
     * Full against phased (README §6 D): phasing shrinks the first-year gap but delays the benefit, so it is
     * recommended only when the first-year gap of the full conversion cannot be covered by the grace period and
     * the APIA pre-financing, and only if it actually reduces that gap. Each coverage is the pre-financing capacity
     * of that plan (it depends on the organic payments the plan claims in the year); the gaps are those of the
     * first conversion year (the grace period keeps the instalments out of it).
     */
    public static PhasingAdvice advisePhasing(BigDecimal fullFirstYearGapEur, BigDecimal fullCoverageEur,
                                              BigDecimal phasedFirstYearGapEur, BigDecimal phasedCoverageEur) {
        boolean fullCovered = fullFirstYearGapEur.compareTo(fullCoverageEur) <= 0;
        boolean phasedCovered = phasedFirstYearGapEur.compareTo(phasedCoverageEur) <= 0;
        boolean phase = !fullCovered && phasedFirstYearGapEur.compareTo(fullFirstYearGapEur) < 0;
        BigDecimal shortfall = phase ? phasedFirstYearGapEur.subtract(phasedCoverageEur)
                : fullFirstYearGapEur.subtract(fullCoverageEur);
        return new PhasingAdvice(phase ? PhasingAdvice.Choice.PHASED : PhasingAdvice.Choice.FULL, fullCovered,
                phasedCovered, shortfall.max(BigDecimal.ZERO));
    }

    /** Mineral nitrogen not applied any more: kg N/ha × ha. */
    public static BigDecimal nitrogenAvoidedKg(BigDecimal kgNPerHa, BigDecimal ha) {
        return kgNPerHa.multiply(ha, MC);
    }

    /** kg N in a fertilizer delivery: product kg × N content (34% for ammonium nitrate). */
    public static BigDecimal nitrogenInFertilizerKg(BigDecimal productKg, BigDecimal nContentPct) {
        return productKg.multiply(fraction(nContentPct), MC);
    }

    /** kg N × kg CO₂e/kg N / 1000 (README §6: 4.29). */
    public static BigDecimal co2eAvoidedTonnes(BigDecimal nitrogenKg, BigDecimal kgCo2ePerKgN) {
        return ImpactCalculator.co2Tonnes(nitrogenKg, kgCo2ePerKgN);
    }

    private static void requireTwelve(List<BigDecimal> values, String name) {
        if (values == null || values.size() != MONTHS) {
            throw new IllegalArgumentException(name + " must have 12 monthly values");
        }
    }
}
