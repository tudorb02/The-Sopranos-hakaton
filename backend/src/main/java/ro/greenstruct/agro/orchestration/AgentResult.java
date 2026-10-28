package ro.greenstruct.agro.orchestration;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * The input of the agent's submit_* tool, already validated against its schema in contracts/.
 * source is LIVE, RETRY, FALLBACK_MODEL, CACHE or GOLDEN (the badge in the officer's view).
 */
public record AgentResult(JsonNode output, String source, int iterations) {
}
