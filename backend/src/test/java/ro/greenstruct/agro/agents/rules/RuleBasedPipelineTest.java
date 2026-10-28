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
@org.junit.jupiter.api.Disabled("needs the README demo data (documents, extractions) first")
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
}
