package ro.greenstruct.agro.bedrock;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Thin, SDK-free view of the Bedrock Converse API: one request, one response. The tool loop and the
 * extractor only know these types, so tests run against a fake gateway.
 */
public interface BedrockGateway {

    Response converse(Request request) throws BedrockCallException;

    /** forcedTool: when set, the model must call exactly this tool (toolChoice = tool). */
    record Request(String modelId, String system, List<Message> messages, List<ToolSpec> tools, String forcedTool,
                   int maxTokens) {
    }

    record Message(String role, List<Block> blocks) {

        public static Message user(Block... blocks) {
            return new Message("user", List.of(blocks));
        }

        public static Message user(List<Block> blocks) {
            return new Message("user", List.copyOf(blocks));
        }

        public static Message assistant(List<Block> blocks) {
            return new Message("assistant", List.copyOf(blocks));
        }
    }

    sealed interface Block permits Text, ToolUse, ToolResult, Attachment {
    }

    record Text(String text) implements Block {
    }

    record ToolUse(String id, String name, JsonNode input) implements Block {
    }

    /** content is always a JSON object (Converse json block). */
    record ToolResult(String toolUseId, JsonNode content, boolean error) implements Block {
    }

    /** A PDF (or other document) passed as bytes; name must be alphanumeric plus spaces, hyphens, brackets. */
    record Attachment(String name, String format, byte[] bytes) implements Block {
    }

    /** inputSchema is plain JSON Schema without $ref/$defs (see SchemaSupport.forBedrock). */
    record ToolSpec(String name, String description, JsonNode inputSchema) {
    }

    record Response(List<Block> blocks, String stopReason, int inputTokens, int outputTokens) {
    }
}
