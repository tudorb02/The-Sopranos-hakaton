package ro.greenstruct.agro.agents.rules;

import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

/**
 * Offline document reading: the extraction recorded for a demo document in data/demo/extractions/&lt;documentId&gt;.json
 * (the raw text fields a model returned, same shape as submit_offer_extraction). The numbers are still parsed and
 * calculated live. A document with no recording cannot be read without Bedrock.
 */
@Component
@ConditionalOnProperty(name = "greenstruct.agents.rule-based", havingValue = "true")
public class RecordedDocumentExtractor implements DocumentExtractor {

    private final Path dir;
    private final ObjectMapper mapper;

    public RecordedDocumentExtractor(GreenStructProperties properties, ObjectMapper mapper) {
        this.dir = properties.paths().dataDir().resolve("demo").resolve("extractions");
        this.mapper = mapper;
    }

    @Override
    public JsonNode extract(StoredDocument document, byte[] content, ModuleDefinition module) {
        Path file = dir.resolve(document.documentId() + ".json");
        if (!Files.isRegularFile(file)) {
            throw new IllegalStateException("Nu există o citire înregistrată pentru " + document.fileName()
                    + "; citirea documentelor noi cere Bedrock");
        }
        return JsonFiles.read(mapper, file);
    }
}
