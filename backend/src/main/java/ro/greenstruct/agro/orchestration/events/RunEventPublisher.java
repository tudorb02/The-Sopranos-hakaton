package ro.greenstruct.agro.orchestration.events;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.RunStatus;

/** Builds each event's data exactly as contracts/schemas/event.json defines it, so the frontend can rely on it. */
@Component
public class RunEventPublisher {

    private static final int MAX_MESSAGE = 300;

    private final SseHub hub;
    private final ObjectMapper mapper;

    public RunEventPublisher(SseHub hub, ObjectMapper mapper) {
        this.hub = hub;
        this.mapper = mapper;
    }

    public record DataSource(String source, String mode) {
    }

    public enum Actor { SYSTEM, FARMER, OFFICER }

    public RunEvent transition(String runId, RunStatus from, RunStatus to, Actor actor, String reasonRo,
                               List<DataSource> dataSources) {
        ObjectNode data = mapper.createObjectNode();
        data.put("from", from == null ? null : from.name());
        data.put("to", to.name());
        data.put("actor", actor.name());
        if (reasonRo != null) {
            data.put("reasonRo", truncate(reasonRo));
        }
        if (!dataSources.isEmpty()) {
            data.set("dataSources", mapper.valueToTree(dataSources));
        }
        return publish(runId, EventType.STATE_TRANSITION, null, reasonRo != null ? reasonRo : "The dossier moves to " + to, data);
    }

    public RunEvent agentStarted(String runId, AgentSlot agent, String modelId, String mode, int attempt) {
        ObjectNode data = mapper.createObjectNode();
        data.put("step", agent.status().name());
        data.put("modelId", modelId);
        data.put("mode", mode);
        data.put("attempt", attempt);
        return publish(runId, EventType.AGENT_STARTED, agent, agent.label() + " started", data);
    }

    public RunEvent thought(String runId, AgentSlot agent, String text, int iteration) {
        ObjectNode data = mapper.createObjectNode();
        data.put("text", text.length() > 1000 ? text.substring(0, 1000) : text);
        data.put("iteration", iteration);
        return publish(runId, EventType.AGENT_THOUGHT, agent, text, data);
    }

    public RunEvent toolCall(String runId, AgentSlot agent, String toolUseId, String tool, int iteration,
                             JsonNode input, String message) {
        ObjectNode data = mapper.createObjectNode();
        data.put("toolUseId", toolUseId);
        data.put("tool", tool);
        data.put("iteration", iteration);
        data.set("input", input);
        return publish(runId, EventType.AGENT_TOOL_CALL, agent, message, data);
    }

    public RunEvent toolResult(String runId, AgentSlot agent, String toolUseId, String tool, boolean ok,
                               long durationMs, JsonNode calcs, JsonNode result, String message) {
        ObjectNode data = mapper.createObjectNode();
        data.put("toolUseId", toolUseId);
        data.put("tool", tool);
        data.put("status", ok ? "OK" : "ERROR");
        data.put("durationMs", durationMs);
        data.set("calcs", calcs);
        data.set("result", result);
        return publish(runId, EventType.AGENT_TOOL_RESULT, agent, message, data);
    }

    public RunEvent agentCompleted(String runId, AgentSlot agent, String source, int iterations, long durationMs,
                                   JsonNode output) {
        ObjectNode data = mapper.createObjectNode();
        data.put("submitTool", agent.submitTool());
        data.put("source", source);
        data.put("iterations", iterations);
        data.put("durationMs", durationMs);
        data.set("output", output);
        return publish(runId, EventType.AGENT_COMPLETED, agent, agent.label() + " finished", data);
    }

    public RunEvent degraded(String runId, AgentSlot agent, String level, String reason, int attempt, String detailRo) {
        ObjectNode data = mapper.createObjectNode();
        data.put("level", level);
        data.put("reason", reason);
        data.put("attempt", attempt);
        if (detailRo != null) {
            data.put("detailRo", truncate(detailRo));
        }
        return publish(runId, EventType.AGENT_DEGRADED, agent,
                detailRo != null ? detailRo : agent.label() + " is using the fallback (" + level + ")", data);
    }

    public RunEvent runCompleted(String runId, long durationMs, String decision, String recommendedOptionId,
                                 String netAdvantageCalcId, Map<AgentSlot, String> sources) {
        ObjectNode data = mapper.createObjectNode();
        data.put("state", RunStatus.GATA.name());
        data.put("durationMs", durationMs);
        data.put("decision", decision);
        data.put("recommendedOptionId", recommendedOptionId);
        data.put("netAdvantageCalcId", netAdvantageCalcId);
        ObjectNode sourceNode = data.putObject("sources");
        sources.forEach((agent, source) -> sourceNode.put(agent.name(), source));
        return publish(runId, EventType.RUN_COMPLETED, null, "The dossier is ready for the credit officer", data);
    }

    public RunEvent runFailed(String runId, RunStatus failedStep, String errorCode, String messageRo, boolean retryable) {
        ObjectNode data = mapper.createObjectNode();
        data.put("state", RunStatus.ESUAT.name());
        data.put("failedStep", failedStep.name());
        data.put("errorCode", errorCode);
        data.put("messageRo", truncate(messageRo));
        data.put("retryable", retryable);
        return publish(runId, EventType.RUN_FAILED, null, messageRo, data);
    }

    private RunEvent publish(String runId, EventType type, AgentSlot agent, String message, JsonNode data) {
        return hub.publish(runId, type, agent, truncate(message), data);
    }

    private static String truncate(String text) {
        return text.length() <= MAX_MESSAGE ? text : text.substring(0, MAX_MESSAGE - 1) + "…";
    }
}
