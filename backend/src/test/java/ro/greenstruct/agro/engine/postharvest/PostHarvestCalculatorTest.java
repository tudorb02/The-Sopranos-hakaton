package ro.greenstruct.agro.engine.postharvest;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Expected values worked out by hand for a 650 t apple cold store using 85,000 kWh per season. */
class PostHarvestCalculatorTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    void specificConsumptionIsKwhPerTonne() {
        // 85,000 / 650 = 130.769…
        assertThat(PostHarvestCalculator.specificConsumption(bd("85000"), bd("650")).setScale(2, RoundingMode.HALF_UP))
                .isEqualByComparingTo("130.77");
    }

    @Test
    void offeredUnitAloneSavesTwelvePercent() {
        EnergyComparison c = PostHarvestCalculator.compare(bd("85000"), BigDecimal.ZERO, bd("115"), BigDecimal.ZERO,
                bd("650"));

        // 115 × 650 = 74,750 kWh; 1 − 74,750 / 85,000 = 12.0588…%; saved 10,250 kWh
        assertThat(c.savingPct().setScale(4, RoundingMode.HALF_UP)).isEqualByComparingTo("12.0588");
        assertThat(c.savedElectricityKwh()).isEqualByComparingTo("10250");
        assertThat(c.savedGasKwh()).isEqualByComparingTo("0");
    }

    @Test
    void propaneUnitWithPanelsSavesTwentyNinePercent() {
        EnergyComparison c = PostHarvestCalculator.compare(bd("85000"), BigDecimal.ZERO, bd("92"), BigDecimal.ZERO,
                bd("650"));

        // 92 × 650 = 59,800 kWh; saved 25,200 kWh; 25,200 / 85,000 = 29.647…%
        assertThat(c.savingPct().setScale(3, RoundingMode.HALF_UP)).isEqualByComparingTo("29.647");
        assertThat(c.savedElectricityKwh()).isEqualByComparingTo("25200");
    }

    @Test
    void electricityAndGasAddUpForTheIndicatorButStaySeparateForSavings() {
        // old: 85,000 kWh electricity + 40,000 kWh gas on 650 t; new: 92 kWh/t electricity, gas 3/4 of before
        // (40,000 / 650 × 0.75 = 46.1538… kWh/t)
        BigDecimal newGas = bd("40000").divide(bd("650"), java.math.MathContext.DECIMAL128).multiply(bd("0.75"));
        EnergyComparison c = PostHarvestCalculator.compare(bd("85000"), bd("40000"), bd("92"), newGas, bd("650"));

        // 1 − (59,800 + 30,000) / 125,000 = 28.16%
        assertThat(c.savingPct().setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("28.16");
        assertThat(c.savedElectricityKwh()).isEqualByComparingTo("25200");
        assertThat(c.savedGasKwh().setScale(6, RoundingMode.HALF_UP)).isEqualByComparingTo("10000");
    }

    @Test
    void co2UsesTheGridAndGasFactorsSeparately() {
        // 25.2 MWh × 0.26 + 10 MWh × 0.20 = 6.552 + 2.0
        assertThat(PostHarvestCalculator.co2Tonnes(bd("25200"), bd("0.26"), bd("10000"), bd("0.20")))
                .isEqualByComparingTo("8.552");
        // electricity only
        assertThat(PostHarvestCalculator.co2Tonnes(bd("25200"), bd("0.26"), BigDecimal.ZERO, bd("0.20")))
                .isEqualByComparingTo("6.552");
    }

    @Test
    void anIncreaseInConsumptionAvoidsNoCo2() {
        assertThat(PostHarvestCalculator.co2Tonnes(bd("-1000"), bd("0.26"), BigDecimal.ZERO, bd("0.20")))
                .isEqualByComparingTo("0");
    }

    @Test
    void savingInEuroIsSavedKwhTimesPrice() {
        // 25,200 × 0.20
        assertThat(PostHarvestCalculator.savingEur(bd("25200"), bd("0.20"))).isEqualByComparingTo("5040");
    }

    @Test
    void refrigerantMustStayWithinTheGwpLimit() {
        assertThat(PostHarvestCalculator.refrigerantOk(bd("3"), bd("675"))).isTrue();
        assertThat(PostHarvestCalculator.refrigerantOk(bd("675"), bd("675"))).isTrue();
        assertThat(PostHarvestCalculator.refrigerantOk(bd("3922"), bd("675"))).isFalse();
    }

    @Test
    void noBaselineConsumptionIsRefused() {
        assertThatThrownBy(() -> PostHarvestCalculator.compare(BigDecimal.ZERO, BigDecimal.ZERO, bd("92"),
                BigDecimal.ZERO, bd("650"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PostHarvestCalculator.specificConsumption(bd("85000"), BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
