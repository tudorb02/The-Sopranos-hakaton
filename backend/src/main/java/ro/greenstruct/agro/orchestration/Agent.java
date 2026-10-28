package ro.greenstruct.agro.orchestration;

/**
 * One of the three Bedrock agents. The orchestrator calls it once per dossier, in pipeline order, with a
 * time limit; the agent reports progress through the context and returns its validated submit_* output.
 */
public interface Agent {

    AgentSlot slot();

    /** Model or inference profile id, shown in the agent.started event. */
    String modelId();

    AgentResult run(Run run, AgentContext context) throws Exception;
}
