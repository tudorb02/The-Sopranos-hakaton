package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;
import java.util.List;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * Water and pumping energy of README §6, category 1:
 * <pre>
 * NIR = Σ max(0, Kc × ET₀ − P_ef) × 10 × ha      (1 mm on 1 ha = 10 m³)
 * V   = NIR × (1 − s) / η                         (s = reduction from soil moisture sensors)
 * kWh = V × (H_lift + H_pressure) × k / η_pump    (k = ρ × g / 3,600,000 = 0.002725 kWh per m³ and metre)
 * </pre>
 * The water saving 1 − V_new / V_old is the green indicator; it does not depend on NIR when both systems water
 * the same crops.
 */
public final class IrrigationCalculator {

    private static final BigDecimal M3_PER_MM_HA = BigDecimal.TEN;

    private IrrigationCalculator() {
    }

    public static BigDecimal netNeedM3(List<CropDemand> crops) {
        BigDecimal total = BigDecimal.ZERO;
        for (CropDemand crop : crops) {
            BigDecimal needMm = crop.kc().multiply(crop.et0Mm(), MC).subtract(crop.effectiveRainMm(), MC)
                    .max(BigDecimal.ZERO);
            total = total.add(needMm.multiply(M3_PER_MM_HA, MC).multiply(crop.hectares(), MC), MC);
        }
        return total;
    }

    /** Water extracted from the source to give the crops their net need. */
    public static BigDecimal withdrawalM3(BigDecimal netNeedM3, IrrigationSystem system) {
        return requireNonNegative(netNeedM3, "netNeedM3")
                .multiply(BigDecimal.ONE.subtract(fraction(system.demandReductionPct())), MC)
                .divide(fraction(system.efficiencyPct()), MC);
    }

    /** Saving % = 1 − proposed / baseline, for the same net need. */
    public static WaterComparison compare(BigDecimal netNeedM3, IrrigationSystem baseline, IrrigationSystem proposed) {
        BigDecimal before = withdrawalM3(netNeedM3, baseline);
        BigDecimal after = withdrawalM3(netNeedM3, proposed);
        BigDecimal saving = before.signum() == 0
                ? BigDecimal.ZERO
                : toPct(BigDecimal.ONE.subtract(after.divide(before, MC)));
        return new WaterComparison(before, after, before.subtract(after), saving);
    }

    /** Energy to lift the water from the source and give it the system's working pressure. */
    public static BigDecimal pumpingKwh(BigDecimal waterM3, BigDecimal liftM, BigDecimal pressureHeadM,
                                        BigDecimal kwhPerM3PerM, BigDecimal pumpEfficiencyPct) {
        requirePct(pumpEfficiencyPct, "pumpEfficiencyPct");
        if (pumpEfficiencyPct.signum() == 0) {
            throw new IllegalArgumentException("pumpEfficiencyPct must be > 0");
        }
        BigDecimal head = requireNonNegative(liftM, "liftM").add(requireNonNegative(pressureHeadM, "pressureHeadM"), MC);
        return requireNonNegative(waterM3, "waterM3").multiply(head, MC)
                .multiply(requireNonNegative(kwhPerM3PerM, "kwhPerM3PerM"), MC)
                .divide(fraction(pumpEfficiencyPct), MC);
    }

    /** Pumping energy covered by a solar pump: min(demand, kWp × specific yield). */
    public static BigDecimal solarCoveredKwh(BigDecimal demandKwh, BigDecimal pvKwp, BigDecimal yieldKwhPerKwp) {
        requireNonNegative(pvKwp, "pvKwp");
        requireNonNegative(yieldKwhPerKwp, "yieldKwhPerKwp");
        return requireNonNegative(demandKwh, "demandKwh").min(pvKwp.multiply(yieldKwhPerKwp, MC));
    }
}
