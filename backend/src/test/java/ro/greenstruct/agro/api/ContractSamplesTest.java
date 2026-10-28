package ro.greenstruct.agro.api;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

import ro.greenstruct.agro.orchestration.Agent;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.orchestration.events.RunEvent;
import ro.greenstruct.agro.orchestration.events.SseHub;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Writes real API responses and SSE events to target/contract-samples/&lt;Schema&gt;__&lt;case&gt;.json, with
 * stand-in agents that return the fixtures' agent outputs. contracts/tools/validate-samples.mjs then checks
 * every sample against contracts/openapi.yaml and schemas/event.json.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
@AutoConfigureMockMvc
class ContractSamplesTest {

    private static final Path SAMPLES = Path.of("target/contract-samples");

    @TestConfiguration
    static class FixtureAgents {

        @Bean
        Agent technicalAuditor(ObjectMapper mapper) {
            return fixtureAgent(AgentSlot.TECHNICAL_AUDITOR, mapper);
        }

        @Bean
        Agent fundingOptimizer(ObjectMapper mapper) {
            return fixtureAgent(AgentSlot.FUNDING_OPTIMIZER, mapper);
        }

        @Bean
        Agent greenUnderwriter(ObjectMapper mapper) {
            return fixtureAgent(AgentSlot.GREEN_UNDERWRITER, mapper);
        }

        /** Returns the agent's output from the module's fixture; fails if the questionnaire asks it to. */
        private static Agent fixtureAgent(AgentSlot slot, ObjectMapper mapper) {
            return new Agent() {
                @Override
                public AgentSlot slot() {
                    return slot;
                }

                @Override
                public String modelId() {
                    return "fixture";
                }

                @Override
                public AgentResult run(Run run, AgentContext context) throws IOException {
                    if (run.request().questionnaire().path("simulate_failure").asBoolean(false)) {
                        throw new AgentFailureException("AGENT_INVALID_OUTPUT", "Răspunsul agentului nu respectă schema",
                                true, null);
                    }
                    context.thought("Analizez dosarul " + run.id(), 1);
                    return new AgentResult(fixtureOutput(mapper, run.request().moduleId(), slot), "LIVE", 1);
                }
            };
        }
    }

    @Autowired
    private MockMvc mvc;
    @Autowired
    private RunStore runs;
    @Autowired
    private SseHub hub;
    @Autowired
    private ObjectMapper mapper;

    @BeforeAll
    static void cleanSamples() throws IOException {
        Files.createDirectories(SAMPLES);
        try (var files = Files.list(SAMPLES)) {
            for (Path file : files.toList()) {
                Files.delete(file);
            }
        }
    }

