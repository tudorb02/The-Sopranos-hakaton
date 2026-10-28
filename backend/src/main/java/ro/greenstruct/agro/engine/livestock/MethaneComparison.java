package ro.greenstruct.agro.engine.livestock;

import java.math.BigDecimal;

/** Methane from manure management before and after the investment (kg CH4 per year) and the reduction in %. */
public record MethaneComparison(BigDecimal oldKg, BigDecimal newKg, BigDecimal savedKg, BigDecimal reductionPct) {
}
