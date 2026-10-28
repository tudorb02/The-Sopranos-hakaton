package ro.greenstruct.agro.api;

import java.time.Duration;
import java.time.Instant;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** API without Bedrock agents: runs stop at Agent 1 with a clear error until the agents are plugged in. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private RunStore runs;

    @Autowired
    private ObjectMapper mapper;

    @Test
    void listsTheConfiguredModules() throws Exception {
        mvc.perform(get("/api/modules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[*].moduleId", hasItems("irigatii", "utilaje")))
                .andExpect(jsonPath("$[?(@.moduleId == 'irigatii')].threshold.value", hasItem(25)))
                .andExpect(jsonPath("$[0].calculator").doesNotExist());
    }

    @Test
    void returnsTheFarmProfileForADemoCui() throws Exception {
        mvc.perform(get("/api/farms/38264019"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.company.name").value("Cereale Câmpia Demo SRL"))
                .andExpect(jsonPath("$.company.manager.age").value(38))
                .andExpect(jsonPath("$.parcels.features.length()").value(3))
                .andExpect(jsonPath("$.cashflow.annualNetEur").value(74000));
    }

    @Test
    void unknownCuiIsNotFoundInTheSharedErrorFormat() throws Exception {
        mvc.perform(get("/api/farms/RO11111111"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void demoRunStopsAtAgentOneWhileAgentsAreMissing() throws Exception {
        String body = mvc.perform(post("/api/runs/demo/utilaje"))
                .andExpect(status().isAccepted())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.state").value("CREAT"))
                .andExpect(jsonPath("$.runUrl").exists())
                .andReturn().getResponse().getContentAsString();
        String runId = mapper.readTree(body).path("runId").asText();

        Run run = awaitTerminal(runId);

        assertThat(run.status()).isEqualTo(RunStatus.ESUAT);
        mvc.perform(get("/api/runs/" + runId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("ESUAT"))
                .andExpect(jsonPath("$.scenario").value("utilaje"))
                .andExpect(jsonPath("$.error.failedStep").value("AGENT_1"))
                .andExpect(jsonPath("$.error.code").value("BEDROCK_UNAVAILABLE"))
                .andExpect(jsonPath("$.agentStatus[0].status").value("FAILED"))
                .andExpect(jsonPath("$.agents.technicalAssessment").isEmpty())
                .andExpect(jsonPath("$.farm.company.cui").value("38264019"));
    }

    @Test
    void createRunFormStoresDocumentsFromTheManifest() throws Exception {
        String body = mvc.perform(createForm("45871203", "irigatii", "{\"irrigation_current\": \"ASPERSIE_VECHE\"}"))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();

        Run run = runs.find(mapper.readTree(body).path("runId").asText()).orElseThrow();
        assertThat(run.request().parcelIds()).containsExactly("ct_0412_01", "ct_0412_02");
        assertThat(run.missingDocuments()).containsExactly("WATER_PERMIT_ANAR", "ENERGY_INVOICES");
        assertThat(run.request().documents()).singleElement().satisfies(doc -> {
            assertThat(doc.docType()).isEqualTo("OFFER");
            assertThat(doc.fileName()).isEqualTo("oferta.pdf");
            assertThat(doc.documentId()).matches("^doc_[a-z0-9_]{3,40}$");
        });
    }

    @Test
    void invalidFormIsAValidationError() throws Exception {
        mvc.perform(createForm("45871203", "irigatii", "{nu e json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void unknownModuleIsAValidationError() throws Exception {
        mvc.perform(createForm("45871203", "nu-exista", "{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void approvingAFailedRunIsAnInvalidState() throws Exception {
        String body = mvc.perform(post("/api/runs/demo/irigatii")).andReturn().getResponse().getContentAsString();
        String runId = mapper.readTree(body).path("runId").asText();
        awaitTerminal(runId);

        mvc.perform(post("/api/runs/" + runId + "/approve").contentType("application/json")
                        .content("{\"officerId\": \"ofiter.demo\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INVALID_STATE"));
    }

    @Test
    void healthReportsBedrockAsNotConfigured() throws Exception {
        mvc.perform(get("/api/health/bedrock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.mode").value("HYBRID"))
                .andExpect(jsonPath("$.models.length()").value(2));
    }

    static MockMultipartHttpServletRequestBuilder createForm(String cui, String moduleId, String questionnaire) {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/runs")
                .file(new MockMultipartFile("documents", "scan-1.pdf", "application/pdf", new byte[]{1, 2, 3}))
                .param("cui", cui)
                .param("moduleId", moduleId)
                .param("parcelIds", "[\"ct_0412_01\", \"ct_0412_02\"]")
                .param("questionnaire", questionnaire)
                .param("documentManifest", "[{\"fileName\": \"oferta.pdf\", \"docType\": \"OFFER\"}]");
    }

    private Run awaitTerminal(String runId) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Instant.now().isBefore(deadline)) {
            Run run = runs.find(runId).orElseThrow();
            if (run.status() == RunStatus.ESUAT || run.status() == RunStatus.GATA) {
                return run;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Run " + runId + " did not finish in time");
    }
}
