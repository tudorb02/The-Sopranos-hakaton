package ro.greenstruct.agro.bedrock;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentSlot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ro.greenstruct.agro.bedrock.TestKit.MAPPER;
import static ro.greenstruct.agro.bedrock.TestKit.SUBMIT;
import static ro.greenstruct.agro.bedrock.TestKit.json;

class ReplayTest {

    @TempDir
    Path dir;

    private SchemaSupport schemas;
    private TestKit.World world;
    private ExtractionReplay extractions;
    private final List<Duration> pauses = new ArrayList<>();
    private ReplayEngine engine;

    @BeforeEach
    void setUp() throws Exception {
        schemas = TestKit.demoSchemas(dir);
        world = new TestKit.World();
        extractions = new ExtractionReplay();
        engine = new ReplayEngine(MAPPER, pauses::add, extractions);
    }

    private Recording recording(String submitJson) {
        return new Recording(1, "TECHNICAL_AUDITOR", "irigatii", "model", "2026-10-28T10:00:00Z", List.of(
                Recording.Step.thought(1, "Mai întâi economia {{calc:compute/nu_exista_inca}}."),
                Recording.Step.toolCall(1, "compute", json("{\"key\":\"saving\"}"), null),
                Recording.Step.thought(2, "Economia este {{calc:compute/saving}}."),
                Recording.Step.toolCall(2, "compute", json("{\"key\":\"second\",\"basedOn\":\"{{calc:compute/saving}}\"}"),
                        null)), json(submitJson));
    }

    @Test
    void placeholdersBecomeTheCalcIdsOfTheCurrentRun() throws Exception {
        TestKit.Events events = TestKit.Events.forRun("run_replay0000a", AgentSlot.TECHNICAL_AUDITOR);
        Recording recording = recording("{\"verdict\":\"PASS\",\"savingCalcId\":\"{{calc:compute/saving}}\","
                + "\"notesRo\":[{\"text\":\"vezi\",\"calcId\":\"{{calc:compute/second}}\"}]}");

        JsonNode output = engine.replay(recording, SUBMIT, schemas, world.executor("run_replay0000a"),
                world.directory("run_replay0000a"), events.context(), Duration.ofMillis(5));

        assertThat(output.path("savingCalcId").asText()).isEqualTo(world.idOf("run_replay0000a", "saving"));
        assertThat(output.at("/notesRo/0/calcId").asText()).isEqualTo(world.idOf("run_replay0000a", "second"));
        assertThat(output.toString()).doesNotContain("{{");
        // the tools ran again, with their inputs resolved too
        assertThat(world.executed).hasSize(2);
        assertThat(world.executed.get(1)).contains(world.idOf("run_replay0000a", "saving"));
        // same events as a live run, plus pacing
        assertThat(events.types()).containsExactly("agent.thought", "agent.tool_call", "agent.tool_result",
                "agent.thought", "agent.tool_call", "agent.tool_result");
        // a thought that mentions a calc gets this run's id; one that mentions a calc not made yet is just trimmed
        assertThat(events.hub().history("run_replay0000a").get(0).message()).isEqualTo("Mai întâi economia.");
        assertThat(events.hub().history("run_replay0000a").get(3).message())
                .isEqualTo("Economia este " + world.idOf("run_replay0000a", "saving") + ".");
        assertThat(pauses).isNotEmpty().allMatch(p -> p.equals(Duration.ofMillis(5)));
    }

    @Test
    void theSameRecordingGivesDifferentCalcIdsInAnotherRun() throws Exception {
        Recording recording = recording("{\"verdict\":\"PASS\",\"savingCalcId\":\"{{calc:compute/saving}}\"}");
        TestKit.Events one = TestKit.Events.forRun("run_replay0000a", AgentSlot.TECHNICAL_AUDITOR);
        TestKit.Events two = TestKit.Events.forRun("run_replay0000b", AgentSlot.TECHNICAL_AUDITOR);

        JsonNode first = engine.replay(recording, SUBMIT, schemas, world.executor("run_replay0000a"),
                world.directory("run_replay0000a"), one.context(), Duration.ZERO);
        JsonNode second = engine.replay(recording, SUBMIT, schemas, world.executor("run_replay0000b"),
                world.directory("run_replay0000b"), two.context(), Duration.ZERO);

        assertThat(first.path("savingCalcId").asText()).isNotEqualTo(second.path("savingCalcId").asText());
        assertThat(second.path("savingCalcId").asText()).isEqualTo(world.idOf("run_replay0000b", "saving"));
        assertThat(pauses).isEmpty();
    }

    @Test
    void aMissingCalcFailsClearlyInsteadOfSendingAStaleId() {
        TestKit.Events events = TestKit.Events.forRun("run_replay0000a", AgentSlot.TECHNICAL_AUDITOR);
        Recording recording = recording("{\"verdict\":\"PASS\",\"savingCalcId\":\"{{calc:compute/never_made}}\"}");

        assertThatThrownBy(() -> engine.replay(recording, SUBMIT, schemas, world.executor("run_replay0000a"),
                world.directory("run_replay0000a"), events.context(), Duration.ZERO))
                .isInstanceOfSatisfying(AgentFailureException.class, e -> {
                    assertThat(e.errorCode()).isEqualTo("UNKNOWN_CALC_ID");
                    assertThat(e.getMessage()).contains("compute/never_made");
                });
    }

