package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;

public record DeMinimisCheck(boolean withinCeiling, BigDecimal headroomEur) {
}
