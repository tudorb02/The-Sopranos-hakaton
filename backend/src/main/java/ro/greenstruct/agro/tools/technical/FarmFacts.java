package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;

/** Facts about the parcels the farmer selected (from the APIA GeoJSON and its risk layers). */
public final class FarmFacts {

    private FarmFacts() {
    }

    /** Properties of the selected parcels; all parcels when the farmer selected none. */
    public static List<JsonNode> selectedParcels(ToolContext context) {
        List<String> selected = context.run().request().parcelIds();
        List<JsonNode> parcels = new ArrayList<>();
        for (JsonNode feature : context.farm().parcels().path("features")) {
            JsonNode properties = feature.path("properties");
            if (selected.isEmpty() || selected.contains(properties.path("parcelId").asText())) {
                parcels.add(properties);
            }
        }
        if (parcels.isEmpty()) {
            throw new IllegalArgumentException("None of the selected parcels exists at APIA: " + selected);
        }
        return parcels;
    }

    public static BigDecimal selectedAreaHa(ToolContext context) {
        return selectedParcels(context).stream()
                .map(p -> p.path("areaHa").decimalValue())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static List<String> parcelsWhere(ToolContext context, String flag) {
        return selectedParcels(context).stream()
                .filter(p -> p.path(flag).asBoolean(false))
                .map(p -> p.path("parcelId").asText())
                .toList();
    }

    /** Highest risk class among the selected parcels (LOW &lt; MEDIUM &lt; HIGH). */
    public static String maxRisk(ToolContext context, String field) {
        List<String> order = List.of("LOW", "MEDIUM", "HIGH");
        return selectedParcels(context).stream()
                .map(p -> p.path(field).asText("LOW"))
                .max((a, b) -> Integer.compare(order.indexOf(a), order.indexOf(b)))
                .orElse("LOW");
    }
}
