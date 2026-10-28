package ro.greenstruct.agro.api;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

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
@SpringBootTest(properties = {"greenstruct.analysis-date=2026-10-28", "greenstruct.agent-runtime.enabled=true"})
@AutoConfigureMockMvc
class ContractSamplesTest {

    private static final Path SAMPLES = Path.of("target/contract-samples");

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
        sample("FarmProfile__irigatii", get("/api/farms/45871203"));
        sample("FarmProfile__utilaje", get("/api/farms/38264019"));
        sample("BedrockHealth__not_configured", get("/api/health/bedrock"));
        sample("Error__not_found", get("/api/runs/run_000000000000"));
        sample("Error__unknown_module", ApiTest.createForm("45871203", "nu-exista", "{}"));
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
        sample("RunView__full_trimis_irigatii", get("/api/runs/" + irrigation + "?view=full"));
        writeEvents("irigatii", irrigation);

        JsonNode approved = sample("RunView__monitorizare_irigatii", post("/api/runs/" + irrigation + "/approve")
                .contentType("application/json").content("{\"officerId\": \"ofiter.demo\", \"commentRo\": \"Aprobat\"}"));
        assertThat(approved.path("state").asText()).isEqualTo("MONITORIZARE");

        String failing = mapper.readTree(mvc.perform(unreadableDocuments()).andReturn().getResponse()
                .getContentAsString()).path("runId").asText();
        assertThat(await(failing)).isEqualTo(RunStatus.ESUAT);
        sample("RunView__esuat", get("/api/runs/" + failing));
        writeEvents("esuat", failing);

        for (String scenario : List.of("energie", "utilaje", "zootehnie", "post_recolta", "ecologic")) {
            String runId = mapper.readTree(mvc.perform(post("/api/runs/demo/" + scenario)).andReturn().getResponse()
                    .getContentAsString()).path("runId").asText();
            assertThat(await(runId)).as(scenario).isEqualTo(RunStatus.GATA);
            JsonNode view = sample("RunView__gata_" + scenario, get("/api/runs/" + runId));
            sample("FarmProfile__" + scenario, get("/api/farms/" + view.path("cui").asText()));
            boolean green = view.path("agents").path("fundingRecommendation").path("options").findValues("kind").stream()
                    .anyMatch(k -> k.asText().startsWith("GREEN"));
            sample("RunView__sme_" + scenario, post("/api/runs/" + runId + "/submit").contentType("application/json")
                    .content("{\"variant\": \"" + (green ? "VERDE" : "CLASIC") + "\"}"));
            sample("RunView__full_trimis_" + scenario, get("/api/runs/" + runId + "?view=full"));
            if ("utilaje".equals(scenario)) {
                JsonNode requested = sample("RunView__documents_requested_utilaje", post("/api/runs/" + runId
                        + "/request-documents").contentType("application/json").content("""
                        {"officerId": "ofiter.demo", "messageRo": "Avem nevoie de certificatul de casare.",
                         "documents": [{"docType": "SCRAPPING_CERTIFICATE", "labelRo": "Certificat de casare tractor vechi",
                                        "dueDate": "2026-12-15"}]}
                        """));
                assertThat(requested.path("state").asText()).isEqualTo("TRIMIS");
                assertThat(requested.path("pendingDocuments")).hasSize(1);
            }
            writeEvents(scenario, runId);
        }
    }

    /**
     * A new dossier whose scan has no recorded reading and no Bedrock to read it: the technical agent fails.
     * The bytes start like a PDF so the upload check lets them through to the agent.
     */
    private static RequestBuilder unreadableDocuments() {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/runs")
                .file(new org.springframework.mock.web.MockMultipartFile("documents", "scan-1.pdf", "application/pdf",
                        "%PDF-1.4 scan".getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
                .param("cui", "45871203").param("moduleId", "irigatii")
                .param("parcelIds", "[\"ct_0412_01\"]").param("questionnaire", "{\"irrigation_current\": \"BRAZDE\"}")
                .param("documentManifest", "[{\"fileName\": \"oferta.pdf\", \"docType\": \"OFFER\"}]");
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
}
