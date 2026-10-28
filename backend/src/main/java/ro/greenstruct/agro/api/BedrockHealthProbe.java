package ro.greenstruct.agro.api;

import java.util.List;

/**
 * Pings the Bedrock models before the demo. Implemented by the AI engineer next to the Bedrock client;
 * without an implementation the health endpoint reports the models as not configured.
 */
public interface BedrockHealthProbe {

    /** role: AGENT, EXTRACTION or FALLBACK. */
    record ModelStatus(String role, String modelId, boolean up, Long latencyMs, String errorRo) {
    }

    List<ModelStatus> probe();
}
