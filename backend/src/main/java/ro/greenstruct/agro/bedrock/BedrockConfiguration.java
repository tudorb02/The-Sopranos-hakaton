package ro.greenstruct.agro.bedrock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import com.fasterxml.jackson.databind.ObjectMapper;

import ro.greenstruct.agro.api.BedrockHealthProbe;
import ro.greenstruct.agro.config.GreenStructProperties;

/**
 * The Bedrock client and its health probe. Both exist only when Bedrock can be called (API key or AWS
 * credentials, see BedrockAvailableCondition); without them the app still starts and runs from recordings.
 */
@Configuration
public class BedrockConfiguration {

    @Bean
    @Conditional(BedrockAvailableCondition.class)
    BedrockGateway bedrockGateway(Environment environment, GreenStructProperties properties,
                                  AgentRuntimeProperties runtime, ObjectMapper mapper) {
        String region = properties.bedrock() == null || properties.bedrock().region() == null
                || properties.bedrock().region().isBlank() ? "us-west-2" : properties.bedrock().region();
        return SdkBedrockGateway.create(region, BedrockAvailableCondition.apiKey(environment),
                runtime.bedrock().callTimeout(), mapper);
    }

    @Bean
    @Conditional(BedrockAvailableCondition.class)
    BedrockHealthProbe bedrockHealthProbe(BedrockGateway gateway, GreenStructProperties properties,
                                          AgentRuntimeProperties runtime) {
        return new BedrockModelHealthProbe(gateway, BedrockModels.from(properties, runtime));
    }
}
