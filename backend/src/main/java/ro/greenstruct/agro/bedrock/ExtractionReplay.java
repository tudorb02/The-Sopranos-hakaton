package ro.greenstruct.agro.bedrock;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Hands recorded document readings to the extractor during a replay: the replay puts the recorded
 * extraction here just before it re-runs extract_document, and the extractor takes it instead of calling
 * Bedrock. Keyed by documentId; each reading is used once.
 */
public class ExtractionReplay {

    private final Map<String, JsonNode> pending = new ConcurrentHashMap<>();

    public void offer(String documentId, JsonNode extraction) {
        pending.put(documentId, extraction);
    }

    public Optional<JsonNode> take(String documentId) {
        return Optional.ofNullable(pending.remove(documentId));
    }
}
