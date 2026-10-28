package ro.greenstruct.agro.bedrock;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ro.greenstruct.agro.bedrock.BedrockCallException.Kind;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolResult;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.events.RunEvent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static ro.greenstruct.agro.bedrock.TestKit.MAPPER;
import static ro.greenstruct.agro.bedrock.TestKit.SUBMIT;
import static ro.greenstruct.agro.bedrock.TestKit.reply;
import static ro.greenstruct.agro.bedrock.TestKit.text;
import static ro.greenstruct.agro.bedrock.TestKit.use;

class ToolLoopTest {

    private static final String RUN = "run_loop00000001";

    @TempDir
    Path dir;

    private SchemaSupport schemas;
    private TestKit.World world;
    private TestKit.Events events;
    private final List<Duration> sleeps = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        schemas = TestKit.demoSchemas(dir);
        world = new TestKit.World();
        events = TestKit.Events.forRun(RUN, AgentSlot.TECHNICAL_AUDITOR);
    }

    private ToolLoop loop(TestKit.ScriptedGateway gateway, int maxIterations) {
        return new ToolLoop(gateway, MAPPER, new ToolLoop.Settings(maxIterations, 3, Duration.ofMillis(100), 1000),
                sleeps::add);
    }

    private ToolLoop.Request request(String... models) {
        return new ToolLoop.Request("system", "dosar", world.toolbox().toolsFor(AgentSlot.TECHNICAL_AUDITOR), SUBMIT,
                schemas, world.executor(RUN), world.directory(RUN), List.of(models), events.context());
    }

    @Test
    void runsToolsThenEndsWhenTheModelSubmitsAValidResult() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(text("Calculez economia."), use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.output().path("verdict").asText()).isEqualTo("PASS");
        assertThat(result.iterations()).isEqualTo(2);
        assertThat(result.source()).isEqualTo("LIVE");
        assertThat(result.steps()).extracting(Recording.Step::type).containsExactly("thought", "tool_call");
        assertThat(events.types()).containsExactly("agent.thought", "agent.tool_call", "agent.tool_result");

        // the tool list sent to the model = the toolbox tools + the submit tool, with a flat schema
        var tools = gateway.requests.getFirst().tools();
        assertThat(tools).extracting(BedrockGateway.ToolSpec::name).containsExactly("compute", SUBMIT);
        assertThat(tools.getLast().inputSchema().toString()).doesNotContain("$ref", "$defs", "$schema", "$id");

        // the tool result goes back to the model with the calcId
        var second = gateway.requests.get(1).messages().getLast().blocks();
        ToolResult toolResult = (ToolResult) second.getFirst();
        assertThat(toolResult.toolUseId()).isEqualTo("tu_1");
        assertThat(toolResult.content().path("calcs").get(0).path("calcId").asText()).isEqualTo(saving);
    }

    @Test
    void emitsEventsThatMatchTheEventContract() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(text("Verific."), use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        loop(gateway, 8).run(request("sonnet"));

        // event.json restricts "tool" to the real tool names, so check the shape of what we can: envelope + data keys
        RunEvent call = events.hub().history(RUN).get(1);
        JsonNode data = call.data();
        assertThat(data.fieldNames()).toIterable().containsExactlyInAnyOrder("toolUseId", "tool", "iteration", "input");
        RunEvent result = events.hub().history(RUN).get(2);
        assertThat(result.data().path("status").asText()).isEqualTo("OK");
        assertThat(result.data().path("calcs").get(0).path("calcId").asText()).isEqualTo(saving);
    }

    @Test
    void sendsSchemaErrorsBackAndAcceptsTheCorrection() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"MAYBE\",\"extra\":1}")),
                reply(use("tu_3", SUBMIT, "{\"verdict\":\"FAIL\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.output().path("verdict").asText()).isEqualTo("FAIL");
        assertThat(result.iterations()).isEqualTo(3);
        ToolResult rejected = (ToolResult) gateway.requests.get(2).messages().getLast().blocks().getFirst();
        assertThat(rejected.error()).isTrue();
        assertThat(rejected.content().path("errors")).isNotEmpty();
        assertThat(rejected.content().toString()).contains("savingCalcId");
        // the rejection shows in the timeline as a failed tool_result without a tool_call before it
        List<RunEvent> history = events.hub().history(RUN);
        RunEvent error = history.get(history.size() - 1);
        assertThat(error.type().wireName()).isEqualTo("agent.tool_result");
        assertThat(error.data().path("status").asText()).isEqualTo("ERROR");
        assertThat(error.data().path("tool").asText()).isEqualTo(SUBMIT);
        assertThat(error.data().path("result").path("errors")).isNotEmpty();
    }

    @Test
    void rejectsACalcIdThatNoToolProduced() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"calc_deadbeef0000\"}")),
                reply(use("tu_2", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_3", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.iterations()).isEqualTo(3);
        ToolResult rejected = (ToolResult) gateway.requests.get(1).messages().getLast().blocks().getFirst();
        assertThat(rejected.content().toString()).contains("calc_deadbeef0000");
    }

    @Test
    void failsAfterTheIterationLimit() {
        var gateway = new TestKit.ScriptedGateway();
        for (int i = 0; i < 5; i++) {
            gateway.then(reply(use("tu_" + i, "compute", "{\"key\":\"k" + i + "\"}")));
        }

        assertThatThrownBy(() -> loop(gateway, 3).run(request("sonnet")))
                .isInstanceOfSatisfying(AgentFailureException.class,
                        e -> assertThat(e.errorCode()).isEqualTo("AGENT_MAX_ITERATIONS"));
        assertThat(gateway.requests).hasSize(3);
    }

    @Test
    void nudgesTheModelThatAnswersWithoutATool() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(text("Gata, cred.")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.iterations()).isEqualTo(3);
        var nudge = gateway.requests.get(2).messages().getLast().blocks().getFirst();
        assertThat(nudge).isInstanceOf(BedrockGateway.Text.class);
    }

    @Test
    void retriesWithBackoffAndReportsTheRetryBadge() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                TestKit.failure(Kind.THROTTLED), TestKit.failure(Kind.TIMEOUT),
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.source()).isEqualTo("RETRY");
        assertThat(sleeps).containsExactly(Duration.ofMillis(100), Duration.ofMillis(200));
        List<RunEvent> degraded = events.hub().history(RUN).stream()
                .filter(e -> e.type().wireName().equals("agent.degraded")).toList();
        assertThat(degraded).hasSize(2);
        assertThat(degraded.get(0).data().path("level").asText()).isEqualTo("RETRY");
        assertThat(degraded.get(0).data().path("reason").asText()).isEqualTo("THROTTLED");
        assertThat(degraded.get(1).data().path("reason").asText()).isEqualTo("TIMEOUT");
        assertThat(degraded.get(1).data().path("attempt").asInt()).isEqualTo(3);
    }

    @Test
    void switchesToTheSecondModelWhenTheFirstKeepsFailing() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                TestKit.failure(Kind.THROTTLED), TestKit.failure(Kind.THROTTLED), TestKit.failure(Kind.THROTTLED),
                reply(use("tu_1", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_2", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet", "haiku"));

        assertThat(result.source()).isEqualTo("FALLBACK_MODEL");
        assertThat(result.modelId()).isEqualTo("haiku");
        assertThat(gateway.requests).extracting(BedrockGateway.Request::modelId)
                .containsExactly("sonnet", "sonnet", "sonnet", "haiku", "haiku");
        assertThat(events.hub().history(RUN)).anySatisfy(e ->
                assertThat(e.data().path("level").asText()).isEqualTo("FALLBACK_MODEL"));
    }

    @Test
    void doesNotRetryARejectedRequestAndFailsWhenNoModelIsLeft() {
        var gateway = new TestKit.ScriptedGateway().then(TestKit.failure(Kind.REJECTED));

        assertThatThrownBy(() -> loop(gateway, 8).run(request("sonnet")))
                .isInstanceOfSatisfying(AgentFailureException.class, e -> {
                    assertThat(e.errorCode()).isEqualTo("BEDROCK_UNAVAILABLE");
                    assertThat(e.retryable()).isTrue();
                });
        assertThat(gateway.requests).hasSize(1);
        assertThat(sleeps).isEmpty();
    }

    @Test
    void failsWithBedrockUnavailableWhenAllModelsAreExhausted() {
        var gateway = new TestKit.ScriptedGateway();
        for (int i = 0; i < 6; i++) {
            gateway.then(TestKit.failure(Kind.NO_NETWORK));
        }

        assertThatThrownBy(() -> loop(gateway, 8).run(request("sonnet", "haiku")))
                .isInstanceOfSatisfying(AgentFailureException.class,
                        e -> assertThat(e.errorCode()).isEqualTo("BEDROCK_UNAVAILABLE"));
        assertThat(gateway.requests).hasSize(6);
    }

    @Test
    void anUnknownToolBecomesAnErrorResultNotACrash() throws Exception {
        String saving = world.idOf(RUN, "saving");
        var gateway = new TestKit.ScriptedGateway().then(
                reply(use("tu_1", "does_not_exist", "{}"), use("tu_2", "compute", "{\"key\":\"saving\"}")),
                reply(use("tu_3", SUBMIT, "{\"verdict\":\"PASS\",\"savingCalcId\":\"" + saving + "\"}")));

        ToolLoop.Result result = loop(gateway, 8).run(request("sonnet"));

        assertThat(result.iterations()).isEqualTo(2);
        var results = gateway.requests.get(1).messages().getLast().blocks();
        assertThat(results).hasSize(2);
        assertThat(((ToolResult) results.get(0)).error()).isTrue();
        assertThat(((ToolResult) results.get(1)).error()).isFalse();
    }
}
