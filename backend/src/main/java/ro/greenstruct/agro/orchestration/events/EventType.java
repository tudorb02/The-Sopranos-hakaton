package ro.greenstruct.agro.orchestration.events;

import com.fasterxml.jackson.annotation.JsonValue;

/** Wire names from contracts/schemas/event.json. */
public enum EventType {
    STATE_TRANSITION("state.transition"),
    AGENT_STARTED("agent.started"),
    AGENT_THOUGHT("agent.thought"),
    AGENT_TOOL_CALL("agent.tool_call"),
    AGENT_TOOL_RESULT("agent.tool_result"),
    AGENT_COMPLETED("agent.completed"),
    AGENT_DEGRADED("agent.degraded"),
    RUN_COMPLETED("run.completed"),
    RUN_FAILED("run.failed");

    private final String wireName;

    EventType(String wireName) {
        this.wireName = wireName;
    }

    @JsonValue
    public String wireName() {
        return wireName;
    }
}
