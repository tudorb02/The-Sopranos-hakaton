package ro.greenstruct.agro.agents.rules;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import ro.greenstruct.agro.bedrock.SchemaSupport;
import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.MonitoringService;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunOrchestrator;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.orchestration.Submission;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * The demo dossiers through the real orchestrator and the rule-based agents (no model: REPLAY without a golden file
 * falls to the rules), the outputs validated against contracts/schemas/submit_*.json, every calcId resolved in the
 * CalcStore, and the story of README §13 per category. Figures are the ones the module engineers worked out by hand
 * in the ToolChain tests, checked here through the agents' outputs.
 */
@SpringBootTest(properties = {"greenstruct.agent-runtime.enabled=true", "greenstruct.analysis-date=2026-10-28"})
class RuleBasedScenariosTest {

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
    @Autowired
    MonitoringService monitoring;

    Run runRequest(RunRequest request) throws Exception {
        String runId = orchestrator.start(request).run().id();
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (Instant.now().isBefore(deadline)) {
            Run run = store.find(runId).orElseThrow();
            if (run.status() == RunStatus.GATA || run.status() == RunStatus.ESUAT) {
                return run;
            }
            Thread.sleep(25);
        }
        throw new AssertionError("timeout");
    }

    /** GATA, three outputs valid against their schema, every calcId resolvable. */
    Run readyAndValid(String id) throws Exception {
        Run run = runRequest(scenarios.load(id));
        assertThat(run.status()).as("status " + run.error()).isEqualTo(RunStatus.GATA);
        assertThat(problems(run)).isEmpty();
        return run;
    }

    List<String> problems(Run run) {
        List<String> all = new ArrayList<>();
        for (AgentSlot slot : AgentSlot.values()) {
            all.addAll(OutputChecks.problems(run, slot, schemas, calcs));
        }
        return all;
    }

    BigDecimal value(Run run, String key) {
        return calcs.latestByKey(run.id(), key).map(Calc::value).orElseThrow(() -> new AssertionError("No calc " + key));
    }

    String display(Run run, String key) {
        return calcs.latestByKey(run.id(), key).map(Calc::display).orElseThrow(() -> new AssertionError("No calc " + key));
    }

    void assertValue(Run run, String key, String expected) {
        assertThat(value(run, key)).as(key).isCloseTo(new BigDecimal(expected), within(new BigDecimal("0.02")));
    }

    JsonNode technical(Run run) {
        return run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
    }

    JsonNode funding(Run run) {
        return run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
    }

    JsonNode report(Run run) {
        return run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
    }

    String tier(Run run) {
        return funding(run).path("greenTier").path("tier").asText();
    }

    JsonNode configuration(Run run, String role) {
        for (JsonNode cfg : technical(run).path("configurations")) {
            if (role.equals(cfg.path("role").asText())) {
                return cfg;
            }
        }
        throw new AssertionError("No " + role + " configuration");
    }

    /** submit VERDE, approve → MONITORIZARE, "Simulează 12 luni" → a monitoring result. */
    void lifecycleReachesMonitoring(Run ready) {
        orchestrator.submit(ready.id(), Submission.Variant.VERDE);
        Run monitored = orchestrator.approve(ready.id(), "officer-1", "Aprobat în demo");
        assertThat(monitored.status()).isEqualTo(RunStatus.MONITORIZARE);
        Run simulated = monitoring.simulate(ready.id());
        assertThat(simulated.monitoring()).isNotNull();
        assertThat(simulated.monitoring().path("metrics")).isNotEmpty();
        assertThat(calcs.find(ready.id(), simulated.monitoring().path("rateAfterCalcId").asText())).isPresent();
    }

