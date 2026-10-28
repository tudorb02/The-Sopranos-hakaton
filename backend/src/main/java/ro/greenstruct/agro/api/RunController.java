package ro.greenstruct.agro.api;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.orchestration.PendingDocument;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunNotFoundException;
import ro.greenstruct.agro.orchestration.RunOrchestrator;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.orchestration.events.SseHub;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;

/** The dossier endpoints of contracts/openapi.yaml (tags runs and officer). */
@RestController
@RequestMapping("/api/runs")
public class RunController {

    private static final int MAX_DOCUMENTS = 10;

    private final RunOrchestrator orchestrator;
    private final RunStore runs;
    private final RunViewMapper views;
    private final SseHub hub;
    private final DocumentStore documents;
    private final DemoScenarioService demoScenarios;
    private final ObjectMapper mapper;

    public RunController(RunOrchestrator orchestrator, RunStore runs, RunViewMapper views, SseHub hub,
                         DocumentStore documents, DemoScenarioService demoScenarios, ObjectMapper mapper) {
        this.orchestrator = orchestrator;
        this.runs = runs;
        this.views = views;
        this.hub = hub;
        this.documents = documents;
        this.demoScenarios = demoScenarios;
        this.mapper = mapper;
    }

    public record RunCreated(String runId, String state, String runUrl, String eventsUrl) {
    }

    public record ApproveRequest(String officerId, String commentRo, List<String> acceptedConditionIds) {
    }

    public record RequestDocumentsRequest(String officerId, String messageRo, List<RequestedDocument> documents) {
    }

    public record RequestedDocument(String docType, String labelRo, String conditionId, LocalDate dueDate) {
    }

    private record ManifestEntry(String fileName, String docType) {
    }

    /**
     * CreateRunForm: cui, moduleId, parcelIds (JSON array), questionnaire (JSON object), documentManifest
     * (JSON array of {fileName, docType}, same order as the files) and the files as repeated "documents" parts.
     * JSON fields may arrive as plain form fields or as parts with content type application/json.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RunCreated> create(MultipartHttpServletRequest request) {
        String cui = requiredText(request, "cui");
        String moduleId = requiredText(request, "moduleId");
        List<String> parcelIds = mapper.convertValue(requiredJson(request, "parcelIds", true), mapper.getTypeFactory()
                .constructCollectionType(List.class, String.class));
        if (parcelIds.isEmpty()) {
            throw new IllegalArgumentException("Alege cel puțin o parcelă");
        }
        JsonNode questionnaire = requiredJson(request, "questionnaire", false);
        if (!questionnaire.isObject()) {
            throw new IllegalArgumentException("questionnaire trebuie să fie un obiect JSON");
        }
        List<ManifestEntry> manifest = mapper.convertValue(requiredJson(request, "documentManifest", true),
                mapper.getTypeFactory().constructCollectionType(List.class, ManifestEntry.class));
        List<MultipartFile> files = request.getFiles("documents");
        if (files.isEmpty() || files.size() > MAX_DOCUMENTS) {
            throw new IllegalArgumentException("Încarcă între 1 și " + MAX_DOCUMENTS + " documente");
        }
        if (manifest.size() != files.size()) {
            throw new IllegalArgumentException("documentManifest are " + manifest.size() + " intrări, dar s-au încărcat "
                    + files.size() + " fișiere");
        }

        List<StoredDocument> stored = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            ManifestEntry entry = manifest.get(i);
            if (entry.docType() == null || entry.docType().isBlank()) {
                throw new IllegalArgumentException("documentManifest[" + i + "].docType lipsește");
            }
            stored.add(store(entry.docType(), entry.fileName(), files.get(i)));
        }
        Run run = orchestrator.start(new RunRequest(cui, moduleId, parcelIds, questionnaire, stored, null)).run();
        return created(run);
    }

    @PostMapping("/demo/{scenario}")
    public ResponseEntity<RunCreated> startDemo(@PathVariable String scenario) {
        if (!List.of("irigatii", "utilaje").contains(scenario)) {
            throw new NotFoundException("Scenariul demo " + scenario + " nu există");
        }
        return created(orchestrator.start(demoScenarios.load(scenario)).run());
    }

    @GetMapping("/{id}")
    public RunView get(@PathVariable String id) {
        return views.toView(runs.find(id).orElseThrow(() -> new RunNotFoundException(id)));
    }

    /** History first (after Last-Event-ID or ?after=), then live events; closes after run.completed/failed. */
    @GetMapping(path = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable String id,
                             @RequestHeader(value = "Last-Event-ID", required = false) Long lastEventId,
                             @RequestParam(value = "after", required = false) Long after) {
        runs.find(id).orElseThrow(() -> new RunNotFoundException(id));
        long from = lastEventId != null ? lastEventId : after != null ? after : 0;
        return hub.subscribe(id, from);
    }

    @PostMapping("/{id}/approve")
    public RunView approve(@PathVariable String id, @RequestBody ApproveRequest body) {
        String officerId = requiredOfficer(body.officerId());
        return views.toView(orchestrator.approve(id, officerId, body.commentRo()));
    }

    @PostMapping("/{id}/request-documents")
    public RunView requestDocuments(@PathVariable String id, @RequestBody RequestDocumentsRequest body) {
        String officerId = requiredOfficer(body.officerId());
        if (body.documents() == null || body.documents().isEmpty() || body.documents().size() > MAX_DOCUMENTS) {
            throw new IllegalArgumentException("Cere între 1 și " + MAX_DOCUMENTS + " documente");
        }
        Instant now = Instant.now();
        List<PendingDocument> pending = body.documents().stream()
                .map(d -> new PendingDocument(requireText(d.docType(), "docType"), requireText(d.labelRo(), "labelRo"),
                        d.conditionId(), d.dueDate(), now))
                .toList();
        return views.toView(orchestrator.requestDocuments(id, officerId, body.messageRo(), pending));
    }

    private ResponseEntity<RunCreated> created(Run run) {
        String runUrl = "/api/runs/" + run.id();
        return ResponseEntity.accepted().location(URI.create(runUrl))
                .body(new RunCreated(run.id(), run.status().name(), runUrl, runUrl + "/events"));
    }

    private StoredDocument store(String docType, String manifestName, MultipartFile file) {
        String fileName = manifestName != null && !manifestName.isBlank() ? manifestName : file.getOriginalFilename();
        try {
            return documents.save(null, docType, fileName, file.getContentType(), file.getBytes());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read uploaded file " + fileName, e);
        }
    }

    private static String requiredOfficer(String officerId) {
        return requireText(officerId, "officerId");
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Câmpul " + field + " lipsește");
        }
        return value;
    }

    private static String requiredText(MultipartHttpServletRequest request, String field) {
        return requireText(fieldValue(request, field), field);
    }

    private JsonNode requiredJson(MultipartHttpServletRequest request, String field, boolean array) {
        String raw = requiredText(request, field);
        try {
            JsonNode node = mapper.readTree(raw);
            if (array && !node.isArray()) {
                throw new IllegalArgumentException(field + " trebuie să fie un array JSON");
            }
            return node;
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(field + " nu e JSON valid");
        }
    }

    /** A form field, or a part sent with its own content type (e.g. application/json). */
    private static String fieldValue(MultipartHttpServletRequest request, String field) {
        String value = request.getParameter(field);
        if (value != null) {
            return value;
        }
        MultipartFile part = request.getFile(field);
        if (part == null) {
            return null;
        }
        try {
            return new String(part.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
