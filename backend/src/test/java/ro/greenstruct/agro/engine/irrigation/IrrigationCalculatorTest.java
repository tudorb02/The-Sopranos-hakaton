package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IrrigationCalculatorTest {

    private static final List<CropArea> VEGETABLES_40_HA =
            List.of(new CropArea("legume", new BigDecimal("40"), new BigDecimal("3500")));
    private static final IrrigationSystem OLD_GUN = new IrrigationSystem("tun-vechi", new BigDecimal("65"), BigDecimal.ZERO);
    private static final IrrigationSystem SPRINKLER = new IrrigationSystem("aspersie", new BigDecimal("76.5"), BigDecimal.ZERO);
    private static final IrrigationSystem DRIP_WITH_SENSORS =
            new IrrigationSystem("picurare+senzori", new BigDecimal("90"), new BigDecimal("15"));

    @Test
    void grossWaterDividesNetNeedByEfficiency() {
        assertThat(IrrigationCalculator.grossWaterM3(VEGETABLES_40_HA, DRIP_WITH_SENSORS).setScale(2, RoundingMode.HALF_EVEN))
                .isEqualByComparingTo("132222.22");
    }

    @Test
    void offeredSprinklerStaysBelowTwentyFivePercent() {
        WaterComparison comparison = IrrigationCalculator.compare(VEGETABLES_40_HA, OLD_GUN, SPRINKLER);

        assertThat(comparison.savingPct().setScale(2, RoundingMode.HALF_EVEN)).isEqualByComparingTo("15.03");
    }

    @Test
    void dripWithSensorsPassesTheThreshold() {
        WaterComparison comparison = IrrigationCalculator.compare(VEGETABLES_40_HA, OLD_GUN, DRIP_WITH_SENSORS);

        assertThat(comparison.savingPct().setScale(2, RoundingMode.HALF_EVEN)).isEqualByComparingTo("38.61");
        assertThat(comparison.savedM3()).isEqualByComparingTo(comparison.baselineM3().subtract(comparison.proposedM3()));
    }

    @Test
    void solarCoverageIsCappedByDemand() {
        assertThat(IrrigationCalculator.solarCoveredKwh(new BigDecimal("20000"), new BigDecimal("30"),
                new BigDecimal("1300"))).isEqualByComparingTo("20000");
        assertThat(IrrigationCalculator.solarCoveredKwh(new BigDecimal("50000"), new BigDecimal("30"),
                new BigDecimal("1300"))).isEqualByComparingTo("39000");
    }

    @Test
    void pumpingEnergyScalesWithWater() {
        assertThat(IrrigationCalculator.pumpingKwh(new BigDecimal("100000"), new BigDecimal("0.4")))
                .isEqualByComparingTo("40000");
    }

    @Test
    void rejectsZeroEfficiency() {
        assertThatThrownBy(() -> new IrrigationSystem("x", BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
