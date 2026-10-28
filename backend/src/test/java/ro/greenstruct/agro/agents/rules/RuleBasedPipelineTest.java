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
import ro.greenstruct.agro.orchestration.MonitoringService;
import ro.greenstruct.agro.orchestration.PortfolioService;
import ro.greenstruct.agro.orchestration.ReportService;
import ro.greenstruct.agro.orchestration.Submission;
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

    @Autowired
    MonitoringService monitoring;
    @Autowired
    ReportService reports;
    @Autowired
    PortfolioService portfolio;

    @Test
    void irrigationRunsEndToEndFromTheOfferToThePortfolio() throws Exception {
        Run run = runScenario("irigatii");

        assertThat(run.status()).isEqualTo(RunStatus.GATA);
        assertThat(run.agentOutputs()).containsOnlyKeys(AgentSlot.values());
        JsonNode technical = run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        // README §12: sprinkler 20% fails, drip + sensors 40% passes as Verde Plus
        assertThat(technical.path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertThat(funding.path("greenTier").path("tier").asText()).isEqualTo("VERDE_PLUS");
        assertThat(funding.path("recommendedOptionId").asText()).isEqualTo("B");
        assertThat(report.path("fund").path("fundId").asText()).isEqualTo("F1");

        orchestrator.submit(run.id(), Submission.Variant.VERDE);
        orchestrator.approve(run.id(), "ofiter.demo", "Aprobat");
        byte[] pdf = reports.build(store.find(run.id()).orElseThrow());
        assertThat(new String(pdf, 0, 5, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(pdf.length).isGreaterThan(5_000);

        var before = portfolio.portfolio().portfolio();
        assertThat(before.loanCount()).isGreaterThanOrEqualTo(1);
        Run monitored = monitoring.simulate(run.id());
        assertThat(monitored.monitoring().path("confirmed").asBoolean()).isTrue();
        assertThat(monitored.monitoring().path("impactBonusApplied").asBoolean()).isTrue();
        assertThat(portfolio.portfolio().portfolio().monitoredCount()).isGreaterThanOrEqualTo(1);
    }
}
