package ro.greenstruct.agro.bedrock;

import java.util.List;

import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolRegistry;

/** The real toolbox: tools from ToolRegistry.forAgent, calcs from CalcStore. */
@Component
public class RegistryToolbox implements AgentToolbox {

    private final ToolRegistry registry;
    private final CalcStore calcStore;

    public RegistryToolbox(ToolRegistry registry, CalcStore calcStore) {
        this.registry = registry;
        this.calcStore = calcStore;
    }

    @Override
    public List<BedrockGateway.ToolSpec> toolsFor(AgentSlot slot) {
        return registry.forAgent(slot).stream().map(RegistryToolbox::spec).toList();
    }

    private static BedrockGateway.ToolSpec spec(ToolHandler handler) {
        return new BedrockGateway.ToolSpec(handler.name(), handler.description(),
                SchemaSupport.flatten(handler.inputSchema()));
    }

    @Override
    public ToolExecutor executorFor(String runId) {
        return (tool, input) -> registry.execute(runId, tool, input);
    }

    @Override
    public CalcDirectory calcsFor(String runId) {
        return CalcDirectory.of(calcStore, runId);
    }
}
