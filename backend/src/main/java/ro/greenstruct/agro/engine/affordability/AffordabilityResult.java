package ro.greenstruct.agro.engine.affordability;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/** dscr = yearly free cash flow / yearly debt service; deficitMonths are months where the installment exceeds that month's cash flow. */
public record AffordabilityResult(BigDecimal dscr, BigDecimal minDscr, boolean meetsMinimum,
                                  List<YearMonth> deficitMonths) {

    public AffordabilityResult {
        deficitMonths = List.copyOf(deficitMonths);
    }
}
