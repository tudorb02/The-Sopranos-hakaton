package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

public record WaterComparison(BigDecimal baselineM3, BigDecimal proposedM3, BigDecimal savedM3, BigDecimal savingPct) {
}
