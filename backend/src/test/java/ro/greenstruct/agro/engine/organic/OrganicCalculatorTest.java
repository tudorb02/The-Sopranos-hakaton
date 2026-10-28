package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Expected values computed by hand / in a separate script from the farm DEMO-0006 (120 ha: wheat 50 ha 6 t/ha 210 EUR/t,
 * maize 40 ha 8 t/ha 190 EUR/t, soy 30 ha 3 t/ha 400 EUR/t), not taken from the code's output. The margins match the
 * Product team's data/demo/test-documents/farms/DEMO-0006.json (scripts/demo-docs/verify.mjs).
 */
class OrganicCalculatorTest {

    private static final OrganicParameters P = new OrganicParameters(
            List.of(bd("70"), bd("75")), bd("80"), bd("45"), bd("950"), bd("1000"), bd("220"), bd("200"));

    private static final List<CropPlan> CROPS = List.of(
            new CropPlan("grâu", bd("50"), bd("6"), bd("210")),
            new CropPlan("porumb", bd("40"), bd("8"), bd("190")),
            new CropPlan("soia", bd("30"), bd("3"), bd("400")));

    private static final List<Tranche> FULL = List.of(new Tranche(bd("1"), 2027));
    private static final List<Tranche> PHASED = List.of(new Tranche(bd("0.5"), 2027), new Tranche(bd("0.5"), 2028));

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    void stagesRunFromConventionalThroughConversionToCertified() {
        assertThat(OrganicCalculator.stage(2026, 2027, 2)).isZero();
        assertThat(OrganicCalculator.stage(2027, 2027, 2)).isEqualTo(1);
        assertThat(OrganicCalculator.stage(2028, 2027, 2)).isEqualTo(2);
        assertThat(OrganicCalculator.stage(2029, 2027, 2)).isEqualTo(3);
        assertThat(OrganicCalculator.stage(2035, 2027, 2)).isEqualTo(3);
    }

    @Test
    void revenueOfWheatInEachStage() {
        CropPlan wheat = CROPS.get(0);
        // 50 ha × 6 t/ha × 210 EUR/t = 63,000 conventional
        assertThat(OrganicCalculator.cropRevenue(wheat, bd("50"), 0, P)).isEqualByComparingTo("63000");
        // year 1: × 0.70 = 44,100; year 2: × 0.75 = 47,250
        assertThat(OrganicCalculator.cropRevenue(wheat, bd("50"), 1, P)).isEqualByComparingTo("44100");
        assertThat(OrganicCalculator.cropRevenue(wheat, bd("50"), 2, P)).isEqualByComparingTo("47250");
        // certified: 50 × 6 × 0.80 × 210 × 1.45 = 73,080
        assertThat(OrganicCalculator.cropRevenue(wheat, bd("50"), 3, P)).isEqualByComparingTo("73080");
    }

    @Test
    void conventionalFarmMargin() {
        // revenue 63,000 + 60,800 + 36,000 = 159,800; costs 120 ha × 950 = 114,000
        YearResult conventional = OrganicCalculator.conventional(CROPS, 2027, P);
        assertThat(conventional.revenueEur()).isEqualByComparingTo("159800");
        assertThat(conventional.expensesEur()).isEqualByComparingTo("114000");
        assertThat(conventional.subsidiesEur()).isZero();
        assertThat(conventional.marginEur()).isEqualByComparingTo("45800");
    }

    @Test
    void fullConversionMarginAgainstConventional() {
        YearResult conventional = OrganicCalculator.conventional(CROPS, 2027, P);
        List<YearResult> years = OrganicCalculator.plan(CROPS, FULL, 2027, 4, P);

        // 2027: revenue 44,100 + 42,560 + 25,200 = 111,860; costs 120,000; conversion payment 120 × 220 = 26,400
        assertThat(years.get(0).revenueEur()).isEqualByComparingTo("111860");
        assertThat(years.get(0).expensesEur()).isEqualByComparingTo("120000");
        assertThat(years.get(0).subsidiesEur()).isEqualByComparingTo("26400");
        assertThat(OrganicCalculator.marginVsConventional(years.get(0), conventional)).isEqualByComparingTo("-27540");
        // 2028: revenue 47,250 + 45,600 + 27,000 = 119,850 + 26,400 − 120,000 = 26,250 → −19,550
        assertThat(OrganicCalculator.marginVsConventional(years.get(1), conventional)).isEqualByComparingTo("-19550");
        // 2029 and 2030: revenue 73,080 + 70,528 + 41,760 = 185,368; maintenance 24,000 → 89,368 − 45,800 = 43,568
        assertThat(OrganicCalculator.marginVsConventional(years.get(2), conventional)).isEqualByComparingTo("43568");
        assertThat(OrganicCalculator.marginVsConventional(years.get(3), conventional)).isEqualByComparingTo("43568");
        assertThat(OrganicCalculator.totalMarginVsConventional(years, conventional)).isEqualByComparingTo("40046");
    }

