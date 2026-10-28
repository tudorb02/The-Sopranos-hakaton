package ro.greenstruct.agro.engine.energy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Values worked out by hand for the avicultural farm of the demo (215,000 kWh/year, 55% by day, 1,250 kWh/kWp,
 * buy 0.19, sell 0.06 EUR/kWh) from the monthly invoices and the production profile, not from the code.
 */
class EnergyCalculatorTest {

    private static final BigDecimal TOLERANCE = new BigDecimal("0.0001");

    /** January to December, from the invoices (kWh). Sum 215,000. */
    private static final List<BigDecimal> CONSUMPTION = kwh(19000, 17000, 16000, 15000, 17000, 20000, 23000, 22000,
            17000, 15000, 15500, 18500);

    /** Share of the yearly production per month, January to December. Sum 1. */
    private static final List<BigDecimal> SHARES = Stream.of("0.035", "0.05", "0.08", "0.1", "0.12", "0.125", "0.13",
            "0.12", "0.09", "0.07", "0.045", "0.035").map(BigDecimal::new).toList();

    private static final BigDecimal YIELD = new BigDecimal("1250");
    private static final BigDecimal DAY_55 = new BigDecimal("55");

    private static List<BigDecimal> kwh(int... values) {
        return java.util.Arrays.stream(values).mapToObj(BigDecimal::valueOf).toList();
    }

    @Test
    void annualProductionIsPowerTimesSpecificYield() {
        // 100 kWp × 1,250 = 125,000 kWh; 300 kWp × 1,250 = 375,000 kWh
        assertThat(EnergyCalculator.annualProductionKwh(new BigDecimal("100"), YIELD)).isEqualByComparingTo("125000");
        assertThat(EnergyCalculator.annualProductionKwh(new BigDecimal("300"), YIELD)).isEqualByComparingTo("375000");
    }

