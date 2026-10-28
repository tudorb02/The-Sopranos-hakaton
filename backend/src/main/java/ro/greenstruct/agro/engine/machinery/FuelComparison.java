package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;

public record FuelComparison(BigDecimal baselineLitres, BigDecimal proposedLitres, BigDecimal savedLitres,
                             BigDecimal savingPct) {
}
