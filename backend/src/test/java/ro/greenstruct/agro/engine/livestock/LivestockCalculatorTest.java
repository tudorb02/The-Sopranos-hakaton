package ro.greenstruct.agro.engine.livestock;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Expected values worked out by hand for a 150-cow dairy farm (EF 22 kg CH4/head/year, GWP 27). */
class LivestockCalculatorTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    void methaneTodayIsHeadsTimesEmissionFactor() {
        // 150 × 22 = 3,300 kg CH4 per year
        assertThat(LivestockCalculator.methaneKg(bd("150"), bd("22"))).isEqualByComparingTo("3300");
    }

    @Test
    void digesterAloneCutsFortyFivePercent() {
        MethaneComparison m = LivestockCalculator.methane(bd("3300"), bd("45"));

        // 3,300 × 0.55 = 1,815 kg left; 3,300 − 1,815 = 1,485 kg saved
        assertThat(m.newKg()).isEqualByComparingTo("1815");
        assertThat(m.savedKg()).isEqualByComparingTo("1485");
        assertThat(m.reductionPct()).isEqualByComparingTo("45");
    }

    @Test
    void coveredDigestateTankBringsTheTotalToEightyFivePercent() {
        MethaneComparison m = LivestockCalculator.methane(bd("3300"), bd("85"));

        // 3,300 × 0.15 = 495 kg left; 2,805 kg saved
        assertThat(m.newKg()).isEqualByComparingTo("495");
        assertThat(m.savedKg()).isEqualByComparingTo("2805");
        assertThat(m.reductionPct()).isEqualByComparingTo("85");
    }

    @Test
    void co2eIsMethaneSavedTimesGwpOverThousand() {
        // 1,485 × 27 / 1,000 = 40.095 t; 2,805 × 27 / 1,000 = 75.735 t
        assertThat(LivestockCalculator.co2eTonnes(bd("1485"), bd("27"))).isEqualByComparingTo("40.095");
        assertThat(LivestockCalculator.co2eTonnes(bd("2805"), bd("27"))).isEqualByComparingTo("75.735");
    }

    @Test
    void totalReductionsDoNotStackTheBestOneApplies() {
        assertThat(LivestockCalculator.systemReductionPct(List.of(bd("45"), bd("85")))).isEqualByComparingTo("85");
        assertThat(LivestockCalculator.systemReductionPct(List.of(bd("45")))).isEqualByComparingTo("45");
        assertThat(LivestockCalculator.systemReductionPct(List.of())).isEqualByComparingTo("0");
    }

    @Test
    void energyProducedIsHeadsTimesKwhPerHead() {
        // 150 × 1,500 = 225,000 kWh
        assertThat(LivestockCalculator.energyKwh(bd("150"), bd("1500"))).isEqualByComparingTo("225000");
    }

    @Test
    void farmUsesItsOwnEnergyFirstAndSellsTheRest() {
        EnergyUse use = LivestockCalculator.energyUse(bd("225000"), bd("120000"));

        assertThat(use.ownKwh()).isEqualByComparingTo("120000");
        assertThat(use.soldKwh()).isEqualByComparingTo("105000");
    }

    @Test
    void nothingIsSoldWhenTheFarmConsumesMoreThanItProduces() {
        EnergyUse use = LivestockCalculator.energyUse(bd("50000"), bd("120000"));

        assertThat(use.ownKwh()).isEqualByComparingTo("50000");
        assertThat(use.soldKwh()).isEqualByComparingTo("0");
    }

    @Test
    void energyValueSplitsOwnAndSoldPrices() {
        EnergyUse use = new EnergyUse(bd("225000"), bd("120000"), bd("105000"));

        // 120,000 × 0.20 + 105,000 × 0.06 = 24,000 + 6,300
        assertThat(LivestockCalculator.energyValueEur(use, bd("0.20"), bd("0.06"))).isEqualByComparingTo("30300");
    }

    @Test
    void fertiliserValueIsKgNTimesPrice() {
        // 6,000 kg N × 1.00 EUR
        assertThat(LivestockCalculator.fertiliserValueEur(bd("6000"), bd("1.00"))).isEqualByComparingTo("6000");
    }

    @Test
    void manureIsValorisedByEnergyOrByFertiliser() {
        assertThat(LivestockCalculator.isValorised(bd("225000"), false)).isTrue();
        assertThat(LivestockCalculator.isValorised(BigDecimal.ZERO, true)).isTrue();
        assertThat(LivestockCalculator.isValorised(BigDecimal.ZERO, false)).isFalse();
    }

    @Test
    void invalidInputsAreRefused() {
        assertThatThrownBy(() -> LivestockCalculator.methane(bd("3300"), bd("101")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LivestockCalculator.methane(BigDecimal.ZERO, bd("50")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LivestockCalculator.methaneKg(bd("-1"), bd("22")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
