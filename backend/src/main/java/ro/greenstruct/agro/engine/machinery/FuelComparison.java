package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;

/**
 * Diesel per hectare before and after the investment (README §6, category 3, rows 1-3). {@code savedLitres} is per
 * year over the worked area; {@code savingPct} is {@code 1 − after / before} in percentage points (negative when the
 * new machine uses more).
 */
public record FuelComparison(BigDecimal litresPerHaBefore, BigDecimal litresPerHaAfter, BigDecimal savedLitres,
                             BigDecimal savingPct) {
}
