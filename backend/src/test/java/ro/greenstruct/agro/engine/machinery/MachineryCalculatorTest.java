package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MachineryCalculatorTest {

    private static final BigDecimal HA_400 = new BigDecimal("400");
    private static final BigDecimal LITRES_PER_HA = new BigDecimal("90");

    @Test
    void newTractorsAloneSaveTwelvePercent() {
        FuelComparison fuel = MachineryCalculator.fuel(HA_400, LITRES_PER_HA, List.of(new BigDecimal("12")));

        assertThat(fuel.baselineLitres()).isEqualByComparingTo("36000");
        assertThat(fuel.proposedLitres()).isEqualByComparingTo("31680");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("4320");
    }

    @Test
    void precisionPackageStacksOnRemainingFuel() {
        FuelComparison fuel = MachineryCalculator.fuel(HA_400, LITRES_PER_HA,
                List.of(new BigDecimal("12"), new BigDecimal("10")));

        assertThat(fuel.proposedLitres()).isEqualByComparingTo("28512");
        assertThat(fuel.savedLitres()).isEqualByComparingTo("7488");
        assertThat(fuel.savingPct()).isEqualByComparingTo("20.8");
    }

    @Test
    void netDieselPriceRemovesVatAndExciseRefund() {
        BigDecimal eurPerLitre = MachineryCalculator.netDieselEurPerLitre(new BigDecimal("10.3"), new BigDecimal("21"),
                new BigDecimal("2.697"), new BigDecimal("4.97"));

        assertThat(eurPerLitre.setScale(4, RoundingMode.HALF_EVEN)).isEqualByComparingTo("1.1701");
    }

    @Test
    void variableRateSavesNitrogen() {
        assertThat(MachineryCalculator.nitrogenSavedKg(HA_400, new BigDecimal("150"), new BigDecimal("5")))
                .isEqualByComparingTo("3000");
    }

    @Test
    void fleetPowerIsCheckedAgainstArea() {
        PowerCheck ok = MachineryCalculator.power(new BigDecimal("800"), HA_400, new BigDecimal("2.5"));
        PowerCheck tooMuch = MachineryCalculator.power(new BigDecimal("1200"), HA_400, new BigDecimal("2.5"));

        assertThat(ok.hpPerHa()).isEqualByComparingTo("2");
        assertThat(ok.withinLimit()).isTrue();
        assertThat(tooMuch.withinLimit()).isFalse();
    }
}
