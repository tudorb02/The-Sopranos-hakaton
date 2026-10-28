package ro.greenstruct.agro.bedrock;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ro.greenstruct.agro.bedrock.BedrockGateway.Block;
import ro.greenstruct.agro.bedrock.BedrockGateway.Message;
import ro.greenstruct.agro.bedrock.BedrockGateway.Text;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolResult;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolSpec;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolUse;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

/**
 * Reads one document with the extraction model: the PDF goes in as a Converse document block and the model
 * must answer with submit_offer_extraction (forced tool). It copies raw text; the backend parses the numbers.
 */
public class BedrockDocumentExtractor implements DocumentExtractor {

    static final String TOOL = "submit_offer_extraction";
    private static final Set<String> FORMATS = Set.of("pdf", "csv", "doc", "docx", "xls", "xlsx", "html", "txt", "md");
    private static final int MAX_ATTEMPTS = 3;

    private final BedrockGateway gateway;
    private final SchemaSupport schemas;
    private final ObjectMapper mapper;
    private final String modelId;
    private final String systemPrompt;
    private final int maxTokens;
    private final ToolLoop.Sleeper sleeper;
    private final Duration backoff;

    public BedrockDocumentExtractor(BedrockGateway gateway, SchemaSupport schemas, ObjectMapper mapper,
                                    String modelId, String systemPrompt, int maxTokens, Duration backoff,
                                    ToolLoop.Sleeper sleeper) {
        this.gateway = gateway;
        this.schemas = schemas;
        this.mapper = mapper;
        this.modelId = modelId;
        this.systemPrompt = systemPrompt;
        this.maxTokens = maxTokens;
        this.backoff = backoff;
        this.sleeper = sleeper;
    }

    @Override
    public JsonNode extract(StoredDocument document, byte[] content, ModuleDefinition module) throws Exception {
        ToolSpec tool = new ToolSpec(TOOL, "Trimite ce ai citit din document, exact cum apare scris.",
                schemas.forBedrock(TOOL));
        List<Message> messages = new ArrayList<>();
        messages.add(Message.user(
                new Text("documentId: " + document.documentId() + "\ndocumentType: " + document.docType()
                        + "\nmoduleId: " + module.moduleId() + "\nfișier: " + document.fileName()
                        + "\nCitește documentul atașat și răspunde doar cu " + TOOL + "."),
                new BedrockGateway.Attachment(documentName(document.fileName()), format(document.fileName()), content)));

        BedrockCallException lastCall = null;
        List<SchemaSupport.Issue> lastIssues = List.of();
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            BedrockGateway.Response response;
            try {
                response = gateway.converse(new BedrockGateway.Request(modelId, systemPrompt, messages, List.of(tool),
                        TOOL, maxTokens));
            } catch (BedrockCallException e) {
                lastCall = e;
                if (!e.kind().retryable()) {
                    throw e;
                }
                sleeper.sleep(backoff.multipliedBy(attempt));
                continue;
            }
            ToolUse use = response.blocks().stream().filter(ToolUse.class::isInstance).map(ToolUse.class::cast)
                    .filter(u -> u.name().equals(TOOL)).findFirst().orElse(null);
            if (use == null) {
                throw new IllegalStateException("Modelul de extracție nu a apelat " + TOOL);
            }
            lastIssues = schemas.validate(TOOL, use.input());
            if (lastIssues.isEmpty()) {
                return use.input();
            }
            // let the model fix its own output, as the agents do
            messages.add(Message.assistant(response.blocks()));
            var errors = mapper.createArrayNode();
            lastIssues.stream().limit(15).forEach(i -> errors.addObject().put("path", i.path()).put("messageRo", i.messageRo()));
            Block reply = new ToolResult(use.id(), mapper.createObjectNode().put("ok", false)
                    .put("message", "Rezultatul nu respectă schema; corectează și trimite din nou.")
                    .set("errors", errors), true);
            messages.add(Message.user(reply));
        }
        if (lastCall != null && lastIssues.isEmpty()) {
            throw lastCall;
        }
        throw new IllegalStateException("Extracția din " + document.fileName() + " nu respectă schema: "
                + (lastIssues.isEmpty() ? "?" : lastIssues.getFirst().messageRo()));
    }

    /** Converse allows letters, digits, single spaces, hyphens, parentheses and brackets in a document name. */
    static String documentName(String fileName) {
        String base = fileName == null ? "" : fileName.replaceAll("\\.[A-Za-z0-9]{1,5}$", "");
        String clean = base.replaceAll("[^A-Za-z0-9 ()\\[\\]-]", " ").replaceAll("\\s+", " ").strip();
        return clean.isEmpty() ? "document" : clean;
    }

    static String format(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        return FORMATS.contains(extension) ? extension : "pdf";
    }
}
