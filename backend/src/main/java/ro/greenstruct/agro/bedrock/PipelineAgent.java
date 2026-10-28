package ro.greenstruct.agro.bedrock;

import ro.greenstruct.agro.orchestration.Agent;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.Run;

/** Shared part of the three agents: the mode logic lives in AgentRuntime, the slot picks tools, prompt and schema. */
abstract class PipelineAgent implements Agent {

    private final AgentRuntime runtime;

    PipelineAgent(AgentRuntime runtime) {
        this.runtime = runtime;
    }

    @Override
    public String modelId() {
        return runtime.modelId();
    }

    @Override
    public AgentResult run(Run run, AgentContext context) throws Exception {
        return runtime.execute(run, context, slot());
    }
}
