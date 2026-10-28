package ro.greenstruct.agro.external.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/** What ANAF / ONRC return for a CUI (Company in contracts/openapi.yaml). */
public record CompanyInfo(
        String cui,
        String name,
        String legalForm,
        String caen,
        String caenLabelRo,
        String county,
        String locality,
        LocalDate registeredAt,
        int employees,
        BigDecimal turnoverEur,
        BigDecimal netProfitEur,
        int financialYear,
        boolean vatPayer,
        Manager manager) {

    public record Manager(int age, LocalDate installedAt) {
    }
}