    @Test
    void irrigationStartsBelowTheThresholdAndDripWithSensorsPassesAsVerdePlus() throws Exception {
        Run run = readyAndValid("irigatii");
        assertThat(technical(run).path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertThat(configuration(run, "INITIAL").path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(configuration(run, "RECOMMENDED").path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.indicator", "20");
        assertValue(run, "cfg_recommended.indicator", "40");
        assertThat(tier(run)).isEqualTo("VERDE_PLUS");
        assertThat(report(run).path("fund").path("fundId").asText()).isEqualTo("F1");
        lifecycleReachesMonitoring(run);
    }

    @Test
    void energyIsEligibleByNatureAndResizedFrom300To100Kwp() throws Exception {
        Run run = readyAndValid("energie");
        // BY_NATURE: the investment is green as such; the size is what is wrong (68% sold to the grid)
        assertThat(technical(run).path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertThat(configuration(run, "INITIAL").path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(configuration(run, "RECOMMENDED").path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.pv_kwp", "300");
        assertValue(run, "cfg_recommended.pv_kwp", "100");
        assertValue(run, "cfg_initial.export_share", "68.47");
        assertValue(run, "cfg_recommended.export_share", "19.7");
        assertValue(run, "cfg_recommended.payback", "3.5");
        assertThat(technical(run).path("sizingCheck").path("status").asText()).isEqualTo("PASS");
        assertThat(tier(run)).isEqualTo("VERDE");
        assertThat(report(run).path("fund").path("fundId").asText()).isEqualTo("F1");
        assertThat(funding(run).path("recommendedOptionId").asText()).isEqualTo("B");
        // the savings of the green option carry the contract metric; the zero diesel saving is left out
        assertThat(funding(run).path("options").get(1).path("annualSavings")).extracting(s -> s.path("metric").asText())
                .containsExactly("ENERGY_COST_SAVED_EUR");
        lifecycleReachesMonitoring(run);
    }

    @Test
    void livestockStartsAtFortyFivePercentAndTheCoveredTankReachesEightyFiveAsVerdePlus() throws Exception {
        Run run = readyAndValid("zootehnie");
        assertThat(technical(run).path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertValue(run, "cfg_initial.indicator", "45");
        assertValue(run, "cfg_recommended.indicator", "85");
        assertValue(run, "cfg_recommended.total_cost", "296000");
        assertThat(tier(run)).isEqualTo("VERDE_PLUS");
        assertThat(report(run).path("fund").path("fundId").asText()).isEqualTo("F1");
        // the DNSH of the digestate comes from the permit and the covered tank, not from a generic condition
        assertThat(report(run).path("dnsh")).extracting(r -> r.path("status").asText()).containsOnly("PASS");
        // the instalments pass 40% of the cash flow for both credits: the green one stays recommended, with a warning
        assertThat(funding(run).path("recommendedOptionId").asText()).isEqualTo("B");
        assertThat(funding(run).path("farmerExplanationRo").asText()).contains("DSCR");
        lifecycleReachesMonitoring(run);
    }

    @Test
    void postHarvestStartsAt12PercentAndPropanePlusPanelsReach29Point65AsVerdeCuUpgrade() throws Exception {
        Run run = readyAndValid("post_recolta");
        assertThat(technical(run).path("recommendationType").asText()).isEqualTo("UPGRADE_TO_PASS");
        assertValue(run, "cfg_initial.indicator", "12.06");
        assertValue(run, "cfg_recommended.indicator", "29.65");
        assertValue(run, "cfg_recommended.total_cost", "142000");
        assertThat(tier(run)).isEqualTo("VERDE_CU_UPGRADE");
        assertThat(funding(run).path("greenTier").path("upgradeNeeded").asBoolean()).isTrue();
        assertThat(report(run).path("fund").path("fundId").asText()).isEqualTo("F1");
        // R404A (GWP 3,922) of the offer is replaced by propane: the refrigerant check passes on the financed config
        assertThat(technical(run).path("dnshChecks")).anySatisfy(check -> {
            assertThat(check.path("objective").asText()).isEqualTo("POLLUTION_PREVENTION");
            assertThat(check.path("status").asText()).isEqualTo("PASS");
        });
        lifecycleReachesMonitoring(run);
    }

    @Test
    void organicComparesFullAndPhasedConversionAndShowsTheLiquidityGap() throws Exception {
        Run run = readyAndValid("ecologic");
        assertThat(technical(run).path("recommendationType").asText()).isEqualTo("KEEP_INITIAL");
        assertThat(configuration(run, "INITIAL").path("thresholdResult").asText()).isEqualTo("PASS");
        // Agent 1: margins against the conventional farm and the first-year gap of both plans, as calc displays
        assertValue(run, "plan.full.margin_total", "83614");
        assertValue(run, "plan.phased.margin_total", "61830");
        assertValue(run, "plan.full.gap_y1", "36020.07");
        assertValue(run, "plan.full.coverage", "40320");
        assertThat(technical(run).path("summaryRo").asText()).contains("full conversion").contains("phased conversion")
                .contains(display(run, "plan.full.margin_total")).contains(display(run, "plan.phased.margin_total"))
                .contains(display(run, "plan.full.gap_y1"));
        assertThat(technical(run).path("farmerMessageRo").asText()).contains("full conversion");
        // Agent 2: the liquidity gap with the instalments of the green credit, against the APIA pre-financing
        assertValue(run, "option_b.gap.y1", "36020.07");
        assertThat(funding(run).path("officerNotesRo").asText()).contains("liquidity gap")
                .contains(display(run, "option_b.gap.y1"));
        assertThat(funding(run).path("farmerExplanationRo").asText()).contains("liquidity gap");
        // CERTIFICATION threshold: eligible through the conversion contract, Credit BIO (F3) with F5 as an addition
        assertThat(tier(run)).isEqualTo("VERDE");
        JsonNode fund = report(run).path("fund");
        assertThat(fund.path("fundId").asText()).isEqualTo("F3");
        assertThat(fund.path("alternatives")).extracting(a -> a.path("fundId").asText()).contains("F5");
        assertThat(funding(run).path("options").get(1).path("fundingStack").get(0).path("productId").asText())
                .isEqualTo("rbro.agri.credit_bio");
        lifecycleReachesMonitoring(run);
    }

    @Test
    void missingDocumentsBecomeConditionsBeforeDrawdownNotARejection() throws Exception {
        RunRequest full = scenarios.load("zootehnie");
        List<StoredDocument> withoutPermit = full.documents().stream()
                .filter(d -> !"ENVIRONMENTAL_PERMIT".equals(d.docType())).toList();
        Run run = runRequest(new RunRequest(full.cui(), full.moduleId(), full.parcelIds(), full.questionnaire(),
                withoutPermit, full.demoScenario()));

        assertThat(run.status()).as("status " + run.error()).isEqualTo(RunStatus.GATA);
        assertThat(problems(run)).isEmpty();
        assertThat(run.missingDocuments()).contains("ENVIRONMENTAL_PERMIT");
        assertThat(technical(run).path("missingFields")).extracting(f -> f.path("docType").asText())
                .contains("ENVIRONMENTAL_PERMIT");
        assertThat(technical(run).path("dnshChecks")).anySatisfy(check -> {
            assertThat(check.path("objective").asText()).isEqualTo("POLLUTION_PREVENTION");
            assertThat(check.path("status").asText()).isEqualTo("MISSING_DATA");
        });
        assertThat(funding(run).path("officerNotesRo").asText()).contains("ENVIRONMENTAL_PERMIT");
        assertThat(report(run).path("decision").asText()).isEqualTo("ELIGIBLE_WITH_CONDITIONS");
        assertThat(report(run).path("conditionsPrecedent")).extracting(c -> c.path("conditionId").asText())
                .contains("cp_dnsh_pollution_prevention").anyMatch(id -> id.startsWith("cp_missing_"));
    }
}
