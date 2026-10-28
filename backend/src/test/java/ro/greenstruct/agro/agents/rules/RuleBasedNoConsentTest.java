package ro.greenstruct.agro.agents.rules;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import ro.greenstruct.agro.bedrock.SchemaSupport;
import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.external.OpenBankingPort;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunOrchestrator;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.tools.CalcStore;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A farm without Open Banking consent: no cash flow, so no affordability ratio and no DSCR. The funding agent skips
 * the two checks and says so (README §5.3: missing data is a condition, not a rejection). The only schema problem
 * left is the one reported to the contract owners: affordability.ratioCalcId and dscrCalcId are required.
 */
@SpringBootTest(properties = {"greenstruct.agent-runtime.enabled=true", "greenstruct.analysis-date=2026-10-28"})
class RuleBasedNoConsentTest {

    @TestConfiguration
    static class NoConsent {

        @Bean
        @Primary
        OpenBankingPort noConsent() {
            return cui -> Optional.empty();
        }
    }

    @Autowired
    RunOrchestrator orchestrator;
    @Autowired
    DemoScenarioService scenarios;
    @Autowired
    RunStore store;
    @Autowired
    SchemaSupport schemas;
    @Autowired
    CalcStore calcs;

    @Test
    void withoutCashflowTheAffordabilityChecksAreSkippedAndTheDossierStillGetsReady() throws Exception {
        String runId = orchestrator.start(scenarios.load("energie")).run().id();
        Run run = null;
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (Instant.now().isBefore(deadline)) {
            run = store.find(runId).orElseThrow();
            if (run.status() == RunStatus.GATA || run.status() == RunStatus.ESUAT) {
                break;
            }
            Thread.sleep(25);
        }
        assertThat(run.farmProfile().cashflow()).isNull();
        assertThat(run.status()).as("status " + run.error()).isEqualTo(RunStatus.GATA);

        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        assertThat(funding.path("options")).isNotEmpty().allSatisfy(option -> {
            assertThat(option.path("affordability").path("status").asText()).isEqualTo("PASS_WITH_WARNING");
            assertThat(option.path("affordability").path("noteRo").asText()).contains("Open Banking");
        });
        assertThat(funding.path("recommendationBasis").path("affordabilityPassed").asBoolean()).isFalse();
        assertThat(funding.path("officerNotesRo").asText()).contains("Open Banking");
        assertThat(calcs.latestByKey(runId, "option_b.affordability_ratio")).isEmpty();

        // the other two agents are complete and valid; only the two required calcIds of affordability are missing
        List<String> problems = new ArrayList<>();
        for (AgentSlot slot : AgentSlot.values()) {
            problems.addAll(OutputChecks.problems(run, slot, schemas, calcs));
        }
        assertThat(problems).allMatch(p -> p.contains("/affordability") && (p.contains("ratioCalcId")
                || p.contains("dscrCalcId")), "only the required ratioCalcId / dscrCalcId of affordability");
        assertThat(run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER).path("decision").asText()).startsWith("ELIGIBLE");
    }
}
