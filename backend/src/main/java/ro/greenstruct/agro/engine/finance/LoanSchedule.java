package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;
import java.util.List;

public record LoanSchedule(
        BigDecimal principalEur,
        BigDecimal annualRatePct,
        BigDecimal installmentEur,
        List<Installment> installments,
        BigDecimal totalPaidEur,
        BigDecimal totalInterestEur) {

    public LoanSchedule {
        installments = List.copyOf(installments);
    }

    public long paymentCount() {
        return installments.stream().filter(i -> i.paymentEur().signum() > 0).count();
    }
}
