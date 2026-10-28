package ro.greenstruct.agro.agents.rules;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

/**
 * An agent that decides by rules instead of a model: same tools, same submit schema. It is the last level of the
 * plan B (README §11): when Bedrock and the recordings are not available, the demo still runs end to end.
 */
public interface RuleAgent {

    AgentSlot slot();

    AgentResult run(Run run, AgentContext context);
}
