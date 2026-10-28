package ro.greenstruct.agro.external.model;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/** What APIA / IACS return for a farm (Farm in contracts/openapi.yaml). */
public record FarmInfo(
        BigDecimal totalHa,
        BigDecimal standardOutputEur,
        boolean irrigatedNow,
        String currentIrrigation,
        List<Crop> crops,
        JsonNode livestock,
        BigDecimal apiaSubsidiesEur) {

    public record Crop(int year, String crop, BigDecimal ha, BigDecimal yieldTPerHa) {
    }
}
