package ro.greenstruct.agro.tools;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/** Reading config values ({ "value": ..., "sourceRo": ... }) and tool inputs without silent defaults. */
public final class Params {

    private Params() {
    }

    public static BigDecimal value(JsonNode node, String path) {
        JsonNode value = node.has("value") ? node.path("value") : node;
        if (!value.isNumber()) {
            throw new IllegalStateException("Missing numeric config value " + path);
        }
        return value.decimalValue();
    }

    public static String requiredText(JsonNode input, String field) {
        String value = input.path(field).asText("");
        if (value.isBlank()) {
            throw new IllegalArgumentException("Field \"" + field + "\" missing from input");
        }
        return value;
    }

    public static List<String> textList(JsonNode input, String field) {
        List<String> values = new ArrayList<>();
        input.path(field).forEach(item -> values.add(item.asText()));
        return values;
    }

    /** Finds an element of a JSON array by an id field, e.g. the line with lineId = rbro.invest.standard. */
    public static JsonNode findById(JsonNode array, String idField, String id) {
        for (JsonNode item : array) {
            if (id.equals(item.path(idField).asText())) {
                return item;
            }
        }
        throw new IllegalArgumentException("No " + idField + " = " + id);
    }
}
