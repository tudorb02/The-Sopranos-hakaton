package ro.greenstruct.agro.tools;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.orchestration.AgentSlot;

/**
 * A deterministic tool the agents call through Bedrock tool use. The name, description and input schema
 * go to the model as the tool specification; execute never calls an LLM (except extract_document).
 */
public interface ToolHandler {

    String name();

    String description();

    /** JSON Schema of the input the model must send. */
    JsonNode inputSchema();

    /** Which agent gets this tool in its tool list. */
    AgentSlot agent();

    ToolOutput execute(JsonNode input, ToolContext context);
}
