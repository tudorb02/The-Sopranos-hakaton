package ro.greenstruct.agro.orchestration;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.farm.FarmProfile;
import ro.greenstruct.agro.farm.FarmNotFoundException;
import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.orchestration.events.RunEventPublisher;
import ro.greenstruct.agro.orchestration.events.RunEventPublisher.Actor;
import ro.greenstruct.agro.orchestration.events.RunEventPublisher.DataSource;

/**
 * Deterministic state machine for a dossier: farm data, then the three agents in order, each with a time
 * limit. The order is fixed on purpose; the intelligence lives inside each agent, not in the sequencing.
 */
@Service
public class RunOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(RunOrchestrator.class);

    private final RunStore store;
    private final RunEventPublisher events;
    private final FarmProfileService farmProfiles;
    private final ModuleRegistry modules;
    private final Map<AgentSlot, Agent> agents = new EnumMap<>(AgentSlot.class);
    private final ExecutorService executor;
    private final Duration agentTimeout;
    private final String mode;

    public RunOrchestrator(RunStore store, RunEventPublisher events, FarmProfileService farmProfiles,
                           ModuleRegistry modules, List<Agent> agentBeans, ExecutorService pipelineExecutor,
                           GreenStructProperties properties) {
        this.store = store;
        this.events = events;
        this.farmProfiles = farmProfiles;
        this.modules = modules;
        this.executor = pipelineExecutor;
        this.agentTimeout = properties.agents().timeout();
        this.mode = properties.mode();
        for (Agent agent : agentBeans) {
            if (agents.putIfAbsent(agent.slot(), agent) != null) {
                throw new IllegalStateException("Two agents registered for " + agent.slot());
            }
        }
    }

    public record StartedRun(Run run, CompletableFuture<Run> completion) {
    }

    /** Validates the request, fetches the farm (so a wrong CUI fails fast) and starts the pipeline. */
    public StartedRun start(RunRequest request) {
        if (request.cui() == null || request.cui().isBlank()) {
            throw new IllegalArgumentException("CUI-ul este obligatoriu");
        }
        ModuleDefinition module = modules.find(request.moduleId())
                .orElseThrow(() -> new IllegalArgumentException("Modul necunoscut: " + request.moduleId()));
        if (!module.demoReady()) {
            throw new RunRejectedException(RunRejectedException.Reason.MODULE_NOT_READY,
                    "Modulul " + module.nameRo() + " nu este încă disponibil pentru analiză completă");
        }
        FarmProfile profile;
        try {
            profile = farmProfiles.get(request.cui());
        } catch (FarmNotFoundException e) {
            throw new RunRejectedException(RunRejectedException.Reason.FARM_NOT_FOUND, e.getMessage());
        }

        Run run = store.save(Run.create(request, missingRequiredDocuments(module, request), profile));
        events.transition(run.id(), null, RunStatus.CREAT, Actor.FARMER, "Dosar creat: " + module.nameRo() + ", "
                + request.documents().size() + " documente încărcate", List.of());
        CompletableFuture<Run> completion = CompletableFuture.supplyAsync(() -> execute(run.id()), executor);
        return new StartedRun(run, completion);
    }

    public String mode() {
        return mode;
    }

    /**
     * GATA → TRIMIS by the farmer, with the card they chose. CLASIC is the standard option; VERDE is the green
     * option the funding agent recommends (or its only green option) and exists only if it is green-eligible.
     */
    public Run submit(String runId, Submission.Variant variant) {
        requireStatus(runId, RunStatus.GATA, "trimis");
        JsonNode funding = store.find(runId).orElseThrow(() -> new RunNotFoundException(runId)).agentOutputs()
                .getOrDefault(AgentSlot.FUNDING_OPTIMIZER, MissingNode.getInstance());
        String optionId = optionFor(funding, variant).orElseThrow(() -> new IllegalStateException(
                variant == Submission.Variant.VERDE
                        ? "Dosarul nu are o ofertă de credit verde: investiția nu atinge pragul verde"
                        : "Dosarul nu are o ofertă de credit clasic"));
        Run submitted = store.update(runId, run -> run.withStatus(RunStatus.TRIMIS)
                .withSubmission(new Submission(variant, optionId, Instant.now())));
        events.transition(runId, RunStatus.GATA, RunStatus.TRIMIS, Actor.FARMER,
                "Cererea a fost trimisă la bancă: " + variant.labelRo(), List.of());
        return submitted;
    }

    static Optional<String> optionFor(JsonNode funding, Submission.Variant variant) {
        List<JsonNode> matching = new ArrayList<>();
        for (JsonNode option : funding.path("options")) {
            boolean available = variant == Submission.Variant.CLASIC || option.path("greenEligible").asBoolean();
            if (Submission.Variant.ofKind(option.path("kind").asText()) == variant && available) {
                matching.add(option);
            }
        }
        String recommended = funding.path("recommendedOptionId").asText();
        return matching.stream().filter(option -> option.path("optionId").asText().equals(recommended)).findFirst()
                .or(() -> matching.stream().findFirst())
                .map(option -> option.path("optionId").asText());
    }

    /** TRIMIS → APROBAT by the bank; in the demo the drawdown is simulated at once, so → MONITORIZARE. */
    public Run approve(String runId, String officerId, String commentRo) {
        requireStatus(runId, RunStatus.TRIMIS, "aprobat");
        store.update(runId, run -> run.withStatus(RunStatus.APROBAT).withOfficerAction(
                new OfficerAction(OfficerAction.Action.APPROVE, Instant.now(), officerId, commentRo), List.of()));
        events.transition(runId, RunStatus.TRIMIS, RunStatus.APROBAT, Actor.OFFICER, "Banca a aprobat dosarul",
                List.of());
        Run monitored = store.update(runId, run -> run.withStatus(RunStatus.MONITORIZARE));
        events.transition(runId, RunStatus.APROBAT, RunStatus.MONITORIZARE, Actor.SYSTEM,
                "Creditul a fost tras; începe monitorizarea economiilor", List.of());
        return monitored;
    }

    /** Only on a dossier sent to the bank, which stays TRIMIS; the requested documents show up for the farmer. */
    public Run requestDocuments(String runId, String officerId, String messageRo, List<PendingDocument> documents) {
        if (documents.isEmpty()) {
            throw new IllegalArgumentException("Lista de documente cerute este goală");
        }
        requireStatus(runId, RunStatus.TRIMIS, "completat cu documente");
        return store.update(runId, run -> run.withOfficerAction(
                new OfficerAction(OfficerAction.Action.REQUEST_DOCUMENTS, Instant.now(), officerId, messageRo),
                documents));
    }

    Run execute(String runId) {
        long startedNanos = System.nanoTime();
        RunStatus current = RunStatus.CREAT;
        Map<AgentSlot, String> sources = new EnumMap<>(AgentSlot.class);
        try {
            current = RunStatus.DATE_FIRMA;
            recordFarmData(runId);
            for (AgentSlot slot : AgentSlot.values()) {
                current = slot.status();
                sources.put(slot, runAgent(runId, slot));
            }
            current = RunStatus.GATA;
            Run done = move(runId, RunStatus.GATA, "Ofertele sunt gata; fermierul alege varianta și trimite cererea",
                    List.of());
            JsonNode funding = done.agentOutputs().getOrDefault(AgentSlot.FUNDING_OPTIMIZER, MissingNode.getInstance());
            JsonNode report = done.agentOutputs().getOrDefault(AgentSlot.GREEN_UNDERWRITER, MissingNode.getInstance());
            events.runCompleted(runId, elapsedMs(startedNanos), report.path("decision").asText(null),
                    report.path("recommendedOptionId").asText(null),
                    funding.path("comparison").path("netAdvantageCalcId").asText(null), sources);
            return done;
        } catch (StepFailure failure) {
            return fail(runId, current, failure.errorCode, failure.getMessage(), failure.retryable);
        } catch (RuntimeException e) {
            log.error("Run {} failed at {}", runId, current, e);
            return fail(runId, current, "INTERNAL", "Eroare internă la pasul " + current, true);
        }
    }

    /** The farm was fetched at creation; this step publishes where each block of data came from. */
    private void recordFarmData(String runId) {
        Instant started = Instant.now();
        FarmProfile profile = store.find(runId).map(Run::farmProfile).orElseThrow(() -> new RunNotFoundException(runId));
        List<DataSource> sources = profile.dataSources().stream()
                .map(source -> new DataSource(source.source(), source.mode())).toList();
        move(runId, RunStatus.DATE_FIRMA, "Am preluat datele firmei: ANAF, APIA, Open Banking, risc climatic", sources);
        String sourceMode = sources.stream().map(DataSource::mode).distinct().count() == 1 && !sources.isEmpty()
                ? sources.getFirst().mode() : "MIXED";
        store.update(runId, r -> r.withStep(new StepRecord(RunStatus.DATE_FIRMA, sourceMode, started,
                millisSince(started), null)));
    }

    /** Runs one agent with the time limit and stores its output; returns the output's source for the badge. */
    private String runAgent(String runId, AgentSlot slot) {
        Run run = move(runId, slot.status(), null, List.of());
        Agent agent = agents.get(slot);
        if (agent == null) {
            throw new StepFailure("BEDROCK_UNAVAILABLE", slot.label() + " nu este încă disponibil", false);
        }
        events.agentStarted(runId, slot, agent.modelId(), mode, 1);

        Instant started = Instant.now();
        Future<AgentResult> call = executor.submit(() -> agent.run(run, new AgentContext(runId, slot, events)));
        AgentResult result = await(call, slot);

        long durationMs = millisSince(started);
        store.update(runId, r -> r.withAgentOutput(slot, result.output())
                .withStep(new StepRecord(slot.status(), result.source(), started, durationMs, null)));
        events.agentCompleted(runId, slot, result.source(), result.iterations(), durationMs, result.output());
        return result.source();
    }

    private AgentResult await(Future<AgentResult> call, AgentSlot slot) {
        try {
            return call.get(agentTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            call.cancel(true);
            throw new StepFailure("BEDROCK_UNAVAILABLE",
                    slot.label() + " nu a răspuns în " + agentTimeout.toSeconds() + " secunde", true);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof AgentFailureException failure) {
                throw new StepFailure(failure.errorCode(), failure.getMessage(), failure.retryable());
            }
            log.error("{} failed", slot, e.getCause());
            throw new StepFailure("INTERNAL", slot.label() + " a întâmpinat o eroare internă", true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new StepFailure("INTERNAL", slot.label() + " a fost întrerupt", true);
        }
    }

    private void requireStatus(String runId, RunStatus expected, String what) {
        RunStatus actual = store.find(runId).map(Run::status).orElseThrow(() -> new RunNotFoundException(runId));
        if (actual != expected) {
            throw new IllegalStateException("Dosarul poate fi " + what + " doar din starea " + expected
                    + "; acum e în " + actual);
        }
    }

    private Run move(String runId, RunStatus to, String reasonRo, List<DataSource> dataSources) {
        RunStatus from = store.find(runId).map(Run::status).orElseThrow(() -> new RunNotFoundException(runId));
        Run moved = store.update(runId, run -> run.withStatus(to));
        events.transition(runId, from, to, Actor.SYSTEM, reasonRo, dataSources);
        return moved;
    }

    private Run fail(String runId, RunStatus failedStep, String errorCode, String messageRo, boolean retryable) {
        RunStatus from = store.find(runId).map(Run::status).orElse(failedStep);
        Run failed = store.update(runId, run -> run.failed(new RunError(errorCode, messageRo, failedStep)));
        events.transition(runId, from, RunStatus.ESUAT, Actor.SYSTEM, messageRo, List.of());
        events.runFailed(runId, failedStep, errorCode, messageRo, retryable);
        return failed;
    }

    private static List<String> missingRequiredDocuments(ModuleDefinition module, RunRequest request) {
        return module.requiredDocs().stream()
                .filter(ModuleDefinition.RequiredDoc::required)
                .map(ModuleDefinition.RequiredDoc::docType)
                .filter(type -> request.documents().stream().noneMatch(doc -> doc.docType().equals(type)))
                .toList();
    }

    private static long millisSince(Instant started) {
        return Duration.between(started, Instant.now()).toMillis();
    }

    private static long elapsedMs(long startedNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
    }

    private static final class StepFailure extends RuntimeException {

        private final String errorCode;
        private final boolean retryable;

        private StepFailure(String errorCode, String messageRo, boolean retryable) {
            super(messageRo);
            this.errorCode = errorCode;
            this.retryable = retryable;
        }
    }
}
