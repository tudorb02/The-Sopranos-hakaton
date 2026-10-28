package ro.greenstruct.agro.bedrock;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** Agent 2: structures the credit (classic and green), prices it, checks affordability and recommends. */
@Component
@ConditionalOnProperty(name = "greenstruct.agent-runtime.enabled", havingValue = "true", matchIfMissing = true)
public class FundingOptimizerAgent extends PipelineAgent {

    FundingOptimizerAgent(AgentRuntime runtime) {
        super(runtime);
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }
}
