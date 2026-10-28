package ro.greenstruct.agro.orchestration.events;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** Envelope of every SSE event (contracts/schemas/event.json); agent is null for state.transition and run.*. */
public record RunEvent(long seq, String runId, EventType type, AgentSlot agent, Instant at, String message,
                       JsonNode data) {
}
