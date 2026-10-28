package ro.greenstruct.agro.tools;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * What a tool returns to the model and to the timeline: the new calcs (numbers) and a structured result
 * without numbers (verdicts, ids). On error, messageRo explains what to fix and the model retries.
 */
public record ToolOutput(boolean ok, List<Calc> calcs, JsonNode result, String messageRo) {

    public ToolOutput {
        calcs = List.copyOf(calcs);
    }
}
