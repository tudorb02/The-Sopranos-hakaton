package ro.greenstruct.agro.bedrock;

import java.util.List;

import ro.greenstruct.agro.config.GreenStructProperties;

/**
 * The model ids in use. agent = tool-using agents (default Sonnet), extraction = PDF reading (default Haiku),
 * fallback = second model for the agents when the first keeps failing (default: the extraction model).
 */
public record BedrockModels(String agent, String extraction, String fallback) {

    public static final String DEFAULT_AGENT = "us.anthropic.claude-sonnet-5-5";
    public static final String DEFAULT_EXTRACTION = "us.anthropic.claude-haiku-5-5";

    public static BedrockModels from(GreenStructProperties properties, AgentRuntimeProperties runtime) {
        String agent = orDefault(properties.bedrock() == null ? null : properties.bedrock().agentModelId(), DEFAULT_AGENT);
        String extraction = orDefault(properties.bedrock() == null ? null : properties.bedrock().extractionModelId(),
                DEFAULT_EXTRACTION);
        String fallback = orDefault(runtime.bedrock().fallbackModelId(), extraction);
        return new BedrockModels(agent, extraction, fallback);
    }

    /** Primary first; the fallback is left out when it is the same model. */
    public List<String> agentModels() {
        return agent.equals(fallback) ? List.of(agent) : List.of(agent, fallback);
    }

    private static String orDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
