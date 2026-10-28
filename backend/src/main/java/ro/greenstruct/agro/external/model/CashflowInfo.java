package ro.greenstruct.agro.external.model;

import java.math.BigDecimal;
import java.time.Month;
import java.time.YearMonth;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Last 12 months of account flows from Open Banking (Cashflow in contracts/openapi.yaml). */
public record CashflowInfo(
        List<MonthFlow> months,
        BigDecimal annualNetEur,
        BigDecimal avgMonthlyNetEur,
        List<String> peakMonths,
        String source,
        String mode) {

    public record MonthFlow(YearMonth month, BigDecimal inflowEur, BigDecimal outflowEur, BigDecimal netEur) {
    }

    /** Net cash flow per calendar month, the shape the affordability check works on. */
    public Map<Month, BigDecimal> netByCalendarMonth() {
        Map<Month, BigDecimal> byMonth = new EnumMap<>(Month.class);
        for (MonthFlow flow : months) {
            byMonth.merge(flow.month().getMonth(), flow.netEur(), BigDecimal::add);
        }
        return byMonth;
    }
}