    @Test
    void theRecordedSubmitIsValidatedAgainstTheCurrentSchema() {
        TestKit.Events events = TestKit.Events.forRun("run_replay0000a", AgentSlot.TECHNICAL_AUDITOR);
        Recording recording = recording("{\"verdict\":\"NOT_A_VERDICT\",\"savingCalcId\":\"{{calc:compute/saving}}\"}");

        assertThatThrownBy(() -> engine.replay(recording, SUBMIT, schemas, world.executor("run_replay0000a"),
                world.directory("run_replay0000a"), events.context(), Duration.ZERO))
                .isInstanceOfSatisfying(AgentFailureException.class,
                        e -> assertThat(e.errorCode()).isEqualTo("AGENT_INVALID_OUTPUT"));
    }

    @Test
    void recordingTurnsCalcIdsIntoPlaceholdersAndBack() throws Exception {
        String runId = "run_record00001";
        TestKit.Events events = TestKit.Events.forRun(runId, AgentSlot.TECHNICAL_AUDITOR);
        var gateway = new TestKit.ScriptedGateway().then(
                TestKit.reply(TestKit.text("Calculez."), TestKit.use("tu_1", "compute", "{\"key\":\"saving\"}")),
                TestKit.reply(TestKit.use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\""
                        + world.idOf(runId, "saving") + "\"}")));
        ToolLoop loop = new ToolLoop(gateway, MAPPER, new ToolLoop.Settings(8, 3, Duration.ZERO, 100), d -> { });
        ToolLoop.Result live = loop.run(new ToolLoop.Request("s", "u", world.toolbox().toolsFor(AgentSlot.TECHNICAL_AUDITOR),
                SUBMIT, schemas, world.executor(runId), world.directory(runId), List.of("m"), events.context()));

        Recording recording = engine.record("TECHNICAL_AUDITOR", "irigatii", "m", live, world.directory(runId));

        assertThat(recording.submit().path("savingCalcId").asText()).isEqualTo("{{calc:compute/saving}}");
        assertThat(MAPPER.writeValueAsString(recording)).doesNotContain("calc_");
        // and it survives a trip through the golden file
        GoldenStore store = new GoldenStore(dir.resolve("golden"), MAPPER);
        Path file = store.write("irigatii", AgentSlot.TECHNICAL_AUDITOR, recording);
        assertThat(file).endsWith(Path.of("irigatii", "technical_auditor.json"));
        Recording loaded = store.find("irigatii", AgentSlot.TECHNICAL_AUDITOR).orElseThrow();
        TestKit.Events other = TestKit.Events.forRun("run_other000001", AgentSlot.TECHNICAL_AUDITOR);
        JsonNode replayed = engine.replay(loaded, SUBMIT, schemas, world.executor("run_other000001"),
                world.directory("run_other000001"), other.context(), Duration.ZERO);
        assertThat(replayed.path("savingCalcId").asText()).isEqualTo(world.idOf("run_other000001", "saving"));
    }

    @Test
    void recordedDocumentReadingsAreHandedToTheExtractorBeforeTheToolRuns() throws Exception {
        TestKit.Events events = TestKit.Events.forRun("run_replay0000a", AgentSlot.TECHNICAL_AUDITOR);
        JsonNode reading = json("{\"documentId\":\"doc_offer_1\",\"currency\":\"EUR\"}");
        Recording recording = new Recording(1, "TECHNICAL_AUDITOR", "irigatii", "m", "x", List.of(
                Recording.Step.toolCall(1, "compute", json("{\"key\":\"saving\"}"), reading)),
                json("{\"verdict\":\"PASS\",\"savingCalcId\":\"{{calc:compute/saving}}\"}"));
        List<JsonNode> seen = new ArrayList<>();

        engine.replay(recording, SUBMIT, schemas, (tool, input) -> {
            extractions.take("doc_offer_1").ifPresent(seen::add);
            return world.executor("run_replay0000a").execute(tool, input);
        }, world.directory("run_replay0000a"), events.context(), Duration.ZERO);

        assertThat(seen).containsExactly(reading);
        assertThat(extractions.take("doc_offer_1")).isEmpty();
    }

    @Test
    void goldenFilesAreRejectedWhenTheScenarioNameIsNotSafe() {
        GoldenStore store = new GoldenStore(dir, MAPPER);

        assertThatThrownBy(() -> store.find("../etc", AgentSlot.TECHNICAL_AUDITOR))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(store.find("irigatii", AgentSlot.TECHNICAL_AUDITOR)).isEmpty();
        assertThat(Files.exists(dir.resolve("irigatii"))).isFalse();
    }
}
