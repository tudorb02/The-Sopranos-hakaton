package ro.greenstruct.agro.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunOrchestrator;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.StepRecord;
import ro.greenstruct.agro.orchestration.events.SseHub;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

/** Builds the contract's RunView from the dossier, its calcs, its workspace and its event buffer. */
@Component
public class RunViewMapper {

    private final CalcStore calcs;
    private final WorkspaceStore workspaces;
    private final SseHub hub;
    private final RunOrchestrator orchestrator;
    private final ObjectMapper mapper;

    public RunViewMapper(CalcStore calcs, WorkspaceStore workspaces, SseHub hub, RunOrchestrator orchestrator,
                         ObjectMapper mapper) {
        this.calcs = calcs;
        this.workspaces = workspaces;
        this.hub = hub;
        this.orchestrator = orchestrator;
        this.mapper = mapper;
    }

    /** Tools whose calcs only the officer sees: the fund, its requirements and the bond category (README §13). */
    private static final Set<String> OFFICER_ONLY_TOOLS = Set.of("select_fund", "check_fund_requirements",
            "get_bond_category", "get_labeling_rules");

    public RunView toView(Run run) {
        return build(run, false);
    }

    /** The farmer's representative sees no funds: no underwriting report, no fund calcs, no officer notes. */
    public RunView toSmeView(Run run) {
        return build(run, true);
    }

    private RunView build(Run run, boolean sme) {
        Map<String, Calc> calcsById = new LinkedHashMap<>();
        calcs.all(run.id()).stream().filter(calc -> !sme || !OFFICER_ONLY_TOOLS.contains(calc.tool()))
                .forEach(calc -> calcsById.put(calc.calcId(), calc));

        List<RunView.Document> documents = run.request().documents().stream()
                .map(d -> new RunView.Document(d.documentId(), d.docType(), d.fileName(), d.sizeBytes()))
                .toList();
        JsonNode questionnaire = run.request().questionnaire() == null || !run.request().questionnaire().isObject()
                ? mapper.createObjectNode() : run.request().questionnaire();
        RunView.Error error = run.error() == null ? null
                : new RunView.Error(run.error().code(), run.error().message(), run.error().failedStep().name());

        return new RunView(run.id(), sme ? "SME" : "OFFICER", run.request().cui(), run.request().moduleId(),
                run.request().demoScenario(), run.status().name(), orchestrator.mode(), run.chosenVariant(),
                run.monitoring(), run.createdAt(), run.updatedAt(), hub.lastSeq(run.id()),
                run.farmProfile(), run.request().parcelIds(), documents, questionnaire, agentStatus(run),
                new RunView.Agents(workspaces.forRun(run.id()).extractions(),
                        run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR),
                        sme ? withoutOfficerNotes(run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER))
                                : run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER),
                        sme ? null : run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER)),
                calcsById, sme ? List.of() : run.officerActions(), run.pendingDocuments(), error);
    }

    private JsonNode withoutOfficerNotes(JsonNode funding) {
        if (funding == null || !funding.isObject()) {
            return funding;
        }
        ObjectNode copy = funding.deepCopy();
        if (copy.has("officerNotesRo")) {
            copy.put("officerNotesRo", "");
        }
        return copy;
    }

    private static List<RunView.AgentStatus> agentStatus(Run run) {
        List<RunView.AgentStatus> statuses = new ArrayList<>();
        for (AgentSlot slot : AgentSlot.values()) {
            Optional<StepRecord> step = run.steps().stream().filter(s -> s.step() == slot.status()).findFirst();
            if (step.isPresent()) {
                StepRecord done = step.get();
                Instant completed = done.startedAt().plusMillis(done.durationMs());
                String status = "LIVE".equals(done.mode()) ? "COMPLETED" : "DEGRADED";
                statuses.add(new RunView.AgentStatus(slot.name(), status, done.mode(), done.startedAt(), completed));
            } else if (run.status() == slot.status()) {
                statuses.add(new RunView.AgentStatus(slot.name(), "RUNNING", null, null, null));
            } else if (run.status() == RunStatus.ESUAT && run.error() != null
                    && run.error().failedStep() == slot.status()) {
                statuses.add(new RunView.AgentStatus(slot.name(), "FAILED", null, null, null));
            } else {
                statuses.add(new RunView.AgentStatus(slot.name(), "PENDING", null, null, null));
            }
        }
        return statuses;
    }
}
