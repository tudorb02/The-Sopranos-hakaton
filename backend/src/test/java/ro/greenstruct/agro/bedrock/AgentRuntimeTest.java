package ro.greenstruct.agro.bedrock;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ro.greenstruct.agro.bedrock.TestKit.MAPPER;
import static ro.greenstruct.agro.bedrock.TestKit.json;
import static ro.greenstruct.agro.bedrock.TestKit.reply;
import static ro.greenstruct.agro.bedrock.TestKit.use;

/** Mode selection (LIVE / HYBRID / REPLAY, with and without credentials) and the fallback cascade. */
class AgentRuntimeTest {

    private static final AgentSlot SLOT = AgentSlot.TECHNICAL_AUDITOR;

    @TempDir
    Path dir;

    private TestKit.World world;
    private SchemaSupport schemas;
    private GoldenStore golden;
    private RunCache cache;

    @BeforeEach
    void setUp() throws Exception {
        world = new TestKit.World();
        schemas = TestKit.demoSchemas(dir);
        // the runtime validates against the schema of the slot's submit tool: give it the demo schema
        Files.writeString(dir.resolve(SLOT.submitTool() + ".json"), TestKit.DEMO_SCHEMA);
        golden = new GoldenStore(dir.resolve("golden"), MAPPER);
        cache = new RunCache();
    }

    // ---- mode selection

    @Test
    void withoutCredentialsEveryConfiguredModeBehavesAsReplay() {
        assertThat(new AgentModes("LIVE", false).effective()).isEqualTo(AgentModes.Mode.REPLAY);
        assertThat(new AgentModes("HYBRID", false).effective()).isEqualTo(AgentModes.Mode.REPLAY);
        assertThat(new AgentModes("REPLAY", false).effective()).isEqualTo(AgentModes.Mode.REPLAY);
    }

    @Test
    void withCredentialsTheConfiguredModeApplies() {
        assertThat(new AgentModes("LIVE", true).effective()).isEqualTo(AgentModes.Mode.LIVE);
        assertThat(new AgentModes("HYBRID", true).effective()).isEqualTo(AgentModes.Mode.HYBRID);
        assertThat(new AgentModes("REPLAY", true).effective()).isEqualTo(AgentModes.Mode.REPLAY);
    }

    // ---- REPLAY

    @Test
    void replayModePlaysTheGoldenRunWithoutTouchingBedrock() throws Exception {
        writeGolden("irigatii");
        AgentRuntime runtime = runtime("HYBRID", null, false);   // HYBRID but no gateway = REPLAY
        Run run = TestKit.run("run_golden00001", "irigatii");
        TestKit.Events events = TestKit.Events.forRun(run.id(), SLOT);

        AgentResult result = runtime.execute(run, events.context(), SLOT);

        assertThat(runtime.mode()).isEqualTo(AgentModes.Mode.REPLAY);
        assertThat(result.source()).isEqualTo("GOLDEN");
        assertThat(result.output().path("savingCalcId").asText()).isEqualTo(world.idOf(run.id(), "saving"));
        assertThat(events.types()).contains("agent.tool_call", "agent.tool_result");
        assertThat(events.types()).doesNotContain("agent.degraded");
    }

