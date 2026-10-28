package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Values worked out by hand from README §6.1 (efficiencies 0.60 / 0.75 / 0.90, sensors 10%, k = 0.002725) and the
 * irrigation test farm of data/demo/test-documents (DEMO-0001): tomatoes 16 ha (Kc 0.85), peppers 14 ha (0.80),
 * cabbage 10 ha (0.75), ET₀ 700 mm, effective rain 200 mm, well with a 35 m lift, pump efficiency 65%.
 */
class IrrigationCalculatorTest {

    private static final BigDecimal K = new BigDecimal("0.002725");
    private static final BigDecimal PUMP = new BigDecimal("65");
    private static final BigDecimal LIFT = new BigDecimal("35");

    private static final IrrigationSystem FURROWS = system("brazde", "60", "0", "0");
    private static final IrrigationSystem SPRINKLER = system("aspersie", "75", "0", "35");
    private static final IrrigationSystem DRIP = system("picurare", "90", "0", "15");
    private static final IrrigationSystem DRIP_WITH_SENSORS = system("picurare+senzori", "90", "10", "15");

    private static IrrigationSystem system(String id, String efficiency, String sensors, String pressure) {
        return new IrrigationSystem(id, new BigDecimal(efficiency), new BigDecimal(sensors), new BigDecimal(pressure));
    }

    private static CropDemand crop(String name, String ha, String kc) {
        return new CropDemand(name, new BigDecimal(ha), new BigDecimal(kc), new BigDecimal("700"), new BigDecimal("200"));
    }

    private static final List<CropDemand> DEMO_0001 = List.of(crop("tomate", "16", "0.85"), crop("ardei", "14", "0.80"),
            crop("varză", "10", "0.75"));

    private static BigDecimal round(BigDecimal value, int scale) {
        return value.setScale(scale, RoundingMode.HALF_EVEN);
    }

    @Test
    void netNeedSumsKcTimesEt0MinusRainPerCrop() {
        // (0.85 × 700 − 200) × 10 × 16 + (0.80 × 700 − 200) × 10 × 14 + (0.75 × 700 − 200) × 10 × 10
        // = 63,200 + 50,400 + 32,500 = 146,100 m³
        assertThat(IrrigationCalculator.netNeedM3(DEMO_0001)).isEqualByComparingTo("146100");
    }

    @Test
    void rainAboveTheNeedCountsAsZeroNotAsNegative() {
        CropDemand wetYear = new CropDemand("varză", new BigDecimal("10"), new BigDecimal("0.75"), new BigDecimal("700"),
                new BigDecimal("600"));

        assertThat(IrrigationCalculator.netNeedM3(List.of(wetYear))).isEqualByComparingTo("0");
    }

    @Test
    void theReadmeTableFromFurrows() {
        BigDecimal need = IrrigationCalculator.netNeedM3(DEMO_0001);

        // 146,100 / 0.60 = 243,500 m³ today; sprinkler 146,100 / 0.75 = 194,800 m³: 1 − 0.60 / 0.75 = 20%
        WaterComparison sprinkler = IrrigationCalculator.compare(need, FURROWS, SPRINKLER);
        assertThat(sprinkler.baselineM3()).isEqualByComparingTo("243500");
        assertThat(sprinkler.proposedM3()).isEqualByComparingTo("194800");
        assertThat(round(sprinkler.savingPct(), 2)).isEqualByComparingTo("20.00");
        // drip: 1 − 0.60 / 0.90 = 33.33%
        assertThat(round(IrrigationCalculator.compare(need, FURROWS, DRIP).savingPct(), 2)).isEqualByComparingTo("33.33");
        // drip + sensors: 146,100 × 0.9 / 0.9 = 146,100 m³; 1 − 0.9 × 0.60 / 0.90 = 40%
        WaterComparison green = IrrigationCalculator.compare(need, FURROWS, DRIP_WITH_SENSORS);
        assertThat(green.proposedM3()).isEqualByComparingTo("146100");
        assertThat(round(green.savingPct(), 2)).isEqualByComparingTo("40.00");
        assertThat(green.savedM3()).isEqualByComparingTo("97400");
    }

    @Test
    void pumpingEnergyLiftsTheWaterAndAddsTheSystemPressure() {
        // 243,500 m³ × (35 + 0) m × 0.002725 / 0.65 = 35,728.94 kWh
        assertThat(round(IrrigationCalculator.pumpingKwh(new BigDecimal("243500"), LIFT, BigDecimal.ZERO, K, PUMP), 2))
                .isEqualByComparingTo("35728.94");
        // sprinkler: 194,800 × (35 + 35) × 0.002725 / 0.65 = 57,166.31 kWh, more energy than furrows
        assertThat(round(IrrigationCalculator.pumpingKwh(new BigDecimal("194800"), LIFT, new BigDecimal("35"), K, PUMP), 2))
                .isEqualByComparingTo("57166.31");
        // drip + sensors: 146,100 × (35 + 15) × 0.002725 / 0.65 = 30,624.81 kWh
        assertThat(round(IrrigationCalculator.pumpingKwh(new BigDecimal("146100"), LIFT, new BigDecimal("15"), K, PUMP), 2))
                .isEqualByComparingTo("30624.81");
    }

    @Test
    void solarCoverageIsCappedByDemand() {
        assertThat(IrrigationCalculator.solarCoveredKwh(new BigDecimal("20000"), new BigDecimal("30"),
                new BigDecimal("1300"))).isEqualByComparingTo("20000");
        assertThat(IrrigationCalculator.solarCoveredKwh(new BigDecimal("50000"), new BigDecimal("30"),
                new BigDecimal("1300"))).isEqualByComparingTo("39000");
    }

    @Test
    void rejectsZeroEfficiencies() {
        assertThatThrownBy(() -> system("x", "0", "0", "0")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IrrigationCalculator.pumpingKwh(BigDecimal.ONE, LIFT, BigDecimal.ZERO, K, BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
