package ro.greenstruct.agro.bedrock;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

/** The last level of the plan B: when there is neither Bedrock nor a recording, rules decide (README §11). */
public interface RuleFallback {

    AgentResult run(Run run, AgentContext context, AgentSlot slot);
}
