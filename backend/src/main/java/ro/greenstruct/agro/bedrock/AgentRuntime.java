package ro.greenstruct.agro.bedrock;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

/**
 * Runs one agent according to the mode (README section 11, plan B):
 * LIVE = Bedrock only; HYBRID = Bedrock, then cache, then golden when it fails; REPLAY = golden only.
 * Successful live runs feed the cache and, with greenstruct.record-golden, the golden files.
 */
public class AgentRuntime {

    private static final Logger log = LoggerFactory.getLogger(AgentRuntime.class);

    /** Everything the runtime needs, grouped so tests can build it without Spring. */
    public record Setup(AgentModes modes, BedrockGateway gateway, List<String> models, AgentToolbox toolbox,
                        SchemaSupport schemas, GoldenStore golden, RunCache cache, ReplayEngine replay,
                        ToolLoop.Settings loopSettings, ToolLoop.Sleeper sleeper, Duration replayDelay,
                        boolean recordGolden, RunContextBuilder contextBuilder, Function<AgentSlot, String> prompts,
                        com.fasterxml.jackson.databind.ObjectMapper mapper) {
    }

    private final Setup setup;
    private RuleFallback ruleFallback;

    public AgentRuntime(Setup setup) {
        this.setup = setup;
    }

    /** The last level of the plan B; without it a missing recording fails the agent. */
    public void setRuleFallback(RuleFallback fallback) {
        this.ruleFallback = fallback;
    }

    public AgentModes.Mode mode() {
        return setup.modes().effective();
    }

    /** First model id (for the agent.started event); "replay" when no model will be called. */
    public String modelId() {
        return mode() == AgentModes.Mode.REPLAY ? "replay (rulare înregistrată)" : setup.models().getFirst();
    }

    public AgentResult execute(Run run, AgentContext context, AgentSlot slot) throws Exception {
        return switch (mode()) {
            case REPLAY -> replayGolden(run, context, slot);
            case LIVE -> live(run, context, slot);
            case HYBRID -> hybrid(run, context, slot);
        };
    }

    // ---- LIVE

    private AgentResult live(Run run, AgentContext context, AgentSlot slot) throws Exception {
        ToolLoop loop = new ToolLoop(setup.gateway(), setup.mapper(), setup.loopSettings(), setup.sleeper());
        CalcDirectory calcs = setup.toolbox().calcsFor(run.id());
        ToolLoop.Result result = loop.run(new ToolLoop.Request(setup.prompts().apply(slot),
                setup.contextBuilder().userMessage(run, slot), setup.toolbox().toolsFor(slot), slot.submitTool(),
                setup.schemas(), setup.toolbox().executorFor(run.id()), calcs, setup.models(), context));

        try {
            Recording recording = setup.replay().record(slot.name(), scenarioOf(run), result.modelId(), result, calcs);
            setup.cache().put(RunCache.key(slot, run), recording);
            if (setup.recordGolden() && run.request().demoScenario() != null) {
                log.info("Recorded golden run: {}", setup.golden().write(run.request().demoScenario(), slot, recording));
            }
        } catch (RuntimeException e) {
            log.warn("Could not store the {} run for cache/golden: {}", slot, e.getMessage());
        }
        return new AgentResult(result.output(), result.source(), result.iterations());
    }

    // ---- HYBRID

    private AgentResult hybrid(Run run, AgentContext context, AgentSlot slot) throws Exception {
        RuntimeException failure;
        try {
            return live(run, context, slot);
        } catch (RuntimeException e) {
            failure = e;
            log.warn("Live {} failed, looking for cache/golden: {}", slot, e.getMessage());
        }
        String reason = reasonOf(failure);
        List<String> notes = new ArrayList<>();

        Optional<Recording> cached = setup.cache().find(RunCache.key(slot, run));
        if (cached.isPresent()) {
            context.degraded("CACHE", reason, 1, "Folosesc rezultatul salvat de la o rulare anterioară cu aceleași documente.");
            try {
                return play(cached.get(), "CACHE", run, context, slot);
            } catch (AgentFailureException e) {
                notes.add("cache: " + e.getMessage());
            }
        }
        Optional<Recording> golden = goldenFor(run, slot);
        if (golden.isPresent()) {
            context.degraded("GOLDEN", reason, 1, "Redau rularea înregistrată pentru acest scenariu.");
            return play(golden.get(), "GOLDEN", run, context, slot);
        }
        if (ruleFallback != null) {
            context.degraded("GOLDEN", reason, 1, "Nu există o rulare salvată; aplic regulile fixe, cu cifrele recalculate.");
            return ruleFallback.run(run, context, slot);
        }
        if (failure instanceof AgentFailureException agentFailure && notes.isEmpty()) {
            throw agentFailure;
        }
        throw new AgentFailureException("BEDROCK_UNAVAILABLE",
                "Bedrock nu răspunde și nu există o rulare salvată pentru aceste documente. Reîncearcă sau pornește "
                        + "dosarul demo.", true, failure);
    }

    // ---- REPLAY

    private AgentResult replayGolden(Run run, AgentContext context, AgentSlot slot) throws Exception {
        if (goldenFor(run, slot).isEmpty() && ruleFallback != null) {
            return ruleFallback.run(run, context, slot);
        }
        Recording recording = goldenFor(run, slot).orElseThrow(() -> new AgentFailureException("BEDROCK_UNAVAILABLE",
                "Nu există o rulare înregistrată pentru scenariul " + scenarioOf(run) + " (" + slot.label()
                        + ") și Bedrock nu e configurat.", false, null));
        return play(recording, "GOLDEN", run, context, slot);
    }

    private AgentResult play(Recording recording, String source, Run run, AgentContext context, AgentSlot slot)
            throws Exception {
        JsonNode output = setup.replay().replay(recording, slot.submitTool(), setup.schemas(),
                setup.toolbox().executorFor(run.id()), setup.toolbox().calcsFor(run.id()), context,
                setup.replayDelay());
        int iterations = recording.steps().stream().mapToInt(Recording.Step::iteration).max().orElse(0) + 1;
        return new AgentResult(output, source, iterations);
    }

    private Optional<Recording> goldenFor(Run run, AgentSlot slot) {
        return setup.golden().find(scenarioOf(run), slot);
    }

    /** Demo dossiers use their scenario; other dossiers fall back to the recording of their module. */
    static String scenarioOf(Run run) {
        return run.request().demoScenario() != null ? run.request().demoScenario() : run.request().moduleId();
    }

    private static String reasonOf(RuntimeException failure) {
        if (failure instanceof AgentFailureException agent) {
            return switch (agent.errorCode()) {
                case "AGENT_INVALID_OUTPUT" -> "INVALID_OUTPUT";
                case "AGENT_MAX_ITERATIONS" -> "MAX_ITERATIONS";
                default -> "UNAVAILABLE";
            };
        }
        return "UNAVAILABLE";
    }
}
