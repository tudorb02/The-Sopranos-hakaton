package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Values worked out by hand for the Product demo farm (DEMO-0003): 600 ha, 46,800 l of diesel, 84,020 kg N, a tractor
 * that uses 68 l/ha and a GPS RTK that cuts diesel by 9% and nitrogen by 5%.
 */
class MachineryCalculatorTest {

    private static final BigDecimal HA = new BigDecimal("600");
    private static final BigDecimal OLD_L_PER_HA = new BigDecimal("78");

    @Test
    void currentDieselPerHectareIsInvoicedLitresOverWorkedArea() {
        // 46,800 / 600 = 78
        assertThat(MachineryCalculator.litresPerHa(new BigDecimal("46800"), HA)).isEqualByComparingTo("78");
    }

    @Test
    void theRequestedTractorAloneSavesTwelvePointEightPercent() {
        FuelComparison fuel = MachineryCalculator.fuel(HA, OLD_L_PER_HA, new BigDecimal("68"), List.of());

        // 1 − 68/78 = 10/78 = 12.8205%; (78 − 68) × 600 = 6,000 l
        assertThat(fuel.litresPerHaAfter()).isEqualByComparingTo("68");
        assertThat(fuel.savingPct().setScale(4, RoundingMode.HALF_EVEN)).isEqualByComparingTo("12.8205");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("6000");
    }

    @Test
    void gpsMultipliesTheTractorConsumption() {
        FuelComparison fuel = MachineryCalculator.fuel(HA, OLD_L_PER_HA, new BigDecimal("68"),
                List.of(new BigDecimal("9")));

        // 68 × (1 − 0.09) = 61.88; 1 − 61.88/78 = 16.12/78 = 20.6667%; 16.12 × 600 = 9,672 l
        assertThat(fuel.litresPerHaAfter()).isEqualByComparingTo("61.88");
        assertThat(fuel.savingPct().setScale(4, RoundingMode.HALF_EVEN)).isEqualByComparingTo("20.6667");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("9672");
    }

    @Test
    void severalPrecisionUpgradesStackOnWhatIsLeft() {
        FuelComparison fuel = MachineryCalculator.fuel(HA, OLD_L_PER_HA, new BigDecimal("70"),
                List.of(new BigDecimal("9"), new BigDecimal("10")));

        // 70 × 0.91 × 0.90 = 57.33; (78 − 57.33) × 600 = 12,402 l
        assertThat(fuel.litresPerHaAfter()).isEqualByComparingTo("57.33");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("12402");
    }

    @Test
    void aTractorThatUsesMoreThanTheOldOneHasNegativeSavings() {
        FuelComparison fuel = MachineryCalculator.fuel(HA, OLD_L_PER_HA, new BigDecimal("90"), List.of());

        // 1 − 90/78 = −15.3846%; (78 − 90) × 600 = −7,200 l
        assertThat(fuel.savingPct().setScale(4, RoundingMode.HALF_EVEN)).isEqualByComparingTo("-15.3846");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("-7200");
    }

    @Test
    void severalTractorsAreAveragedByPower() {
        // (68 × 300 + 80 × 100) / 400 = 28,400 / 400 = 71
        BigDecimal average = MachineryCalculator.weightedAverage(
                List.of(new BigDecimal("68"), new BigDecimal("80")), List.of(new BigDecimal("300"), new BigDecimal("100")));

        assertThat(average).isEqualByComparingTo("71");
    }

    @Test
    void nitrogenReductionsOfTheTechnologiesAdd() {
        // GPS 5% + variable-rate module 12% = 17%; 84,020 × 5% = 4,201 kg; 84,020 × 17% = 14,283.4 kg
        assertThat(MachineryCalculator.nitrogenReductionPct(List.of(new BigDecimal("5"), new BigDecimal("12"))))
                .isEqualByComparingTo("17");
        assertThat(MachineryCalculator.nitrogenSavedKg(new BigDecimal("84020"), new BigDecimal("5")))
                .isEqualByComparingTo("4201");
        assertThat(MachineryCalculator.nitrogenSavedKg(new BigDecimal("84020"), new BigDecimal("17")))
                .isEqualByComparingTo("14283.4");
    }

    @Test
    void nitrogenReductionsAboveAHundredPercentAreRejected() {
        assertThatThrownBy(() -> MachineryCalculator.nitrogenReductionPct(
                List.of(new BigDecimal("60"), new BigDecimal("60")))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void yearlySavingsPriceTheLitresAndTheKilogramsOfNitrogen() {
        // 9,672 l × 1.25 EUR/l = 12,090; 4,201 kg × 1.00 EUR/kg = 4,201; together 16,291
        BigDecimal total = MachineryCalculator.savingsEur(new BigDecimal("9672"), new BigDecimal("1.25"),
                new BigDecimal("4201"), BigDecimal.ONE);

        assertThat(total).isEqualByComparingTo("16291");
    }

    @Test
    void co2eAddsTheDieselAndTheNitrogenEmissions() {
        // 9,672 × 2.68 = 25,920.96 kg; 4,201 × 4.29 = 18,022.29 kg; (25,920.96 + 18,022.29) / 1000 = 43.94325 t
        BigDecimal co2e = MachineryCalculator.co2eTonnes(new BigDecimal("9672"), new BigDecimal("2.68"),
                new BigDecimal("4201"), new BigDecimal("4.29"));

        assertThat(co2e).isEqualByComparingTo("43.94325");
    }

    @Test
    void netDieselPriceRemovesVatAndExciseRefund() {
        // 10.3 / 1.21 = 8.5124 lei; − 2.697 = 5.8154 lei; / 4.97 = 1.1701 EUR
        BigDecimal eurPerLitre = MachineryCalculator.netDieselEurPerLitre(new BigDecimal("10.3"), new BigDecimal("21"),
                new BigDecimal("2.697"), new BigDecimal("4.97"));

        assertThat(eurPerLitre.setScale(4, RoundingMode.HALF_EVEN)).isEqualByComparingTo("1.1701");
    }

    @Test
    void offeredPowerIsCheckedAgainstArea() {
        PowerCheck ok = MachineryCalculator.power(new BigDecimal("300"), HA, new BigDecimal("2.5"));
        PowerCheck tooMuch = MachineryCalculator.power(new BigDecimal("1800"), HA, new BigDecimal("2.5"));

        // 300 / 600 = 0.5 CP/ha; 1,800 / 600 = 3 CP/ha > 2.5
        assertThat(ok.hpPerHa()).isEqualByComparingTo("0.5");
        assertThat(ok.withinLimit()).isTrue();
        assertThat(tooMuch.withinLimit()).isFalse();
    }
}
