package ro.greenstruct.agro.bedrock;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;

/**
 * True when Bedrock can be called: not disabled with greenstruct.bedrock.enabled=false, and either a Bedrock
 * API key (AWS_BEARER_TOKEN_BEDROCK, from the environment or the .env import) or AWS credentials from the
 * default chain (profile, environment) exist. Otherwise no Bedrock bean is created and the app runs offline.
 */
public class BedrockAvailableCondition implements Condition {

    public static final String API_KEY_VARIABLE = "AWS_BEARER_TOKEN_BEDROCK";

    /** The key if one is configured, else null (then the default credentials chain applies). */
    public static String apiKey(Environment environment) {
        String key = environment.getProperty(API_KEY_VARIABLE);
        return key == null || key.isBlank() ? null : key.strip();
    }

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        Environment environment = context.getEnvironment();
        if (!environment.getProperty("greenstruct.bedrock.enabled", Boolean.class, true)) {
            return false;
        }
        return apiKey(environment) != null || defaultCredentialsExist();
    }

    private static boolean defaultCredentialsExist() {
        try (DefaultCredentialsProvider provider = DefaultCredentialsProvider.builder().build()) {
            return provider.resolveCredentials() != null;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
