package ro.greenstruct.agro.engine.energy;

import java.math.BigDecimal;

/** What a solar pump saves by replacing a diesel one: the fuel bill and its CO₂, per year. */
public record SolarPumpSaving(BigDecimal litres, BigDecimal savingEur, BigDecimal co2Tonnes) {
}
