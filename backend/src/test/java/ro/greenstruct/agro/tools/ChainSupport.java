package ro.greenstruct.agro.tools;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Runs tools through the registry for the module chain tests: new dossier, tool call, calc assertion. */
final class ChainSupport {

    private static final BigDecimal CENTS = new BigDecimal("0.02");

    private final ToolRegistry tools;
    private final RunStore runs;
    private final FarmProfileService farms;
    private final DocumentStore documents;
    private final CalcStore calcs;
    private final ObjectMapper mapper;

    ChainSupport(ToolRegistry tools, RunStore runs, FarmProfileService farms, DocumentStore documents, CalcStore calcs,
                 ObjectMapper mapper) {
        this.tools = tools;
        this.runs = runs;
        this.farms = farms;
        this.documents = documents;
        this.calcs = calcs;
        this.mapper = mapper;
    }

    String newRun(String cui, String moduleId, List<String> parcels, String questionnaire, Map<String, String> docs) {
        List<StoredDocument> stored = new ArrayList<>();
        new LinkedHashMap<>(docs).forEach((id, type) -> stored.add(documents.save(id, type, id + ".pdf",
                "application/pdf", new byte[]{1})));
        try {
            RunRequest request = new RunRequest(cui, moduleId, parcels, mapper.readTree(questionnaire), stored, null);
            Run run = Run.create(request, List.of(), farms.get(cui)).withStatus(RunStatus.DATE_FIRMA);
            return runs.save(run).id();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    JsonNode call(String runId, String tool, String input) {
        ToolOutput output = callRaw(runId, tool, input);
        assertThat(output.ok()).as(tool + ": " + output.messageRo()).isTrue();
        return output.result();
    }

    ToolOutput callRaw(String runId, String tool, String input) {
        try {
            return tools.execute(runId, tool, mapper.readTree(input));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    void assertValue(String runId, String key, String expected) {
        Calc calc = calcs.latestByKey(runId, key).orElseThrow(() -> new AssertionError("No calc " + key));
        assertThat(calc.calcId()).matches("^calc_[a-f0-9]{12}$");
        assertThat(calc.value()).as(key).isCloseTo(new BigDecimal(expected), within(CENTS));
    }

    /** What the technical auditor submits: the configurations compared and the DNSH statuses, for determine_green_tier. */
    void storeTechnicalAssessment(String runId, String initialConfigId, String recommendedConfigId, String dnshStatus) {
        var assessment = mapper.createObjectNode().put("initialConfigId", initialConfigId)
                .put("recommendedConfigId", recommendedConfigId);
        var checks = assessment.putArray("dnshChecks");
        for (int i = 0; i < 5; i++) {
            checks.addObject().put("status", dnshStatus);
        }
        runs.save(runs.find(runId).orElseThrow().withAgentOutput(AgentSlot.TECHNICAL_AUDITOR, assessment));
    }

    static Map<String, String> programs(JsonNode eligibility) {
        Map<String, String> byCode = new LinkedHashMap<>();
        eligibility.path("programs").forEach(p -> byCode.put(p.path("programCode").asText(),
                p.path("result").asText() + "/" + p.path("session").asText()));
        return byCode;
    }
}
