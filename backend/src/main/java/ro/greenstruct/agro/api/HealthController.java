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

    private static final List<String> DEMO_SCENARIOS = List.of("irigatii", "utilaje");

    private final GreenStructProperties properties;
    private final ObjectProvider<BedrockHealthProbe> probe;

    public HealthController(GreenStructProperties properties, ObjectProvider<BedrockHealthProbe> probe) {
        this.properties = properties;
        this.probe = probe;
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
        return new BedrockHealth(status, properties.bedrock().region(), properties.mode(), Instant.now(), models,
                goldenRuns());
    }

    private List<Model> notConfigured() {
        var bedrock = properties.bedrock();
        return List.of(
                new Model("AGENT", orUnset(bedrock.agentModelId()), "DOWN", null, "Agenții Bedrock nu sunt încă integrați"),
                new Model("EXTRACTION", orUnset(bedrock.extractionModelId()), "DOWN", null,
                        "Citirea documentelor prin Bedrock nu e încă integrată"));
    }

    private List<String> goldenRuns() {
        Path golden = properties.paths().dataDir().resolve("demo").resolve("golden");
        return DEMO_SCENARIOS.stream().filter(s -> Files.isRegularFile(golden.resolve(s + ".json"))).toList();
    }

    private static String orUnset(String modelId) {
        return modelId == null || modelId.isBlank() ? "neconfigurat" : modelId;
    }
}
