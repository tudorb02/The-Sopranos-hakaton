package ro.greenstruct.agro.bedrock;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.storage.StoredDocument;

import static org.assertj.core.api.Assertions.assertThat;
import static ro.greenstruct.agro.bedrock.TestKit.MAPPER;

/**
 * Manual smoke test against the real Bedrock (fictitious demo data only). Not run by mvn test (the IT suffix);
 * run it with the key in the environment:
 * <pre>set -a; . ../.env; set +a; mvn test -Dtest=BedrockLiveIT -Dsurefire.failIfNoSpecifiedTests=false</pre>
 */
@EnabledIfEnvironmentVariable(named = "AWS_BEARER_TOKEN_BEDROCK", matches = ".+")
class BedrockLiveIT {

    private static final Path OFFER = Path.of("..", "data", "demo", "test-documents", "pdf", "DEMO-0001",
            "01_oferta_aspersie.pdf");

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static BedrockGateway gateway() {
        return SdkBedrockGateway.create(env("GREENSTRUCT_BEDROCK_REGION", env("AWS_REGION", "us-west-2")),
                System.getenv("AWS_BEARER_TOKEN_BEDROCK"), Duration.ofSeconds(60), MAPPER);
    }

    private static BedrockGateway.ToolSpec weatherTool() {
        return new BedrockGateway.ToolSpec("get_pump_power", "Returns the pump power id for a farm.",
                TestKit.json("{\"type\":\"object\",\"properties\":{\"farmId\":{\"type\":\"string\"}},"
                        + "\"required\":[\"farmId\"]}"));
    }

    private void callsTheToolOn(String modelId, String forcedTool) throws Exception {
        BedrockGateway.Response response = gateway().converse(new BedrockGateway.Request(modelId,
                "You are a test agent. Always use the tool.",
                List.of(BedrockGateway.Message.user(new BedrockGateway.Text("Get the pump power for farm DEMO-0001."))),
                List.of(weatherTool()), forcedTool, 300));

        assertThat(response.blocks()).anySatisfy(block -> {
            assertThat(block).isInstanceOf(BedrockGateway.ToolUse.class);
            BedrockGateway.ToolUse use = (BedrockGateway.ToolUse) block;
            assertThat(use.name()).isEqualTo("get_pump_power");
            assertThat(use.input().path("farmId").asText()).isNotBlank();
        });
        System.out.println("LIVE " + modelId + " forced=" + forcedTool + " stop=" + response.stopReason()
                + " tokens=" + response.inputTokens() + "/" + response.outputTokens());
    }

    @Test
    void agentModelUsesATool() throws Exception {
        callsTheToolOn(env("GREENSTRUCT_AGENT_MODEL_ID", BedrockModels.DEFAULT_AGENT), null);
    }

    @Test
    void extractionModelUsesAForcedTool() throws Exception {
        callsTheToolOn(env("GREENSTRUCT_EXTRACTION_MODEL_ID", BedrockModels.DEFAULT_EXTRACTION), "get_pump_power");
    }

    @Test
    void bedrockAcceptsTheFlattenedSubmitSchemas() throws Exception {
        SchemaSupport schemas = new SchemaSupport(Path.of("..", "contracts", "schemas"), MAPPER);
        List<BedrockGateway.ToolSpec> tools = List.of("submit_technical_assessment", "submit_funding_recommendation",
                "submit_underwriting_report", "submit_offer_extraction").stream()
                .map(name -> new BedrockGateway.ToolSpec(name, "Final result.", schemas.forBedrock(name))).toList();

        BedrockGateway.Response response = gateway().converse(new BedrockGateway.Request(
                env("GREENSTRUCT_EXTRACTION_MODEL_ID", BedrockModels.DEFAULT_EXTRACTION), null,
                List.of(BedrockGateway.Message.user(new BedrockGateway.Text("Reply with the word ok. Call no tool."))),
                tools, null, 20));

        assertThat(response.blocks()).isNotEmpty();
    }

    @Test
    void extractionModelReadsAFictitiousOfferPdf() throws Exception {
        SchemaSupport schemas = new SchemaSupport(Path.of("..", "contracts", "schemas"), MAPPER);
        BedrockDocumentExtractor extractor = new BedrockDocumentExtractor(gateway(), schemas, MAPPER,
                env("GREENSTRUCT_EXTRACTION_MODEL_ID", BedrockModels.DEFAULT_EXTRACTION),
                AgentRuntimeConfiguration.prompt("extraction"), 4096, Duration.ofSeconds(2), Thread::sleep);
        ModuleDefinition module = new ModuleDefinition("irigatii", null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null);
        StoredDocument document = new StoredDocument("doc_oferta_aspersie", "OFFER", "01_oferta_aspersie.pdf",
                "application/pdf", 1, "x", "k");

        JsonNode extraction = extractor.extract(document, Files.readAllBytes(OFFER), module);

        assertThat(schemas.validate("submit_offer_extraction", extraction)).isEmpty();
        assertThat(extraction.path("documentId").asText()).isEqualTo("doc_oferta_aspersie");
        System.out.println("LIVE extraction fields=" + extraction.path("documentFields").size()
                + " lines=" + extraction.path("lineItems").size());
    }
}
