package ro.greenstruct.agro.farm;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.external.model.CompanyInfo;
import ro.greenstruct.agro.external.model.DataSourceInfo;
import ro.greenstruct.agro.external.model.FarmInfo;

/**
 * Step 1 of the wizard (FarmProfile in contracts/openapi.yaml): everything fetched from the CUI.
 * cashflow is null without Open Banking consent.
 */
public record FarmProfile(
        String cui,
        CompanyInfo company,
        FarmInfo farm,
        JsonNode parcels,
        CashflowInfo cashflow,
        List<DataSourceInfo> dataSources) {
}
