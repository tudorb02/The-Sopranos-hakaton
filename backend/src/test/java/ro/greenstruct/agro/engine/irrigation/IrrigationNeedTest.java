package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** README §6 category 1 and §12: 40 ha of vegetables, ET0 700 mm, effective rain 200 mm; the numbers are worked by hand. */
class IrrigationNeedTest {

    private static final BigDecimal ET0 = new BigDecimal("700");
    private static final BigDecimal RAIN = new BigDecimal("200");
    private static final List<CropNeed> FARM = List.of(
            new CropNeed("tomate", new BigDecimal("16"), new BigDecimal("0.85"), ET0, RAIN),
            new CropNeed("ardei", new BigDecimal("14"), new BigDecimal("0.80"), ET0, RAIN),
            new CropNeed("varză", new BigDecimal("10"), new BigDecimal("0.75"), ET0, RAIN));

    private static final BigDecimal K = new BigDecimal("0.002725");
    private static final BigDecimal PUMP_EFFICIENCY = new BigDecimal("65");

    private static IrrigationSystem system(String efficiency, String reduction) {
        return new IrrigationSystem("s", new BigDecimal(efficiency), new BigDecimal(reduction));
    }

    @Test
    void netNeedIsTheSeasonalDeficitTimesTenTimesHectares() {
        // tomate (0.85×700−200)×10×16 = 63,200; ardei (0.80×700−200)×10×14 = 50,400; varză (0.75×700−200)×10×10 = 32,500
        assertThat(IrrigationCalculator.netNeedM3(FARM)).isEqualByComparingTo("146100");
    }

    @Test
    void rainAboveTheDemandGivesNoNeed() {
        CropNeed wet = new CropNeed("x", BigDecimal.TEN, new BigDecimal("0.5"), new BigDecimal("300"), new BigDecimal("200"));

        assertThat(IrrigationCalculator.netNeedM3(List.of(wet))).isEqualByComparingTo("0");
    }

    @Test
    void waterTakenFromTheSourceForEachSystem() {
        BigDecimal nir = new BigDecimal("146100");

        // furrows 0.60 → 243,500; sprinkler 0.75 → 194,800; drip + sensors: 146,100 × 0.9 / 0.9 = 146,100
        assertThat(IrrigationCalculator.grossWaterM3(nir, system("60", "0"))).isEqualByComparingTo("243500");
        assertThat(IrrigationCalculator.grossWaterM3(nir, system("75", "0"))).isEqualByComparingTo("194800");
        assertThat(IrrigationCalculator.grossWaterM3(nir, system("90", "10"))).isEqualByComparingTo("146100");
    }

    @Test
    void readmeSavingsAreTwentyThirtyThreeAndForty() {
        BigDecimal nir = IrrigationCalculator.netNeedM3(FARM);
        BigDecimal furrows = IrrigationCalculator.grossWaterM3(nir, system("60", "0"));

        // 1 − 0.60/0.75 = 20%; 1 − 0.60/0.90 = 33.33%; 1 − (1 − 0.10) × 0.60/0.90 = 40%
        assertThat(saving(furrows, IrrigationCalculator.grossWaterM3(nir, system("75", "0")))).isEqualByComparingTo("20.00");
        assertThat(saving(furrows, IrrigationCalculator.grossWaterM3(nir, system("90", "0")))).isEqualByComparingTo("33.33");
        assertThat(saving(furrows, IrrigationCalculator.grossWaterM3(nir, system("90", "10")))).isEqualByComparingTo("40.00");
    }

    @Test
    void pumpingEnergyFollowsLiftAndSystemPressure() {
        // 243,500 m³ × 35 m × 0.002725 / 0.65 = 35,729 kWh (furrows have no pressure head)
        assertThat(IrrigationCalculator.pumpingKwhByHead(new BigDecimal("243500"), new BigDecimal("35"), BigDecimal.ZERO,
                K, PUMP_EFFICIENCY).setScale(0, RoundingMode.HALF_EVEN)).isEqualByComparingTo("35729");
        // 194,800 × (35 + 35) × 0.002725 / 0.65 = 57,166 kWh: more pressure, more energy
        assertThat(IrrigationCalculator.pumpingKwhByHead(new BigDecimal("194800"), new BigDecimal("35"),
                new BigDecimal("35"), K, PUMP_EFFICIENCY).setScale(0, RoundingMode.HALF_EVEN)).isEqualByComparingTo("57166");
        // 146,100 × (35 + 15) × 0.002725 / 0.65 = 30,625 kWh
        assertThat(IrrigationCalculator.pumpingKwhByHead(new BigDecimal("146100"), new BigDecimal("35"),
                new BigDecimal("15"), K, PUMP_EFFICIENCY).setScale(0, RoundingMode.HALF_EVEN)).isEqualByComparingTo("30625");
    }

    @Test
    void rejectsAPumpWithoutEfficiency() {
        assertThatThrownBy(() -> IrrigationCalculator.pumpingKwhByHead(BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, K,
                BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
    }

    private static BigDecimal saving(BigDecimal before, BigDecimal after) {
        return BigDecimal.ONE.subtract(after.divide(before, java.math.MathContext.DECIMAL128))
                .multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_EVEN);
    }
}
