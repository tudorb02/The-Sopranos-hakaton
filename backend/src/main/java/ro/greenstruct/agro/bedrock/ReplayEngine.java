package ro.greenstruct.agro.bedrock;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.tools.ToolOutput;

/**
 * Plays back what an agent decided in an earlier run (README section 11, plan B). The decisions come from the
 * recording; the numbers do not: every recorded tool call runs again through the tools against the current
 * engine, and {{calc:tool/key}} placeholders resolve to the calcIds of this run. Events and pacing look like
 * a live run.
 */
public class ReplayEngine {

    private final ObjectMapper mapper;
    private final ToolEvents events;
    private final ToolLoop.Sleeper sleeper;
    private final ExtractionReplay extractions;

    public ReplayEngine(ObjectMapper mapper, ToolLoop.Sleeper sleeper, ExtractionReplay extractions) {
        this.mapper = mapper;
        this.events = new ToolEvents(mapper);
        this.sleeper = sleeper;
        this.extractions = extractions;
    }

    /** Returns the submit input with this run's calcIds, validated against the schema. */
    public JsonNode replay(Recording recording, String submitTool, SchemaSupport schemas, ToolExecutor executor,
                           CalcDirectory calcs, AgentContext context, Duration delay) throws InterruptedException {
        for (Recording.Step step : recording.steps()) {
            pause(delay);
            if ("thought".equals(step.type())) {
                context.thought(resolve(step.text(), calcs), step.iteration());
            } else if ("tool_call".equals(step.type())) {
                JsonNode input = substitute(step.input(), calcs, step.tool());
                String toolUseId = ToolEvents.newToolUseId();
                if (step.extraction() != null) {
                    extractions.offer(step.extraction().path("documentId").asText(), step.extraction());
                }
                // the call is announced first, then the engine runs: same order and pacing as a live run
                // a tool error here is shown in the timeline; whether it matters is decided by the submit check below
                events.run(context, executor, toolUseId, step.tool(), step.iteration(), input);
                pause(delay);
            }
        }
        JsonNode submit = substitute(recording.submit(), calcs, submitTool);
        List<SchemaSupport.Issue> issues = new ArrayList<>(schemas.validate(submitTool, submit));
        for (String calcId : CalcPlaceholders.calcIds(submit)) {
            if (!calcs.exists(calcId)) {
                issues.add(new SchemaSupport.Issue("/", "calcId necunoscut: " + calcId));
            }
        }
        if (!issues.isEmpty()) {
            throw new AgentFailureException("AGENT_INVALID_OUTPUT",
                    "Rularea înregistrată nu mai respectă schema: " + issues.getFirst().messageRo(), false, null);
        }
        return submit;
    }

    public Recording record(String slot, String scenario, String modelId, ToolLoop.Result result,
                            CalcDirectory calcs) {
        List<Recording.Step> steps = result.steps().stream().map(step -> new Recording.Step(step.type(),
                step.iteration(),
                step.text() == null ? null : CalcPlaceholders.toPlaceholders(mapper.getNodeFactory().textNode(step.text()), calcs).asText(),
                step.tool(), CalcPlaceholders.toPlaceholders(step.input(), calcs), step.extraction())).toList();
        return new Recording(Recording.VERSION, slot, scenario, modelId, Instant.now().toString(), steps,
                CalcPlaceholders.toPlaceholders(result.output(), calcs));
    }

    /** A thought is only commentary: a reference that does not resolve is dropped instead of failing the replay. */
    private String resolve(String text, CalcDirectory calcs) {
        try {
            return CalcPlaceholders.substitute(mapper.getNodeFactory().textNode(text), calcs).asText();
        } catch (CalcPlaceholders.UnresolvedCalcException e) {
            return text.replaceAll("\\s*\\{\\{calc:[^}]+}}", "");
        }
    }

    private static JsonNode substitute(JsonNode node, CalcDirectory calcs, String where) {
        try {
            return CalcPlaceholders.substitute(node, calcs);
        } catch (CalcPlaceholders.UnresolvedCalcException e) {
            throw new AgentFailureException("UNKNOWN_CALC_ID", "Rularea înregistrată referă un calcul care nu mai "
                    + "există (" + e.name() + ", la " + where + "); înregistrează din nou rularea.", false, e);
        }
    }

    private void pause(Duration delay) throws InterruptedException {
        if (!delay.isZero() && !delay.isNegative()) {
            sleeper.sleep(delay);
        }
    }
}
