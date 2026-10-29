package ro.greenstruct.agro.bedrock;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

/**
 * The submit_* schemas of contracts/schemas: loaded from disk, validated with a real JSON Schema validator
 * and flattened (refs inlined) for the Bedrock tool specification.
 */
public class SchemaSupport {

    /** One schema violation, in the shape of event.json errors[]. */
    public record Issue(String path, String messageRo) {
    }

    private static final int MAX_REF_DEPTH = 20;

    private final Path schemasDir;
    private final ObjectMapper mapper;
    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final Map<String, JsonNode> raw = new ConcurrentHashMap<>();
    private final Map<String, Schema> compiled = new ConcurrentHashMap<>();

    public SchemaSupport(Path schemasDir, ObjectMapper mapper) {
        this.schemasDir = schemasDir;
        this.mapper = mapper;
    }

    /** The schema file as written in contracts/schemas/&lt;name&gt;.json. */
    public JsonNode raw(String name) {
        return raw.computeIfAbsent(name, key -> {
            Path file = schemasDir.resolve(key + ".json");
            try {
                return mapper.readTree(Files.readString(file));
            } catch (IOException e) {
                throw new IllegalStateException("Cannot read schema " + file, e);
            }
        });
    }

    /** Schema for the toolSpec: local $refs inlined, $defs/$schema/$id removed. */
    public JsonNode forBedrock(String name) {
        return flatten(raw(name));
    }

    public List<Issue> validate(String name, JsonNode input) {
        Schema schema = compiled.computeIfAbsent(name, key -> registry.getSchema(raw(key)));
        return schema.validate(input).stream().map(SchemaSupport::issue).toList();
    }

    // ---- flattening

    /** Inlines every "#/$defs/x" (or any local pointer) reference and strips $schema/$id/$defs. */
    public static JsonNode flatten(JsonNode schema) {
        JsonNode resolved = resolve(schema, schema, 0);
        if (resolved instanceof ObjectNode object) {
            object.remove(List.of("$schema", "$id", "$defs"));
        }
        return resolved;
    }

    private static JsonNode resolve(JsonNode node, JsonNode root, int depth) {
        if (depth > MAX_REF_DEPTH) {
            throw new IllegalStateException("Schema references are too deep or circular");
        }
        if (node.isArray()) {
            ArrayNode copy = ((ArrayNode) node).arrayNode();
            node.forEach(item -> copy.add(resolve(item, root, depth)));
            return copy;
        }
        if (!node.isObject()) {
            return node;
        }
        ObjectNode copy = ((ObjectNode) node).objectNode();
        JsonNode ref = node.get("$ref");
        if (ref != null && ref.isTextual()) {
            String pointer = ref.asText();
            if (!pointer.startsWith("#")) {
                throw new IllegalStateException("Only local $ref is supported: " + pointer);
            }
            JsonNode target = pointer.equals("#") ? root : root.at(pointer.substring(1));
            if (target.isMissingNode()) {
                throw new IllegalStateException("Unresolved $ref " + pointer);
            }
            JsonNode inlined = resolve(target, root, depth + 1);
            if (inlined instanceof ObjectNode inlinedObject) {
                copy.setAll(inlinedObject);
            }
        }
        node.fields().forEachRemaining(entry -> {
            String key = entry.getKey();
            if (key.equals("$ref") || (depth == 0 && key.equals("$defs") && root == node)) {
                return;
            }
            copy.set(key, resolve(entry.getValue(), root, depth));
        });
        return copy;
    }

    // ---- messages

    private static Issue issue(Error error) {
        String path = error.getInstanceLocation().toString();
        String keyword = error.getKeyword() == null ? "" : error.getKeyword();
        String message = switch (keyword) {
            case "required" -> "Missing required field: " + error.getProperty() + ".";
            case "additionalProperties" -> "Field not allowed: " + error.getProperty() + ".";
            case "enum" -> "Value outside the allowed list (" + error.getMessage() + ").";
            default -> error.getMessage();
        };
        return new Issue(path.isEmpty() ? "/" : path, message);
    }
}
