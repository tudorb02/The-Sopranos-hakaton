package ro.greenstruct.agro.bedrock;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * What one agent decided in one run: the thoughts and tool calls in order, and the final submit input.
 * Calc references are stored as {{calc:tool/key}}, so a replay can run the same tools against the current
 * engine and end up with the calcIds of its own run. File format of data/demo/golden/&lt;scenario&gt;/&lt;slot&gt;.json.
 */
public record Recording(int version, String slot, String scenario, String modelId, String recordedAt,
                        List<Step> steps, JsonNode submit) {

    public static final int VERSION = 1;

    public Recording {
        steps = List.copyOf(steps);
    }

    /**
     * type is "thought" (text) or "tool_call" (tool + input); iteration is the Converse round it came from.
     * extraction: what the PDF reader returned for an extract_document call (the one step that involves an LLM),
     * so an offline replay can read the documents without Bedrock.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Step(String type, int iteration, String text, String tool, JsonNode input, JsonNode extraction) {

        public static Step thought(int iteration, String text) {
            return new Step("thought", iteration, text, null, null, null);
        }

        public static Step toolCall(int iteration, String tool, JsonNode input, JsonNode extraction) {
            return new Step("tool_call", iteration, null, tool, input, extraction);
        }
    }
}
