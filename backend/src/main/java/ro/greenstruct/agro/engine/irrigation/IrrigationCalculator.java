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

    /** 1 mm of water on 1 ha is 10 m³. */
    private static final BigDecimal M3_PER_MM_HA = BigDecimal.TEN;

    /** Net irrigation need NIR = Σ max(0, Kc × ET0 − P_eff) × 10 × ha, in m³ per season. */
    public static BigDecimal netNeedM3(List<CropNeed> crops) {
        BigDecimal total = BigDecimal.ZERO;
        for (CropNeed crop : crops) {
            BigDecimal deficitMm = crop.kc().multiply(crop.et0Mm(), MC).subtract(crop.effectiveRainMm()).max(BigDecimal.ZERO);
            total = total.add(deficitMm.multiply(M3_PER_MM_HA, MC).multiply(crop.hectares(), MC), MC);
        }
        return total;
    }

    /** Water taken from the source: NIR × (1 − demand reduction) / efficiency. */
    public static BigDecimal grossWaterM3(BigDecimal netNeedM3, IrrigationSystem system) {
        return requireNonNegative(netNeedM3, "netNeedM3")
                .multiply(BigDecimal.ONE.subtract(fraction(system.demandReductionPct())), MC)
                .divide(fraction(system.efficiencyPct()), MC);
    }

    /**
     * Pumping energy kWh = V × (lift + system pressure head) × k / pump efficiency, with k = 0.002725 kWh per m³ per
     * metre (ρ × g / 3,600,000, from config/factors.json).
     */
    public static BigDecimal pumpingKwhByHead(BigDecimal volumeM3, BigDecimal liftM, BigDecimal pressureHeadM,
                                              BigDecimal kwhPerM3PerM, BigDecimal pumpEfficiencyPct) {
        requireNonNegative(volumeM3, "volumeM3");
        requireNonNegative(liftM, "liftM");
        requireNonNegative(pressureHeadM, "pressureHeadM");
        requireNonNegative(kwhPerM3PerM, "kwhPerM3PerM");
        if (pumpEfficiencyPct == null || pumpEfficiencyPct.signum() <= 0) {
            throw new IllegalArgumentException("pumpEfficiencyPct must be > 0, was " + pumpEfficiencyPct);
        }
        return volumeM3.multiply(liftM.add(pressureHeadM), MC).multiply(kwhPerM3PerM, MC)
                .divide(fraction(pumpEfficiencyPct), MC);
    }
}
