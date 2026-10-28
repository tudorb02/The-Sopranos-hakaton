package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;
import java.util.List;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.toPct;

public final class IrrigationCalculator {

    private IrrigationCalculator() {
    }

    /** Pumped water = Σ(ha × net need) × (1 − demand reduction) / efficiency. */
    public static BigDecimal grossWaterM3(List<CropArea> areas, IrrigationSystem system) {
        BigDecimal netNeed = areas.stream()
                .map(a -> a.hectares().multiply(a.netNeedM3PerHa(), MC))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return netNeed
                .multiply(BigDecimal.ONE.subtract(fraction(system.demandReductionPct())), MC)
                .divide(fraction(system.efficiencyPct()), MC);
    }

    /** Saving % = 1 − proposed / baseline, on the same areas. */
    public static WaterComparison compare(List<CropArea> areas, IrrigationSystem baseline, IrrigationSystem proposed) {
        BigDecimal before = grossWaterM3(areas, baseline);
        BigDecimal after = grossWaterM3(areas, proposed);
        BigDecimal saving = before.signum() == 0
                ? BigDecimal.ZERO
                : toPct(BigDecimal.ONE.subtract(after.divide(before, MC)));
        return new WaterComparison(before, after, before.subtract(after), saving);
    }

    public static BigDecimal pumpingKwh(BigDecimal waterM3, BigDecimal kwhPerM3) {
        requireNonNegative(waterM3, "waterM3");
        return waterM3.multiply(requireNonNegative(kwhPerM3, "kwhPerM3"), MC);
    }

    /** Pumping energy covered by a solar pump: min(demand, kWp × specific yield). */
    public static BigDecimal solarCoveredKwh(BigDecimal demandKwh, BigDecimal pvKwp, BigDecimal yieldKwhPerKwp) {
        requireNonNegative(pvKwp, "pvKwp");
        requireNonNegative(yieldKwhPerKwp, "yieldKwhPerKwp");
        return requireNonNegative(demandKwh, "demandKwh").min(pvKwp.multiply(yieldKwhPerKwp, MC));
    }
}
