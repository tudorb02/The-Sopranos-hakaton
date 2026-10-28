package ro.greenstruct.agro.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.storage.DocumentStore;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Checks that do not belong to one module's chain: the report schema and the config agree on the green-bond
 * categories, and tool input mistakes come back as tool errors. The module chains are in
 * Irrigation/Machinery/Energy/Livestock/PostHarvestToolChainTest.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class ToolChainTest {

    @Autowired
    private ToolRegistry tools;
    @Autowired
    private RunStore runs;
    @Autowired
    private FarmProfileService farms;
    @Autowired
    private DocumentStore documents;
    @Autowired
    private CalcStore calcs;
    @Autowired
    private ReferenceData reference;
    @Autowired
    private ObjectMapper mapper;

    private ChainSupport chain;

    @BeforeEach
    void setUp() {
        chain = new ChainSupport(tools, runs, farms, documents, calcs, mapper);
    }

    @Test
    void bondCategoriesOfTheConfigAreTheReportSchemaCategories() throws Exception {
        JsonNode schema = mapper.readTree(java.nio.file.Path.of("../contracts/schemas/submit_underwriting_report.json")
                .toFile());
        List<String> inSchema = new ArrayList<>();
        schema.path("properties").path("greenBond").path("properties").path("category").path("enum")
                .forEach(category -> inSchema.add(category.asText()));
        List<String> inConfig = new ArrayList<>();
        reference.funds().path("bondCategories").forEach(category -> inConfig.add(category.path("categoryId").asText()));
        inConfig.add("NONE");

        assertThat(inSchema).containsExactlyInAnyOrderElementsOf(inConfig);
    }

    @Test
    void inputMistakesComeBackAsToolErrors() {
        String run = chain.newRun("38264019", "utilaje", List.of(), "{}", Map.of());

        ToolOutput output = chain.callRaw(run, "simulate_upgrade_package",
                "{\"baseConfigId\": \"cfg_missing\", \"configId\": \"cfg_x\"}");

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("cfg_missing");
    }
}
