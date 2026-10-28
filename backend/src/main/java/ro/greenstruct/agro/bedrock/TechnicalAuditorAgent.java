package ro.greenstruct.agro.bedrock;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** Agent 1: reads the documents, runs the module's formulas, searches upgrades, checks DNSH inputs. */
@Component
@ConditionalOnProperty(name = "greenstruct.agent-runtime.enabled", havingValue = "true", matchIfMissing = true)
public class TechnicalAuditorAgent extends PipelineAgent {

    TechnicalAuditorAgent(AgentRuntime runtime) {
        super(runtime);
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }
}
