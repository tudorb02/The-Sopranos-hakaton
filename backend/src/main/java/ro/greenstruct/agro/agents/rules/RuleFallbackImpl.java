package ro.greenstruct.agro.agents.rules;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.bedrock.ExtractionReplay;
import ro.greenstruct.agro.bedrock.RuleFallback;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

/**
 * Runs the rule-based agent of a slot. The recorded readings of the dossier's documents are handed to the extractor
 * first, so extract_document works without Bedrock. The result is reported as GOLDEN: recorded readings plus fixed
 * decisions, with every figure recalculated live.
 */
@Component
@ConditionalOnProperty(name = "greenstruct.agent-runtime.enabled", havingValue = "true", matchIfMissing = true)
public class RuleFallbackImpl implements RuleFallback {

    private final RuleAgents agents;
    private final RecordedExtractions recorded;
    private final ExtractionReplay extractions;

    public RuleFallbackImpl(RuleAgents agents, RecordedExtractions recorded, ExtractionReplay extractions) {
        this.agents = agents;
        this.recorded = recorded;
        this.extractions = extractions;
    }

    @Override
    public AgentResult run(Run run, AgentContext context, AgentSlot slot) {
        if (slot == AgentSlot.TECHNICAL_AUDITOR) {
            run.request().documents().forEach(document ->
                    recorded.find(document.documentId()).ifPresent(reading -> extractions.offer(document.documentId(), reading)));
        }
        AgentResult result = agents.require(slot).run(run, context);
        return new AgentResult(result.output(), "GOLDEN", result.iterations());
    }
}
