package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;

/** Crop revenue, production costs and organic payments of one calendar year; margin = revenue − expenses + subsidies. */
public record YearResult(int year, BigDecimal revenueEur, BigDecimal expensesEur, BigDecimal subsidiesEur) {

    public BigDecimal marginEur() {
        return revenueEur.subtract(expensesEur).add(subsidiesEur);
    }
}
