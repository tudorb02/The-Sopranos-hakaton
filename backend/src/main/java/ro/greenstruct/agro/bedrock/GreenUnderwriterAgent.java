package ro.greenstruct.agro.bedrock;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** Agent 3: ticks the fund requirements, picks the bond category, turns gaps into conditions, writes the report. */
@Component
@ConditionalOnProperty(name = "greenstruct.agent-runtime.enabled", havingValue = "true", matchIfMissing = true)
public class GreenUnderwriterAgent extends PipelineAgent {

    GreenUnderwriterAgent(AgentRuntime runtime) {
        super(runtime);
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.GREEN_UNDERWRITER;
    }
}
