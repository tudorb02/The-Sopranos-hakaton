package ro.greenstruct.agro.bedrock;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.ToolOutput;

/**
 * Timeline events for a tool call, shared by the live loop and the replay so both look the same
 * (conventions in contracts/events.md). Executes the tool and measures it.
 */
final class ToolEvents {

    private final ObjectMapper mapper;

    ToolEvents(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    static String newToolUseId() {
        return "tooluse_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    /** Emits agent.tool_call, runs the tool, emits agent.tool_result. A tool that throws becomes an error result. */
    ToolOutput run(AgentContext context, ToolExecutor executor, String toolUseId, String tool, int iteration,
                   JsonNode input) {
        context.toolCall(toolUseId, tool, iteration, input, "🔧 " + tool.replace('_', ' '));
        long started = System.nanoTime();
        ToolOutput output;
        try {
            output = executor.execute(tool, input);
        } catch (RuntimeException e) {
            String message = e.getMessage() == null ? "Unealta a eșuat." : e.getMessage();
            output = new ToolOutput(false, List.of(), mapper.createObjectNode().put("error", message), message);
        }
        long millis = (System.nanoTime() - started) / 1_000_000;
        context.toolResult(toolUseId, tool, output.ok(), millis, mapper.valueToTree(output.calcs()),
                output.result() == null ? mapper.createObjectNode() : output.result(), resultMessage(output));
        return output;
    }

    private static String resultMessage(ToolOutput output) {
        if (output.messageRo() != null && !output.messageRo().isBlank()) {
            return (output.ok() ? "🔧 " : "⚠️ ") + output.messageRo();
        }
        if (output.calcs().isEmpty()) {
            return output.ok() ? "🔧 Gata" : "⚠️ Unealta a întors o eroare";
        }
        Calc first = output.calcs().getFirst();
        String more = output.calcs().size() > 1 ? " (+" + (output.calcs().size() - 1) + " cifre)" : "";
        return "🔧 " + first.labelRo() + ": " + first.display() + more;
    }

    /** What the model reads back: figures with their calcId (it must cite the id, never retype the number). */
    ObjectNode forModel(ToolOutput output) {
        ObjectNode node = mapper.createObjectNode();
        node.put("ok", output.ok());
        if (output.messageRo() != null) {
            node.put("message", output.messageRo());
        }
        ArrayNode calcs = node.putArray("calcs");
        for (Calc calc : output.calcs()) {
            ObjectNode entry = calcs.addObject();
            entry.put("calcId", calc.calcId());
            entry.put("key", calc.key());
            entry.put("label", calc.labelRo());
            entry.put("display", calc.display());
            if (calc.value() != null) {
                entry.put("value", calc.value());
            }
            if (calc.unit() != null) {
                entry.put("unit", calc.unit().name());
            }
        }
        node.set("result", output.result() == null ? mapper.createObjectNode() : output.result());
        return node;
    }
}
