package ro.greenstruct.agro.tools;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Tool input schemas are written as JSON text next to each tool and parsed once. */
public final class Schemas {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Schemas() {
    }

    public static JsonNode parse(String json) {
        try {
            return MAPPER.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid tool schema", e);
        }
    }

    public static final JsonNode EMPTY_OBJECT = parse("""
            {"type": "object", "additionalProperties": false, "properties": {}}
            """);
}
