package ro.greenstruct.agro.external.model;

import java.math.BigDecimal;
import java.time.LocalDate;

import ro.greenstruct.agro.engine.sme.SmeStatus;

/**
 * What ANAF / ONRC return for a CUI (Company in contracts/openapi.yaml). turnoverEur, netProfitEur and
 * totalAssetsEur are null when no balance sheet gives them; manager is null for ANAF companies (it lives at ONRC).
 */
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
        BigDecimal totalAssetsEur,
        int financialYear,
        boolean vatPayer,
        SmeStatus smeStatus,
        Manager manager) {

    public record Manager(int age, LocalDate installedAt) {
    }

    public CompanyInfo withSmeStatus(SmeStatus status) {
        return new CompanyInfo(cui, name, legalForm, caen, caenLabelRo, county, locality, registeredAt, employees,
                turnoverEur, netProfitEur, totalAssetsEur, financialYear, vatPayer, status, manager);
    }
}
