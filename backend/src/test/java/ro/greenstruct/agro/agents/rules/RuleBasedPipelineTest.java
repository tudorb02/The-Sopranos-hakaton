package ro.greenstruct.agro.agents.rules;

import java.time.Duration;
import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunOrchestrator;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {"greenstruct.agent-runtime.enabled=true", "greenstruct.analysis-date=2026-10-28"})
class RuleBasedPipelineTest {

    @Autowired
    RunOrchestrator orchestrator;
    @Autowired
    DemoScenarioService scenarios;
    @Autowired
    RunStore store;
    @Autowired
    ObjectMapper mapper;

    Run runScenario(String id) throws Exception {
        String runId = orchestrator.start(scenarios.load(id)).run().id();
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (Instant.now().isBefore(deadline)) {
            Run run = store.find(runId).orElseThrow();
            if (run.status() == RunStatus.GATA || run.status() == RunStatus.ESUAT) {
                return run;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("timeout");
    }

    @Test
    void irrigationRunsEndToEnd() throws Exception {
        Run run = runScenario("irigatii");
        System.out.println("STATUS " + run.status() + " " + run.error());
        for (AgentSlot slot : AgentSlot.values()) {
            JsonNode out = run.agentOutputs().get(slot);
            System.out.println(slot + " => " + (out == null ? null : mapper.writerWithDefaultPrettyPrinter().writeValueAsString(out)));
        }
        assertThat(run.status()).isEqualTo(RunStatus.GATA);
    }

    /**
     * README §6 category 3 on the Product farm: the requested 300 CP tractor reaches 12.8% (threshold 20%), with the
     * GPS RTK 20.7% (≥ 20% but below 20% × 1.5 = 30%), so the tier is the one of an accepted upgrade.
     */
    @Test
    void machineryRunsEndToEnd() throws Exception {
        Run run = runScenario("utilaje");

        assertThat(run.status()).as(String.valueOf(run.error())).isEqualTo(RunStatus.GATA);
        assertThat(run.agentOutputs().keySet()).containsExactlyInAnyOrder(AgentSlot.values());
        JsonNode technical = run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        assertThat(technical.path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertThat(technical.path("recommendedConfigId").asText()).isEqualTo("cfg_recommended");
        assertThat(technical.path("configurations")).extracting(c -> c.path("thresholdResult").asText())
                .containsExactly("FAIL", "PASS");
        assertThat(technical.path("sizingCheck").path("status").asText()).isEqualTo("PASS");
        assertThat(technical.path("dnshChecks")).extracting(c -> c.path("objective").asText() + "/"
                + c.path("status").asText()).contains("POLLUTION_PREVENTION/PASS",
                "WATER_MARINE_RESOURCES/PASS_WITH_CONDITIONS");
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        assertThat(funding.path("greenTier").path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        assertThat(funding.path("options")).extracting(o -> o.path("optionId").asText())
                .containsExactly("A", "B", "C");
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        assertThat(report.path("moduleId").asText()).isEqualTo("utilaje");
        assertThat(report.path("fund").path("fundId").asText()).isEqualTo("F1");
    }
}
