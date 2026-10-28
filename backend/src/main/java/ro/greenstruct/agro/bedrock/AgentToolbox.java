package ro.greenstruct.agro.bedrock;

import java.util.List;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** What an agent may use in one dossier: its tools, a way to run them and the calcs produced so far. */
public interface AgentToolbox {

    /** The tool specifications for the model (never hardcoded: whatever the registry has for this agent). */
    List<BedrockGateway.ToolSpec> toolsFor(AgentSlot slot);

    ToolExecutor executorFor(String runId);

    CalcDirectory calcsFor(String runId);
}