    @Test
    void phasedConversionShrinksTheFirstYearAndDelaysTheBenefit() {
        YearResult conventional = OrganicCalculator.conventional(CROPS, 2027, P);
        List<YearResult> years = OrganicCalculator.plan(CROPS, PHASED, 2027, 4, P);

        // 2027: half converted (year 1) + half conventional: revenue 55,930 + 79,900 = 135,830; costs 60,000 + 57,000;
        // payment 60 × 220 = 13,200 → margin 32,030 → −13,770
        assertThat(years.get(0).revenueEur()).isEqualByComparingTo("135830");
        assertThat(years.get(0).expensesEur()).isEqualByComparingTo("117000");
        assertThat(years.get(0).subsidiesEur()).isEqualByComparingTo("13200");
        assertThat(OrganicCalculator.marginVsConventional(years.get(0), conventional)).isEqualByComparingTo("-13770");
        assertThat(OrganicCalculator.marginVsConventional(years.get(1), conventional)).isEqualByComparingTo("-23545");
        assertThat(OrganicCalculator.marginVsConventional(years.get(2), conventional)).isEqualByComparingTo("12009");
        assertThat(OrganicCalculator.marginVsConventional(years.get(3), conventional)).isEqualByComparingTo("43568");
        assertThat(OrganicCalculator.totalMarginVsConventional(years, conventional)).isEqualByComparingTo("18262");
    }

