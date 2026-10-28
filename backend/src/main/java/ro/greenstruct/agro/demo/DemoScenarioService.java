package ro.greenstruct.agro.demo;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;

/**
 * "Încarcă dosarul demo": turns data/demo/scenarios/&lt;id&gt;.json into the same RunRequest the wizard would
 * submit, keeping the documentIds from the contract fixtures. PDFs not yet in data/demo/docs are skipped
 * and show up as missing documents.
 */
@Service
public class DemoScenarioService {

    private static final Logger log = LoggerFactory.getLogger(DemoScenarioService.class);

    private final Path demoDir;
    private final ObjectMapper mapper;
    private final DocumentStore documents;

    public DemoScenarioService(GreenStructProperties properties, ObjectMapper mapper, DocumentStore documents) {
        this.demoDir = properties.paths().dataDir().resolve("demo");
        this.mapper = mapper;
        this.documents = documents;
    }

    public RunRequest load(String scenarioId) {
        if (!scenarioId.matches("[a-z0-9_-]+")) {
            throw new IllegalArgumentException("Scenariu demo invalid: " + scenarioId);
        }
        Path file = demoDir.resolve("scenarios").resolve(scenarioId + ".json");
        if (!Files.isRegularFile(file)) {
            throw new IllegalArgumentException("Scenariul demo " + scenarioId + " nu există");
        }
        JsonNode scenario = JsonFiles.read(mapper, file);

        List<String> parcelIds = new ArrayList<>();
        scenario.path("parcelIds").forEach(id -> parcelIds.add(id.asText()));
        List<StoredDocument> stored = new ArrayList<>();
        for (JsonNode doc : scenario.path("documents")) {
            storeIfPresent(doc, stored);
        }
        return new RunRequest(scenario.path("cui").asText(), scenario.path("moduleId").asText(), parcelIds,
                scenario.path("questionnaire"), stored, scenarioId);
    }

    private void storeIfPresent(JsonNode doc, List<StoredDocument> stored) {
        Path pdf = demoDir.resolve(doc.path("file").asText());
        if (!Files.isRegularFile(pdf)) {
            log.warn("Demo document {} not found; it will be reported as missing", pdf.getFileName());
            return;
        }
        try {
            stored.add(documents.save(doc.path("documentId").asText(), doc.path("docType").asText(),
                    pdf.getFileName().toString(), "application/pdf", Files.readAllBytes(pdf)));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read demo document " + pdf, e);
        }
    }
}
