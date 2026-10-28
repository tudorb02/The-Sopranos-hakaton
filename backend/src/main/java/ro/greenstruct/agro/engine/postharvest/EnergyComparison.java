package ro.greenstruct.agro.engine.postharvest;

import java.math.BigDecimal;

/**
 * Energy per unit (tonne or m²) before and after, electricity and gas together, and the yearly saving of each
 * carrier in kWh.
 */
public record EnergyComparison(BigDecimal oldSpecific, BigDecimal newSpecific, BigDecimal savingPct,
                               BigDecimal savedElectricityKwh, BigDecimal savedGasKwh) {
}
