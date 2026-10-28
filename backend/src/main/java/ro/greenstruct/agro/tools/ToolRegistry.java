package ro.greenstruct.agro.tools;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunNotFoundException;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.tools.technical.ModuleCalculators;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

/**
 * Entry point for the agents' tool calls: finds the tool, builds its context from the dossier and runs it.
 * Input mistakes come back as ok=false with a Romanian message so the model can correct itself.
 */
@Component
public class ToolRegistry {

    private final Map<String, ToolHandler> tools = new LinkedHashMap<>();
    private final RunStore runs;
    private final ModuleRegistry modules;
    private final ReferenceData reference;
    private final WorkspaceStore workspaces;
    private final CalcStore calcStore;
    private final ObjectMapper mapper;
    private final GreenStructProperties properties;
    private final ModuleCalculators calculators;

    public ToolRegistry(List<ToolHandler> handlers, RunStore runs, ModuleRegistry modules, ReferenceData reference,
                        WorkspaceStore workspaces, CalcStore calcStore, ObjectMapper mapper,
                        GreenStructProperties properties, ModuleCalculators calculators) {
        for (ToolHandler handler : handlers) {
            if (tools.putIfAbsent(handler.name(), handler) != null) {
                throw new IllegalStateException("Duplicate tool " + handler.name());
            }
        }
        this.runs = runs;
        this.modules = modules;
        this.reference = reference;
        this.workspaces = workspaces;
        this.calcStore = calcStore;
        this.mapper = mapper;
        this.properties = properties;
        this.calculators = calculators;
    }

    public List<ToolHandler> forAgent(AgentSlot agent) {
        return tools.values().stream().filter(tool -> tool.agent() == agent).toList();
    }

    public Optional<ToolHandler> find(String name) {
        return Optional.ofNullable(tools.get(name));
    }

    public ToolOutput execute(String runId, String toolName, JsonNode input) {
        ToolHandler handler = find(toolName)
                .orElseThrow(() -> new IllegalArgumentException("Unealtă necunoscută: " + toolName));
        Run run = runs.find(runId).orElseThrow(() -> new RunNotFoundException(runId));
        String moduleId = run.request().moduleId();
        ToolContext context = new ToolContext(toolName, run, modules.require(moduleId),
                modules.catalog(moduleId).orElse(mapper.createObjectNode()), workspaces.forRun(runId), reference,
                properties.today(), mapper, calcStore, calculators);
        try {
            return handler.execute(input == null ? mapper.createObjectNode() : input, context);
        } catch (IllegalArgumentException e) {
            return new ToolOutput(false, context.created(), mapper.createObjectNode().put("error", e.getMessage()),
                    e.getMessage());
        }
    }
}