    @Test
    void tranchesCannotExceedTheFarm() {
        assertThatThrownBy(() -> OrganicCalculator.year(CROPS,
                List.of(new Tranche(bd("0.7"), 2027), new Tranche(bd("0.5"), 2028)), 2027, P))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void monthlySharesAddUpToOne() {
        List<BigDecimal> shares = OrganicCalculator.monthlyShares(twelve("2", "2", "6", "10", "0", "0", "0", "0", "0", "0", "0", "0"));
        assertThat(shares.get(0)).isEqualByComparingTo("0.1");
        assertThat(shares.get(2)).isEqualByComparingTo("0.3");
        assertThat(shares.get(3)).isEqualByComparingTo("0.5");
        assertThat(OrganicCalculator.total(shares)).isEqualByComparingTo("1");
    }

    @Test
    void monthlyGapIsTheShortfallOfEachMonthNeverNegative() {
        List<BigDecimal> gap = OrganicCalculator.monthlyGap(
                twelve("100", "100", "100", "100", "0", "0", "0", "0", "0", "0", "0", "0"),
                twelve("0", "50", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"),
                twelve("40", "40", "400", "-20", "10", "0", "0", "0", "0", "0", "0", "0"),
                twelve("0", "0", "0", "30", "0", "0", "0", "0", "0", "0", "0", "0"));
        // Jan 100−40 = 60; Feb 100+50−40 = 110; Mar 100−400 < 0 → 0; Apr 100+20−30 = 90; May 0−10 < 0 → 0
        assertThat(gap.subList(0, 5)).usingComparatorForType(BigDecimal::compareTo, BigDecimal.class)
                .containsExactly(bd("60"), bd("110"), bd("0"), bd("90"), bd("0"));
        assertThat(OrganicCalculator.total(gap)).isEqualByComparingTo("260");
        assertThat(OrganicCalculator.peak(gap)).isEqualByComparingTo("110");
    }

    @Test
    void firstYearGapOfTheDemoFarmFollowsTheOpenBankingSeasonality() {
        // Open Banking, kEUR by calendar month Jan..Dec: inflows 2 2 3 2 3 6 34 26 22 38 24 30 (sum 192),
        // outflows 7 12 22 18 10 9 14 13 12 16 12 8 (sum 153). Conversion changes the flows by (full plan, 2027 vs conventional):
        // revenue 111,860 − 159,800 = −47,940; expenses 120,000 − 114,000 = +6,000; subsidies 26,400 paid 70% Oct, 30% Dec.
        List<BigDecimal> inShares = OrganicCalculator.monthlyShares(twelve("2", "2", "3", "2", "3", "6", "34", "26", "22", "38", "24", "30"));
        List<BigDecimal> outShares = OrganicCalculator.monthlyShares(twelve("7", "12", "22", "18", "10", "9", "14", "13", "12", "16", "12", "8"));
        List<BigDecimal> subsidyShares = twelve("0", "0", "0", "0", "0", "0", "0", "0", "0", "0.7", "0", "0.3");

        List<BigDecimal> gap = OrganicCalculator.monthlyGap(
                OrganicCalculator.spread(bd("6000"), outShares), zeros(),
                OrganicCalculator.spread(bd("-47940"), inShares), OrganicCalculator.spread(bd("26400"), subsidyShares));

        // July: 6,000 × 14/153 + 47,940 × 34/192 = 549.0196 + 8,489.375 = 9,038.3946
        assertThat(gap.get(6)).isCloseTo(bd("9038.3946"), org.assertj.core.data.Offset.offset(bd("0.0001")));
        // October (70% of the payment arrives) and December have no gap
        assertThat(gap.get(9)).isZero();
        assertThat(gap.get(11)).isZero();
        assertThat(OrganicCalculator.total(gap)).isCloseTo(bd("36020.0735"), org.assertj.core.data.Offset.offset(bd("0.001")));
        assertThat(OrganicCalculator.peak(gap)).isCloseTo(bd("9038.3946"), org.assertj.core.data.Offset.offset(bd("0.0001")));
    }

    @Test
    void graceRunsUntilTheLastMonthWithAGapButNotBeyondTheCap() {
        List<BigDecimal> gap = new ArrayList<>(twelve("0", "0", "5", "0", "3", "0", "0", "0", "0", "0", "0", "9"));
        assertThat(OrganicCalculator.graceMonths(gap, 12)).isEqualTo(12);
        assertThat(OrganicCalculator.graceMonths(gap, 6)).isEqualTo(5);
        assertThat(OrganicCalculator.graceMonths(gap, 4)).isEqualTo(3);
        assertThat(OrganicCalculator.graceMonths(twelve("0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"), 12)).isZero();
    }

    @Test
    void prefinancingCapacityIsAShareOfTheSubsidyClaim() {
        // 80% × (24,000 existing APIA + 26,400 conversion payment) = 40,320
        assertThat(OrganicCalculator.prefinancingCapacity(bd("80"), bd("50400"))).isEqualByComparingTo("40320");
    }

    @Test
    void fullConversionWhenItsGapIsCovered() {
        PhasingAdvice advice = OrganicCalculator.advisePhasing(bd("36020"), bd("40320"), bd("18010"), bd("29760"));
        assertThat(advice.choice()).isEqualTo(PhasingAdvice.Choice.FULL);
        assertThat(advice.fullCovered()).isTrue();
        assertThat(advice.shortfallEur()).isZero();
    }

    @Test
    void phasedConversionWhenOnlyPhasingKeepsTheGapWithinThePrefinancing() {
        PhasingAdvice advice = OrganicCalculator.advisePhasing(bd("50000"), bd("40320"), bd("25000"), bd("29760"));
        assertThat(advice.choice()).isEqualTo(PhasingAdvice.Choice.PHASED);
        assertThat(advice.fullCovered()).isFalse();
        assertThat(advice.phasedCovered()).isTrue();
        assertThat(advice.shortfallEur()).isZero();
    }

    @Test
    void phasedConversionStillShortOfPrefinancingReportsTheShortfall() {
        PhasingAdvice advice = OrganicCalculator.advisePhasing(bd("90000"), bd("40320"), bd("60000"), bd("29760"));
        assertThat(advice.choice()).isEqualTo(PhasingAdvice.Choice.PHASED);
        assertThat(advice.phasedCovered()).isFalse();
        assertThat(advice.shortfallEur()).isEqualByComparingTo("30240");
    }

    @Test
    void phasingIsNotRecommendedWhenItDoesNotShrinkTheGap() {
        PhasingAdvice advice = OrganicCalculator.advisePhasing(bd("50000"), bd("40320"), bd("50000"), bd("29760"));
        assertThat(advice.choice()).isEqualTo(PhasingAdvice.Choice.FULL);
        assertThat(advice.shortfallEur()).isEqualByComparingTo("9680");
    }

    @Test
    void nitrogenAvoidedAndItsCo2e() {
        // two invoices of ammonium nitrate 34% N: (26,000 + 20,000) kg × 0.34 = 15,640 kg N
        BigDecimal kgN = OrganicCalculator.nitrogenInFertilizerKg(bd("46000"), bd("34"));
        assertThat(kgN).isEqualByComparingTo("15640");
        // 15,640 × 4.29 / 1,000 = 67.0956 t CO2e
        assertThat(OrganicCalculator.co2eAvoidedTonnes(kgN, bd("4.29"))).isEqualByComparingTo("67.0956");
        // 130 kg N/ha × 120 ha = 15,600 kg
        assertThat(OrganicCalculator.nitrogenAvoidedKg(bd("130"), bd("120"))).isEqualByComparingTo("15600");
    }

    private static List<BigDecimal> twelve(String... values) {
        return java.util.Arrays.stream(values).map(BigDecimal::new).toList();
    }

    private static List<BigDecimal> zeros() {
        return java.util.Collections.nCopies(12, BigDecimal.ZERO);
    }
}
