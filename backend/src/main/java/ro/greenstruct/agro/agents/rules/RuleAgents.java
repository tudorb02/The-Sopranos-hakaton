package ro.greenstruct.agro.agents.rules;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** The three rule-based agents by slot. */
@Component
public class RuleAgents {

    private final Map<AgentSlot, RuleAgent> bySlot = new EnumMap<>(AgentSlot.class);

    public RuleAgents(List<RuleAgent> agents) {
        agents.forEach(agent -> bySlot.put(agent.slot(), agent));
    }

    public RuleAgent require(AgentSlot slot) {
        RuleAgent agent = bySlot.get(slot);
        if (agent == null) {
            throw new IllegalStateException("No rule-based agent for " + slot);
        }
        return agent;
    }
}
