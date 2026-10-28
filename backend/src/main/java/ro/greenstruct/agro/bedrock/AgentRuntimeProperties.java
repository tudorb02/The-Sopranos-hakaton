package ro.greenstruct.agro.bedrock;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the Bedrock agents and of the offline replay (greenstruct.* next to GreenStructProperties).
 * recordGolden: write data/demo/golden/ files after a successful LIVE run of a demo scenario.
 */
@ConfigurationProperties("greenstruct")
public record AgentRuntimeProperties(boolean recordGolden, AgentRuntime agentRuntime, Bedrock bedrock) {

    public AgentRuntimeProperties {
        agentRuntime = agentRuntime == null ? new AgentRuntime(null, null, null, null, null, null) : agentRuntime;
        bedrock = bedrock == null ? new Bedrock(null, null, null) : bedrock;
    }

    /**
     * enabled=false removes the three Agent beans (tests that bring their own stand-ins).
     * maxIterations: Converse calls per agent. replayDelay: pause between replayed events (demo pacing).
     */
    public record AgentRuntime(Boolean enabled, Integer maxIterations, Integer maxAttempts, Duration retryBackoff,
                               Duration replayDelay, Integer maxTokens) {

        public AgentRuntime {
            enabled = enabled == null || enabled;
            maxIterations = maxIterations == null ? 8 : maxIterations;
            maxAttempts = maxAttempts == null ? 3 : maxAttempts;
            retryBackoff = retryBackoff == null ? Duration.ofMillis(1500) : retryBackoff;
            replayDelay = replayDelay == null ? Duration.ofMillis(350) : replayDelay;
            maxTokens = maxTokens == null ? 4096 : maxTokens;
        }
    }

    /**
     * enabled=false: act as if no credentials existed (tests, forced offline demo).
     * fallbackModelId: second model for the agents; empty = the extraction model.
     */
    public record Bedrock(Boolean enabled, String fallbackModelId, Duration callTimeout) {

        public Bedrock {
            enabled = enabled == null || enabled;
            callTimeout = callTimeout == null ? Duration.ofSeconds(120) : callTimeout;
        }
    }
}
