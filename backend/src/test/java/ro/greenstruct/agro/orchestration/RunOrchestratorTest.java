package ro.greenstruct.agro.orchestration;

import java.util.List;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.orchestration.events.EventType;
import ro.greenstruct.agro.orchestration.events.RunEvent;
import ro.greenstruct.agro.orchestration.events.SseHub;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Full pipeline with stand-in agents: the real Bedrock agents plug into the same interface. */
@SpringBootTest
class RunOrchestratorTest {

    @TestConfiguration
    static class StubAgents {

        @Bean
        Agent technicalAuditor(ObjectMapper mapper) {
            return stub(AgentSlot.TECHNICAL_AUDITOR, mapper.createObjectNode().put("recommendationType", "UPGRADE"));
        }

        @Bean
        Agent fundingOptimizer(ObjectMapper mapper) {
            ObjectNode output = mapper.createObjectNode().put("recommendedOptionId", "B");
            output.putArray("options")
                    .add(mapper.createObjectNode().put("optionId", "A").put("kind", "STANDARD").put("greenEligible", false))
                    .add(mapper.createObjectNode().put("optionId", "B").put("kind", "GREEN_PACKAGE").put("greenEligible", true));
            output.putObject("comparison").put("netAdvantageCalcId", "calc_0123456789ab");
            return stub(AgentSlot.FUNDING_OPTIMIZER, output);
        }

        @Bean
        Agent greenUnderwriter(ObjectMapper mapper) {
            return stub(AgentSlot.GREEN_UNDERWRITER,
                    mapper.createObjectNode().put("decision", "ELIGIBLE_GREEN").put("recommendedOptionId", "B"));
        }

        private static Agent stub(AgentSlot slot, ObjectNode output) {
            return new Agent() {
                @Override
                public AgentSlot slot() {
                    return slot;
                }

                @Override
                public String modelId() {
                    return "stub";
                }

                @Override
                public AgentResult run(Run run, AgentContext context) {
                    assertThat(run.farmProfile()).isNotNull();
                    context.thought("Verific dosarul " + run.id(), 1);
                    return new AgentResult(output, "LIVE", 1);
                }
            };
        }
    }

    @Autowired
    private RunOrchestrator orchestrator;

    @Autowired
    private DemoScenarioService demoScenarios;

    @Autowired
    private SseHub hub;

    @Test
    void demoRunGoesThroughAllAgentsAndWaitsForTheOfficer() throws Exception {
        RunOrchestrator.StartedRun started = orchestrator.start(demoScenarios.load("irigatii"));

        Run done = started.completion().get(10, TimeUnit.SECONDS);

        assertThat(done.status()).isEqualTo(RunStatus.GATA);
        assertThat(done.farmProfile().company().name()).isEqualTo("Legume Bărăgan Demo SRL");
        assertThat(done.agentOutputs()).containsOnlyKeys(AgentSlot.values());
        assertThat(done.missingDocuments()).isEmpty();

        List<RunEvent> events = hub.history(done.id());
        assertThat(events).extracting(RunEvent::type).startsWith(EventType.STATE_TRANSITION, EventType.STATE_TRANSITION)
                .contains(EventType.AGENT_STARTED, EventType.AGENT_THOUGHT, EventType.AGENT_COMPLETED)
                .endsWith(EventType.RUN_COMPLETED);
        RunEvent completed = events.getLast();
        assertThat(completed.data().path("decision").asText()).isEqualTo("ELIGIBLE_GREEN");
        assertThat(completed.data().path("netAdvantageCalcId").asText()).isEqualTo("calc_0123456789ab");
        assertThat(completed.data().path("sources").path("GREEN_UNDERWRITER").asText()).isEqualTo("LIVE");
    }

    @Test
    void theBankApprovesOnlyADossierTheFarmerSent() throws Exception {
        Run done = orchestrator.start(demoScenarios.load("utilaje")).completion().get(10, TimeUnit.SECONDS);
        assertThatThrownBy(() -> orchestrator.approve(done.id(), "ofiter.demo", "prea devreme"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("TRIMIS");

        Run sent = orchestrator.submit(done.id(), Submission.Variant.VERDE);

        assertThat(sent.status()).isEqualTo(RunStatus.TRIMIS);
        assertThat(sent.submission().variant()).isEqualTo(Submission.Variant.VERDE);
        assertThat(sent.submission().optionId()).isEqualTo("B");
        RunEvent submitted = hub.history(done.id()).getLast();
        assertThat(submitted.data().path("to").asText()).isEqualTo("TRIMIS");
        assertThat(submitted.data().path("actor").asText()).isEqualTo("FARMER");
        assertThatThrownBy(() -> orchestrator.submit(done.id(), Submission.Variant.CLASIC))
                .isInstanceOf(IllegalStateException.class);

        Run approved = orchestrator.approve(done.id(), "ofiter.demo", "OK");

        assertThat(approved.status()).isEqualTo(RunStatus.MONITORIZARE);
        assertThat(approved.submission().optionId()).isEqualTo("B");
        assertThat(approved.officerActions()).singleElement()
                .extracting(OfficerAction::action).isEqualTo(OfficerAction.Action.APPROVE);
        assertThat(hub.history(done.id())).extracting(e -> e.data().path("to").asText())
                .contains("TRIMIS", "APROBAT", "MONITORIZARE");
        assertThatThrownBy(() -> orchestrator.approve(done.id(), "ofiter.demo", "din nou"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void theClassicCardSendsTheStandardOption() throws Exception {
        Run done = orchestrator.start(demoScenarios.load("irigatii")).completion().get(10, TimeUnit.SECONDS);

        assertThat(orchestrator.submit(done.id(), Submission.Variant.CLASIC).submission().optionId()).isEqualTo("A");
    }

    @Test
    void unknownFarmIsRejectedBeforeTheRunStarts() {
        RunRequest request = new RunRequest("RO12345678", "irigatii", List.of(), null, List.of(), null);

        assertThatThrownBy(() -> orchestrator.start(request)).isInstanceOf(RunRejectedException.class)
                .extracting(e -> ((RunRejectedException) e).reason())
                .isEqualTo(RunRejectedException.Reason.FARM_NOT_FOUND);
    }

    @Test
    void unknownModuleIsRejectedUpFront() {
        RunRequest request = new RunRequest("45871203", "nu-exista", List.of(), null, List.of(), null);

        assertThatThrownBy(() -> orchestrator.start(request)).isInstanceOf(IllegalArgumentException.class);
    }
}
