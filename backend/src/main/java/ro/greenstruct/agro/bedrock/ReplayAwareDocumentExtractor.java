package ro.greenstruct.agro.bedrock;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

/**
 * The DocumentExtractor the app uses: a recorded reading during a replay, Bedrock otherwise. Without
 * Bedrock and without a recorded reading the document cannot be read, and the tool reports it.
 */
public class ReplayAwareDocumentExtractor implements DocumentExtractor {

    private final ExtractionReplay replay;
    private final DocumentExtractor bedrock;

    /** bedrock may be null when Bedrock is not configured. */
    public ReplayAwareDocumentExtractor(ExtractionReplay replay, DocumentExtractor bedrock) {
        this.replay = replay;
        this.bedrock = bedrock;
    }

    @Override
    public JsonNode extract(StoredDocument document, byte[] content, ModuleDefinition module) throws Exception {
        var recorded = replay.take(document.documentId());
        if (recorded.isPresent()) {
            return recorded.get();
        }
        if (bedrock == null) {
            throw new AgentFailureException("BEDROCK_UNAVAILABLE",
                    "Citirea documentelor prin Bedrock nu e configurată", false, null);
        }
        return bedrock.extract(document, content, module);
    }
}
