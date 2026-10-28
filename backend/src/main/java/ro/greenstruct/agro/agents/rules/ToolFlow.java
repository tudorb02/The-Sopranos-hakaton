package ro.greenstruct.agro.agents.rules;

import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.ToolRegistry;

/**
 * What a rule-based agent does instead of a model: calls tools through the registry, tells the live timeline about
 * each call as a Bedrock agent would, and looks calcs up by key. The decisions are code; the numbers are the tools'.
 */
final class ToolFlow {

    private final Run run;
    private final AgentContext context;
    private final ToolRegistry tools;
    private final CalcStore calcs;
    private final ObjectMapper mapper;
    private int iteration;

    ToolFlow(Run run, AgentContext context, ToolRegistry tools, CalcStore calcs, ObjectMapper mapper) {
        this.run = run;
        this.context = context;
        this.tools = tools;
        this.calcs = calcs;
        this.mapper = mapper;
    }

    int iterations() {
        return iteration;
    }

    ObjectNode input() {
        return mapper.createObjectNode();
    }

    void thought(String text) {
        context.thought(text, Math.max(1, iteration));
    }

    /** Calls a tool; a tool error stops the agent, as an agent that cannot correct itself would. */
    ToolOutput call(String tool, ObjectNode input, String messageRo) {
        ToolOutput out = tryCall(tool, input, messageRo);
        if (!out.ok()) {
            throw new AgentFailureException("AGENT_TOOL_ERROR", tool + ": " + out.messageRo(), false, null);
        }
        return out;
    }

    /** Like call, but returns the failed output so the caller can try something else. */
    ToolOutput tryCall(String tool, ObjectNode input, String messageRo) {
        iteration++;
        String toolUseId = "toolu_rule_" + iteration;
        context.toolCall(toolUseId, tool, iteration, input, messageRo);
        long started = System.nanoTime();
        ToolOutput out = tools.execute(run.id(), tool, input);
        long ms = (System.nanoTime() - started) / 1_000_000;
        context.toolResult(toolUseId, tool, out.ok(), ms, mapper.valueToTree(out.calcs()), out.result(),
                out.messageRo());
        return out;
    }

    Optional<Calc> calc(String key) {
        return calcs.latestByKey(run.id(), key);
    }

    String id(String key) {
        return calc(key).map(Calc::calcId).orElseThrow(() -> new AgentFailureException("AGENT_MISSING_CALC",
                "Lipsește cifra " + key, false, null));
    }

    Optional<String> idIfPresent(String key) {
        return calc(key).map(Calc::calcId);
    }

    ObjectMapper mapper() {
        return mapper;
    }

    Run run() {
        return run;
    }

    static String text(JsonNode node, String field, String fallback) {
        return node.path(field).asText(fallback);
    }
}
