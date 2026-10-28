package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;

public record PowerCheck(BigDecimal hpPerHa, BigDecimal maxHpPerHa, boolean withinLimit) {
}
