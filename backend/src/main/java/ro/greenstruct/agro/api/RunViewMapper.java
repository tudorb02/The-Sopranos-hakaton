package ro.greenstruct.agro.api;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

    /** FULL = the dossier as the bank receives it; SME = what the farmer sees (README §13: no funds). */
    public enum View { FULL, SME }

    /**
     * The part of submit_underwriting_report the farmer sees. The fund and its requirements, the green-bond
     * category, the labels, DNSH, the risks and the committee summary stay with the bank.
     */
    private static final List<String> SME_REPORT_FIELDS = List.of("decision", "moduleId", "recommendedOptionId",
            "criterion", "impact", "conditionsPrecedent", "monitoringKpis", "farmerNextSteps");

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

    public RunView toView(Run run) {
        return toView(run, View.FULL);
    }

    public RunView toView(Run run, View view) {
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        if (view == View.SME) {
            funding = withoutBankNotes(funding);
            report = smeReport(report);
        }
        Map<String, Calc> calcsById = new LinkedHashMap<>();
        calcs.all(run.id()).forEach(calc -> calcsById.put(calc.calcId(), calc));

        List<RunView.Document> documents = run.request().documents().stream()
                .map(d -> new RunView.Document(d.documentId(), d.docType(), d.fileName(), d.sizeBytes()))
                .toList();
        JsonNode questionnaire = run.request().questionnaire() == null || !run.request().questionnaire().isObject()
                ? mapper.createObjectNode() : run.request().questionnaire();
        RunView.Error error = run.error() == null ? null
                : new RunView.Error(run.error().code(), run.error().message(), run.error().failedStep().name());

        return new RunView(run.id(), run.request().cui(), run.request().moduleId(), run.request().demoScenario(),
                run.status().name(), orchestrator.mode(), run.monitoring(), run.createdAt(), run.updatedAt(), hub.lastSeq(run.id()),
                run.farmProfile(), run.request().parcelIds(), documents, questionnaire, agentStatus(run),
                new RunView.Agents(workspaces.forRun(run.id()).extractions(),
                        run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR), funding, report),
                calcsById, run.submission(), run.officerActions(), run.pendingDocuments(), error);
    }

    private static JsonNode withoutBankNotes(JsonNode funding) {
        if (!(funding instanceof ObjectNode object)) {
            return funding;
        }
        ObjectNode copy = object.deepCopy();
        copy.remove("officerNotesRo");
        return copy;
    }

    private JsonNode smeReport(JsonNode report) {
        if (report == null || !report.isObject()) {
            return report;
        }
        ObjectNode visible = mapper.createObjectNode();
        SME_REPORT_FIELDS.stream().filter(report::has).forEach(field -> visible.set(field, report.get(field).deepCopy()));
        return visible;
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
