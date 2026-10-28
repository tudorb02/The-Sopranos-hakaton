package ro.greenstruct.agro.bedrock;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.type.AnnotatedTypeMetadata;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProviderChain;
import software.amazon.awssdk.auth.credentials.ContainerCredentialsProvider;
import software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider;
import software.amazon.awssdk.auth.credentials.ProfileCredentialsProvider;
import software.amazon.awssdk.auth.credentials.SystemPropertyCredentialsProvider;
import software.amazon.awssdk.auth.credentials.WebIdentityTokenFileCredentialsProvider;

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

    /**
     * The default chain without the EC2 metadata step, which only adds seconds of timeout on a laptop
     * without AWS: system properties, environment, web identity, profile (~/.aws), container.
     */
    public static AwsCredentialsProvider credentialsChain() {
        return AwsCredentialsProviderChain.builder().credentialsProviders(
                SystemPropertyCredentialsProvider.create(), EnvironmentVariableCredentialsProvider.create(),
                WebIdentityTokenFileCredentialsProvider.create(), ProfileCredentialsProvider.create(),
                ContainerCredentialsProvider.builder().build()).build();
    }

    private static boolean defaultCredentialsExist() {
        try {
            return credentialsChain().resolveCredentials() != null;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
