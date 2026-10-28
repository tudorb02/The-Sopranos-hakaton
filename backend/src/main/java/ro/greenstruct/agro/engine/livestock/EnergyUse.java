package ro.greenstruct.agro.engine.livestock;

import java.math.BigDecimal;

/** Biogas electricity split between the farm's own consumption and what is sold to the grid (kWh per year). */
public record EnergyUse(BigDecimal producedKwh, BigDecimal ownKwh, BigDecimal soldKwh) {
}
