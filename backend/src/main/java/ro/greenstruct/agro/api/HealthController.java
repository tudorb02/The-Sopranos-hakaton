package ro.greenstruct.agro.api;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import ro.greenstruct.agro.config.GreenStructProperties;

/** GET /api/health/bedrock: the green/red light before the demo. Always 200; the state is in the body. */
@RestController
public class HealthController {

    private static final List<String> DEMO_SCENARIOS = List.of("irigatii", "energie", "utilaje", "zootehnie",
            "post_recolta", "ecologic");

    private final GreenStructProperties properties;
    private final ObjectProvider<BedrockHealthProbe> probe;
    private final ObjectProvider<ro.greenstruct.agro.bedrock.AgentRuntime> runtime;

    public HealthController(GreenStructProperties properties, ObjectProvider<BedrockHealthProbe> probe,
                            ObjectProvider<ro.greenstruct.agro.bedrock.AgentRuntime> runtime) {
        this.properties = properties;
        this.probe = probe;
        this.runtime = runtime;
    }

    public record BedrockHealth(String status, String region, String mode, Instant checkedAt, List<Model> models,
                                List<String> goldenRunsAvailable) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Model(String role, String modelId, String status, Long latencyMs, String errorRo) {
    }

    @GetMapping("/api/health/bedrock")
    public BedrockHealth bedrock() {
        BedrockHealthProbe configured = probe.getIfAvailable();
        List<Model> models = configured == null ? notConfigured() : configured.probe().stream()
                .map(m -> new Model(m.role(), m.modelId(), m.up() ? "UP" : "DOWN", m.latencyMs(), m.errorRo()))
                .toList();
        long up = models.stream().filter(m -> "UP".equals(m.status())).count();
        String status = up == models.size() && !models.isEmpty() ? "UP" : up > 0 ? "DEGRADED" : "DOWN";
        var agentRuntime = runtime.getIfAvailable();
        String mode = agentRuntime == null ? properties.mode() : agentRuntime.mode().name();
        return new BedrockHealth(status, properties.bedrock().region(), mode, Instant.now(), models, goldenRuns());
    }

    private List<Model> notConfigured() {
        var bedrock = properties.bedrock();
        return List.of(
                new Model("AGENT", orUnset(bedrock.agentModelId()), "DOWN", null, "Bedrock is not configured: the agents run on rules, offline"),
                new Model("EXTRACTION", orUnset(bedrock.extractionModelId()), "DOWN", null,
                        "Bedrock is not configured: demo documents are read from the recorded readings"));
    }

    private List<String> goldenRuns() {
        Path golden = properties.paths().dataDir().resolve("demo").resolve("golden");
        return DEMO_SCENARIOS.stream().filter(s -> Files.isDirectory(golden.resolve(s))
                && List.of("TECHNICAL_AUDITOR", "FUNDING_OPTIMIZER", "GREEN_UNDERWRITER").stream()
                .allMatch(slot -> Files.isRegularFile(golden.resolve(s).resolve(slot + ".json")))).toList();
    }

    private static String orUnset(String modelId) {
        return modelId == null || modelId.isBlank() ? "not configured" : modelId;
    }
}
