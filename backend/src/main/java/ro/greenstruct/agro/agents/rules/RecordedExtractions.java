package ro.greenstruct.agro.agents.rules;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;

/**
 * Document readings recorded for the demo documents: data/demo/extractions/&lt;documentId&gt;.json, the raw text fields
 * a model returned (same shape as submit_offer_extraction). The numbers are still parsed and calculated live.
 */
@Component
public class RecordedExtractions {

    private final Path dir;
    private final ObjectMapper mapper;

    public RecordedExtractions(GreenStructProperties properties, ObjectMapper mapper) {
        this.dir = properties.paths().dataDir().resolve("demo").resolve("extractions");
        this.mapper = mapper;
    }

    public Optional<JsonNode> find(String documentId) {
        if (!documentId.matches("[a-z0-9_]+")) {
            return Optional.empty();
        }
        Path file = dir.resolve(documentId + ".json");
        return Files.isRegularFile(file) ? Optional.of(JsonFiles.read(mapper, file)) : Optional.empty();
    }
}