    @Test
    void writesSamplesForEveryEndpoint() throws Exception {
        sample("ModuleList__all", get("/api/modules"));
        sample("FarmProfile__utilaje", get("/api/farms/38264019"));
        sample("BedrockHealth__not_configured", get("/api/health/bedrock"));
        sample("Error__not_found", get("/api/runs/run_000000000000"));
        sample("Error__module_not_ready", ApiTest.createForm("45871203", "zootehnie", "{}"));
        sample("Error__validation", ApiTest.createForm("45871203", "irigatii", "{nu e json"));

        JsonNode created = sample("RunCreated__demo_irigatii", post("/api/runs/demo/irigatii"));
        String irrigation = created.path("runId").asText();
        assertThat(await(irrigation)).isEqualTo(RunStatus.GATA);
        sample("RunView__gata_irigatii", get("/api/runs/" + irrigation));
        JsonNode smeView = sample("RunView__sme_irigatii", get("/api/runs/" + irrigation + "?view=sme"));
        assertThat(smeView.path("agents").path("fundingRecommendation").has("officerNotesRo")).isFalse();
        assertThat(smeView.path("agents").path("underwritingReport").has("greenBond")).isFalse();
        assertThat(smeView.path("agents").path("underwritingReport").has("conditionsPrecedent")).isTrue();
        sample("Error__invalid_state", post("/api/runs/" + irrigation + "/approve").contentType("application/json")
                .content("{\"officerId\": \"ofiter.demo\"}"));

        JsonNode sent = sample("RunView__trimis_irigatii", post("/api/runs/" + irrigation + "/submit")
                .contentType("application/json").content("{\"variant\": \"VERDE\"}"));
        assertThat(sent.path("state").asText()).isEqualTo("TRIMIS");
        assertThat(sent.path("submission").path("optionId").asText()).isEqualTo("B");
        writeEvents("irigatii", irrigation);

        JsonNode approved = sample("RunView__monitorizare_irigatii", post("/api/runs/" + irrigation + "/approve")
                .contentType("application/json").content("{\"officerId\": \"ofiter.demo\", \"commentRo\": \"Aprobat\"}"));
        assertThat(approved.path("state").asText()).isEqualTo("MONITORIZARE");

        String machinery = mapper.readTree(mvc.perform(post("/api/runs/demo/utilaje")).andReturn().getResponse()
                .getContentAsString()).path("runId").asText();
        assertThat(await(machinery)).isEqualTo(RunStatus.GATA);
        sample("Error__validation_variant", post("/api/runs/" + machinery + "/submit").contentType("application/json")
                .content("{\"variant\": \"B\"}"));
        mvc.perform(post("/api/runs/" + machinery + "/submit").contentType("application/json")
                .content("{\"variant\": \"CLASIC\"}"));
        JsonNode requested = sample("RunView__documents_requested_utilaje", post("/api/runs/" + machinery
                + "/request-documents").contentType("application/json").content("""
                {"officerId": "ofiter.demo", "messageRo": "Avem nevoie de certificatul de casare.",
                 "documents": [{"docType": "SCRAPPING_CERTIFICATE", "labelRo": "Certificat de casare tractoare vechi",
                                "dueDate": "2026-12-15"}]}
                """));
        assertThat(requested.path("state").asText()).isEqualTo("TRIMIS");
        assertThat(requested.path("submission").path("optionId").asText()).isEqualTo("A");
        assertThat(requested.path("pendingDocuments")).hasSize(1);
        writeEvents("utilaje", machinery);

        String failing = mapper.readTree(mvc.perform(ApiTest.createForm("45871203", "irigatii",
                "{\"simulate_failure\": true}")).andReturn().getResponse().getContentAsString()).path("runId").asText();
        assertThat(await(failing)).isEqualTo(RunStatus.ESUAT);
        sample("RunView__esuat", get("/api/runs/" + failing));
        writeEvents("esuat", failing);
    }

    private JsonNode sample(String name, RequestBuilder request) throws Exception {
        String body = mvc.perform(request).andReturn().getResponse().getContentAsString();
        Files.writeString(SAMPLES.resolve(name + ".json"), body);
        return mapper.readTree(body);
    }

    private void writeEvents(String name, String runId) throws IOException {
        for (RunEvent event : hub.history(runId)) {
            Files.writeString(SAMPLES.resolve("RunEvent__" + name + "_" + event.seq() + ".json"),
                    mapper.writeValueAsString(event));
        }
    }

    private RunStatus await(String runId) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Instant.now().isBefore(deadline)) {
            RunStatus status = runs.find(runId).orElseThrow().status();
            if (status == RunStatus.GATA || status == RunStatus.ESUAT) {
                return status;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Run " + runId + " did not finish in time");
    }

    static JsonNode fixtureOutput(ObjectMapper mapper, String moduleId, AgentSlot slot) throws IOException {
        for (String line : Files.readAllLines(Path.of("../contracts/fixtures/" + moduleId + ".ndjson"))) {
            JsonNode event = mapper.readTree(line);
            if ("agent.completed".equals(event.path("type").asText()) && slot.name().equals(event.path("agent").asText())) {
                return event.path("data").path("output");
            }
        }
        throw new IllegalArgumentException("No fixture output for " + slot + " in " + moduleId);
    }
}
