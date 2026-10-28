package ro.greenstruct.agro.bedrock;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolOutput;

/** Runs one deterministic tool for the current dossier (ToolRegistry.execute with the run id bound). */
@FunctionalInterface
public interface ToolExecutor {

    ToolOutput execute(String toolName, JsonNode input);
}