    @Test
    void replayWithoutAGoldenFileFailsWithAClearMessage() {
        AgentRuntime runtime = runtime("REPLAY", null, false);
        Run run = TestKit.run("run_golden00002", "irigatii");

        assertThatThrownBy(() -> runtime.execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT))
                .isInstanceOfSatisfying(AgentFailureException.class, e -> {
                    assertThat(e.errorCode()).isEqualTo("BEDROCK_UNAVAILABLE");
                    assertThat(e.getMessage()).contains("irigatii");
                });
    }

    @Test
    void aNonDemoDossierUsesTheRecordingOfItsModule() throws Exception {
        writeGolden("irigatii");   // the request's module is irigatii
        AgentRuntime runtime = runtime("REPLAY", null, false);
        Run run = TestKit.run("run_golden00003", null);

        AgentResult result = runtime.execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT);

        assertThat(result.source()).isEqualTo("GOLDEN");
    }

    // ---- LIVE and HYBRID

    @Test
    void liveModeSurfacesTheFailureAndNeverUsesTheGolden() throws Exception {
        writeGolden("irigatii");
        var gateway = new TestKit.ScriptedGateway();
        for (int i = 0; i < 3; i++) {
            gateway.then(TestKit.failure(BedrockCallException.Kind.TIMEOUT));
        }
        AgentRuntime runtime = runtime("LIVE", gateway, false);
        Run run = TestKit.run("run_live0000001", "irigatii");

        assertThatThrownBy(() -> runtime.execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT))
                .isInstanceOfSatisfying(AgentFailureException.class,
                        e -> assertThat(e.errorCode()).isEqualTo("BEDROCK_UNAVAILABLE"));
    }

    @Test
    void hybridFallsBackToTheGoldenRunAndSaysSo() throws Exception {
        writeGolden("irigatii");
        var gateway = new TestKit.ScriptedGateway();
        for (int i = 0; i < 3; i++) {
            gateway.then(TestKit.failure(BedrockCallException.Kind.NO_NETWORK));
        }
        AgentRuntime runtime = runtime("HYBRID", gateway, false);
        Run run = TestKit.run("run_hybrid00001", "irigatii");
        TestKit.Events events = TestKit.Events.forRun(run.id(), SLOT);

        AgentResult result = runtime.execute(run, events.context(), SLOT);

        assertThat(result.source()).isEqualTo("GOLDEN");
        assertThat(result.output().path("savingCalcId").asText()).isEqualTo(world.idOf(run.id(), "saving"));
        var degraded = events.hub().history(run.id()).stream()
                .filter(e -> e.type().wireName().equals("agent.degraded")).toList();
        assertThat(degraded.getLast().data().path("level").asText()).isEqualTo("GOLDEN");
        assertThat(degraded.getLast().data().path("reason").asText()).isEqualTo("UNAVAILABLE");
    }

    @Test
    void hybridPrefersTheCacheOfAnEarlierLiveRunOnTheSameDocuments() throws Exception {
        Run first = TestKit.run("run_cache000001", null);
        var live = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SLOT.submitTool(),"{\"verdict\":\"PASS\",\"savingCalcId\":\"" + world.idOf(first.id(), "saving") + "\"}")));
        AgentResult liveResult = runtime("HYBRID", live, false)
                .execute(first, TestKit.Events.forRun(first.id(), SLOT).context(), SLOT);
        assertThat(liveResult.source()).isEqualTo("LIVE");

        // Bedrock is now down; the golden would also be available, but the cache comes first
        writeGolden("irigatii");
        var down = new TestKit.ScriptedGateway();
        for (int i = 0; i < 3; i++) {
            down.then(TestKit.failure(BedrockCallException.Kind.THROTTLED));
        }
        Run second = TestKit.run("run_cache000002", null);
        TestKit.Events events = TestKit.Events.forRun(second.id(), SLOT);
        AgentResult cached = runtimeSharing("HYBRID", down, false).execute(second, events.context(), SLOT);

        assertThat(cached.source()).isEqualTo("CACHE");
        assertThat(cached.output().path("savingCalcId").asText()).isEqualTo(world.idOf(second.id(), "saving"));
        assertThat(events.hub().history(second.id()).stream().map(e -> e.data().path("level").asText()))
                .contains("CACHE");
    }

    @Test
    void hybridWithNothingToFallBackOnReportsTheOriginalFailure() {
        var gateway = new TestKit.ScriptedGateway();
        for (int i = 0; i < 3; i++) {
            gateway.then(TestKit.failure(BedrockCallException.Kind.TIMEOUT));
        }
        AgentRuntime runtime = runtime("HYBRID", gateway, false);
        Run run = TestKit.run("run_hybrid00002", "irigatii");

        assertThatThrownBy(() -> runtime.execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT))
                .isInstanceOfSatisfying(AgentFailureException.class,
                        e -> assertThat(e.errorCode()).isEqualTo("BEDROCK_UNAVAILABLE"));
    }

    // ---- recorder

    @Test
    void aLiveRunOfADemoScenarioIsRecordedWhenRecordGoldenIsOn() throws Exception {
        Run run = TestKit.run("run_record00002", "irigatii");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SLOT.submitTool(),"{\"verdict\":\"PASS\",\"savingCalcId\":\"" + world.idOf(run.id(), "saving") + "\"}")));

        runtime("LIVE", gateway, true).execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT);

        Recording saved = golden.find("irigatii", SLOT).orElseThrow();
        assertThat(saved.submit().path("savingCalcId").asText()).isEqualTo("{{calc:compute/saving}}");
        assertThat(saved.steps()).extracting(Recording.Step::tool).containsExactly("compute");
    }

    @Test
    void nothingIsRecordedWhenTheSettingIsOffOrTheDossierIsNotADemo() throws Exception {
        for (boolean record : new boolean[] {false, true}) {
            String scenario = record ? null : "irigatii";
            Run run = TestKit.run("run_record0000" + (record ? 3 : 4), scenario);
            var gateway = new TestKit.ScriptedGateway().then(
                    reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                    reply(use("tu_2", SLOT.submitTool(),"{\"verdict\":\"PASS\",\"savingCalcId\":\"" + world.idOf(run.id(), "saving") + "\"}")));
            runtime("LIVE", gateway, record).execute(run, TestKit.Events.forRun(run.id(), SLOT).context(), SLOT);
        }

        assertThat(Files.exists(dir.resolve("golden"))).isFalse();
    }

    // ---- helpers

    private void writeGolden(String scenario) {
        Recording recording = new Recording(1, SLOT.name(), scenario, "m", "2026-10-28T10:00:00Z", List.of(
                Recording.Step.thought(1, "Calculez."),
                Recording.Step.toolCall(1, "compute", json("{\"key\":\"saving\"}"), null)),
                json("{\"verdict\":\"PASS\",\"savingCalcId\":\"{{calc:compute/saving}}\"}"));
        golden.write(scenario, SLOT, recording);
    }

    private AgentRuntime runtime(String configuredMode, BedrockGateway gateway, boolean recordGolden) {
        cache = new RunCache();
        return runtimeSharing(configuredMode, gateway, recordGolden);
    }

    /** Same cache as the previous runtime: stands for one running application. */
    private AgentRuntime runtimeSharing(String configuredMode, BedrockGateway gateway, boolean recordGolden) {
        return new AgentRuntime(new AgentRuntime.Setup(new AgentModes(configuredMode, gateway != null), gateway,
                List.of("sonnet"), world.toolbox(), schemas, golden, cache,
                new ReplayEngine(MAPPER, d -> { }, new ExtractionReplay()),
                new ToolLoop.Settings(8, 3, Duration.ZERO, 100), d -> { }, Duration.ZERO, recordGolden,
                new RunContextBuilder(MAPPER), slot -> "prompt", MAPPER));
    }
}
