package ro.greenstruct.agro.orchestration;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.orchestration.events.RunEventPublisher;

/** What an agent may do besides returning its output: tell the live timeline what it is doing. */
public record AgentContext(String runId, AgentSlot slot, RunEventPublisher events) {

    public void thought(String text, int iteration) {
        events.thought(runId, slot, text, iteration);
    }

    public void toolCall(String toolUseId, String tool, int iteration, JsonNode input, String message) {
        events.toolCall(runId, slot, toolUseId, tool, iteration, input, message);
    }

    public void toolResult(String toolUseId, String tool, boolean ok, long durationMs, JsonNode calcs,
                           JsonNode result, String message) {
        events.toolResult(runId, slot, toolUseId, tool, ok, durationMs, calcs, result, message);
    }

    public void degraded(String level, String reason, int attempt, String detailRo) {
        events.degraded(runId, slot, level, reason, attempt, detailRo);
    }
}
