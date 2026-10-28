package ro.greenstruct.agro.bedrock;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

/**
 * Wires the agents' runtime: schemas from contracts/, recordings from data/demo/golden/, the mode, and the
 * document reader. Switch off with greenstruct.agent-runtime.enabled=false (tests that bring their own agents).
 */
@Configuration
@ConditionalOnProperty(name = "greenstruct.agent-runtime.enabled", havingValue = "true", matchIfMissing = true)
public class AgentRuntimeConfiguration {

    private static final ToolLoop.Sleeper SLEEPER = duration -> Thread.sleep(duration);

    @Bean
    SchemaSupport schemaSupport(GreenStructProperties properties, ObjectMapper mapper) {
        // contracts/ sits next to data/ and config/ at the repo root
        Path contracts = properties.paths().dataDir().resolveSibling("contracts").resolve("schemas");
        return new SchemaSupport(contracts, mapper);
    }

    @Bean
    GoldenStore goldenStore(GreenStructProperties properties, ObjectMapper mapper) {
        return new GoldenStore(properties.paths().dataDir().resolve("demo").resolve("golden"), mapper);
    }

    @Bean
    RunCache runCache() {
        return new RunCache();
    }

    @Bean
    ExtractionReplay extractionReplay() {
        return new ExtractionReplay();
    }

    /** The reader every extract_document call goes through: recorded reading in a replay, Bedrock otherwise. */
    @Bean
    DocumentExtractor documentExtractor(ObjectProvider<BedrockGateway> gateway, ExtractionReplay replay,
                                        SchemaSupport schemas, ObjectMapper mapper, GreenStructProperties properties,
                                        AgentRuntimeProperties runtime) {
        BedrockGateway available = gateway.getIfAvailable();
        BedrockDocumentExtractor bedrock = available == null ? null : new BedrockDocumentExtractor(available, schemas,
                mapper, BedrockModels.from(properties, runtime).extraction(), prompt("extraction"),
                runtime.agentRuntime().maxTokens(), runtime.agentRuntime().retryBackoff(), SLEEPER);
        return new ReplayAwareDocumentExtractor(replay, bedrock);
    }

    @Bean
    AgentRuntime agentRuntime(ObjectProvider<BedrockGateway> gateway, AgentToolbox toolbox, SchemaSupport schemas,
                              GoldenStore golden, RunCache cache, ExtractionReplay extractions, ObjectMapper mapper,
                              GreenStructProperties properties, AgentRuntimeProperties runtime) {
        BedrockGateway available = gateway.getIfAvailable();
        AgentRuntimeProperties.AgentRuntime settings = runtime.agentRuntime();
        Map<AgentSlot, String> prompts = new ConcurrentHashMap<>();
        return new AgentRuntime(new AgentRuntime.Setup(new AgentModes(properties.mode(), available != null), available,
                BedrockModels.from(properties, runtime).agentModels(), toolbox, schemas, golden, cache,
                new ReplayEngine(mapper, SLEEPER, extractions),
                new ToolLoop.Settings(settings.maxIterations(), settings.maxAttempts(), settings.retryBackoff(),
                        settings.maxTokens()),
                SLEEPER, settings.replayDelay(), runtime.recordGolden(), new RunContextBuilder(mapper),
                slot -> prompts.computeIfAbsent(slot, s -> prompt(s.name().toLowerCase())), mapper));
    }

    /** prompts/&lt;name&gt;.md on the classpath. */
    static String prompt(String name) {
        try (InputStream in = new ClassPathResource("prompts/" + name + ".md").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Missing prompt prompts/" + name + ".md", e);
        }
    }
}
