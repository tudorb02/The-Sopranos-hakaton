package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.time.YearMonth;

/** One month of a loan schedule; paymentEur is zero in months without an installment (grace or off-season). */
public record Installment(
        int period,
        YearMonth month,
        BigDecimal paymentEur,
        BigDecimal interestEur,
        BigDecimal principalEur,
        BigDecimal balanceEur) {
}