    @Test
    void monthlyProductionFollowsTheProfile() {
        List<BigDecimal> months = EnergyCalculator.monthlyProductionKwh(new BigDecimal("125000"), SHARES);

        // 125,000 × 0.035 = 4,375 (Jan); × 0.125 = 15,625 (Jun); × 0.13 = 16,250 (Jul)
        assertThat(months.get(0)).isEqualByComparingTo("4375");
        assertThat(months.get(5)).isEqualByComparingTo("15625");
        assertThat(months.get(6)).isEqualByComparingTo("16250");
        assertThat(months.stream().reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("125000");
    }

    @Test
    void profileThatDoesNotSumToOneIsRefused() {
        List<BigDecimal> shares = SHARES.stream().map(s -> s.multiply(new BigDecimal("1.1"))).toList();

        assertThatThrownBy(() -> EnergyCalculator.monthlyProductionKwh(new BigDecimal("1000"), shares))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("sum to 1");
    }

    @Test
    void oversizedInstallationSellsSixtyEightPercent() {
        PvBalance balance = EnergyCalculator.balance(new BigDecimal("300"), YIELD, SHARES, CONSUMPTION, DAY_55);

        // Production exceeds the daytime consumption in every month, so E_auto = 55% × 215,000 = 118,250 kWh.
        assertThat(balance.productionKwh()).isEqualByComparingTo("375000");
        assertThat(balance.selfConsumedKwh()).isEqualByComparingTo("118250");
        assertThat(balance.exportedKwh()).isEqualByComparingTo("256750");
        // 256,750 / 375,000 = 68.4667%; 118,250 / 375,000 = 31.5333%; 118,250 / 215,000 = 55%
        assertThat(balance.exportSharePct()).isCloseTo(new BigDecimal("68.4667"), within(TOLERANCE));
        assertThat(balance.selfShareOfProductionPct()).isCloseTo(new BigDecimal("31.5333"), within(TOLERANCE));
        assertThat(balance.coveragePct()).isEqualByComparingTo("55");
    }

    @Test
    void resizedInstallationOnlyCountsMonthsWhereProductionIsBelowDaytimeUse() {
        PvBalance balance = EnergyCalculator.balance(new BigDecimal("100"), YIELD, SHARES, CONSUMPTION, DAY_55);

        // Per month min(production, 55% of consumption): 4,375 + 6,250 + 8,800 + 8,250 + 9,350 + 11,000 + 12,650
        // + 12,100 + 9,350 + 8,250 + 5,625 + 4,375 = 100,375 kWh (production is the smaller one in Jan, Feb, Nov, Dec).
        assertThat(balance.selfConsumedKwh()).isEqualByComparingTo("100375");
        assertThat(balance.exportedKwh()).isEqualByComparingTo("24625");
        // 24,625 / 125,000 = 19.7%; 100,375 / 125,000 = 80.3%; 100,375 / 215,000 = 46.6860%
        assertThat(balance.exportSharePct()).isEqualByComparingTo("19.7");
        assertThat(balance.selfShareOfProductionPct()).isEqualByComparingTo("80.3");
        assertThat(balance.coveragePct()).isCloseTo(new BigDecimal("46.6860"), within(TOLERANCE));
    }

    @Test
    void onlyTheHundredKilowattSizeFitsTheThirtyPercentExportLimit() {
        BigDecimal limit = new BigDecimal("30");

        // 150 kWp: E_auto 110,662.5 of 187,500 → 40.98% sold. 200 kWp: E_auto 115,125 of 250,000 → 53.95% sold.
        PvBalance kwp150 = EnergyCalculator.balance(new BigDecimal("150"), YIELD, SHARES, CONSUMPTION, DAY_55);
        PvBalance kwp200 = EnergyCalculator.balance(new BigDecimal("200"), YIELD, SHARES, CONSUMPTION, DAY_55);
        assertThat(kwp150.selfConsumedKwh()).isEqualByComparingTo("110662.5");
        assertThat(kwp150.exportSharePct()).isCloseTo(new BigDecimal("40.98"), within(new BigDecimal("0.01")));
        assertThat(kwp200.selfConsumedKwh()).isEqualByComparingTo("115125");
        assertThat(kwp200.exportSharePct()).isCloseTo(new BigDecimal("53.95"), within(new BigDecimal("0.01")));

        assertThat(EnergyCalculator.exportWithinLimit(new BigDecimal("19.7"), limit)).isTrue();
        assertThat(EnergyCalculator.exportWithinLimit(kwp150.exportSharePct(), limit)).isFalse();
        assertThat(EnergyCalculator.exportWithinLimit(kwp200.exportSharePct(), limit)).isFalse();
        assertThat(EnergyCalculator.exportWithinLimit(new BigDecimal("68.4667"), limit)).isFalse();
        assertThat(EnergyCalculator.exportWithinLimit(new BigDecimal("30"), limit)).isTrue();
    }

    @Test
    void savingsAreSelfConsumedAtBuyPricePlusSoldAtSellPrice() {
        BigDecimal buy = new BigDecimal("0.19");
        BigDecimal sell = new BigDecimal("0.06");

        // 118,250 × 0.19 + 256,750 × 0.06 = 22,467.50 + 15,405 = 37,872.50
        assertThat(EnergyCalculator.savingsEur(new BigDecimal("118250"), new BigDecimal("256750"), buy, sell))
                .isEqualByComparingTo("37872.5");
        // 100,375 × 0.19 + 24,625 × 0.06 = 19,071.25 + 1,477.50 = 20,548.75
        assertThat(EnergyCalculator.savingsEur(new BigDecimal("100375"), new BigDecimal("24625"), buy, sell))
                .isEqualByComparingTo("20548.75");
    }

    @Test
    void paybackIsInvestmentOverYearlySavings() {
        // 210,000 / 37,872.5 = 5.5449 years; 72,000 / 20,548.75 = 3.5039 years
        assertThat(EnergyCalculator.paybackYears(new BigDecimal("210000"), new BigDecimal("37872.5")).orElseThrow())
                .isCloseTo(new BigDecimal("5.5449"), within(TOLERANCE));
        assertThat(EnergyCalculator.paybackYears(new BigDecimal("72000"), new BigDecimal("20548.75")).orElseThrow())
                .isCloseTo(new BigDecimal("3.5039"), within(TOLERANCE));
        assertThat(EnergyCalculator.paybackYears(new BigDecimal("72000"), BigDecimal.ZERO)).isEmpty();
        // 3.5039 years × 12 = 42.05 months
        assertThat(EnergyCalculator.paybackMonths(new BigDecimal("72000"), new BigDecimal("20548.75")).orElseThrow())
                .isCloseTo(new BigDecimal("42.0464"), within(TOLERANCE));
    }

    @Test
    void co2IsProductionInMwhTimesGridFactor() {
        // 125 MWh × 0.26 t/MWh = 32.5 t; 375 MWh × 0.26 = 97.5 t
        assertThat(EnergyCalculator.co2AvoidedTonnes(new BigDecimal("125000"), new BigDecimal("0.26")))
                .isEqualByComparingTo("32.5");
        assertThat(EnergyCalculator.co2AvoidedTonnes(new BigDecimal("375000"), new BigDecimal("0.26")))
                .isEqualByComparingTo("97.5");
    }

    @Test
    void solarPumpReplacesDieselLitresAndTheirCo2() {
        SolarPumpSaving saving = EnergyCalculator.solarPump(new BigDecimal("5000"), new BigDecimal("1.25"),
                new BigDecimal("2.68"));

        // 5,000 l × 1.25 EUR = 6,250 EUR; 5,000 × 2.68 / 1,000 = 13.4 t CO₂
        assertThat(saving.litres()).isEqualByComparingTo("5000");
        assertThat(saving.savingEur()).isEqualByComparingTo("6250");
        assertThat(saving.co2Tonnes()).isEqualByComparingTo("13.4");
    }

    @Test
    void missingInvoiceMonthsTakeTheMeanOfTheKnownOnes() {
        List<BigDecimal> months = EnergyCalculator.completeMonths(
                Map.of(1, new BigDecimal("100"), 2, new BigDecimal("200"), 3, new BigDecimal("300")));

        // mean of 100, 200, 300 = 200 for the nine missing months
        assertThat(months).hasSize(12);
        assertThat(months.get(0)).isEqualByComparingTo("100");
        assertThat(months.get(2)).isEqualByComparingTo("300");
        assertThat(months.get(3)).isEqualByComparingTo("200");
        assertThat(months.get(11)).isEqualByComparingTo("200");
        assertThatThrownBy(() -> EnergyCalculator.completeMonths(Map.of())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void roofAreaIsPowerTimesAreaPerKilowattPeak() {
        // 300 kWp × 5.5 m²/kWp = 1,650 m² (the offer states ≈ 1,650 m²); 100 kWp → 550 m²
        assertThat(EnergyCalculator.areaNeededM2(new BigDecimal("300"), new BigDecimal("5.5"))).isEqualByComparingTo("1650");
        assertThat(EnergyCalculator.areaNeededM2(new BigDecimal("100"), new BigDecimal("5.5"))).isEqualByComparingTo("550");
    }

    @Test
    void wrongNumberOfMonthsIsRefused() {
        assertThatThrownBy(() -> EnergyCalculator.selfConsumedKwh(CONSUMPTION.subList(0, 11), CONSUMPTION, DAY_55))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("12 months");
    }
}
