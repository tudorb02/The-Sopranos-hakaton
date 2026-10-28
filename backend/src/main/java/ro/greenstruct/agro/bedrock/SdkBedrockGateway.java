package ro.greenstruct.agro.bedrock;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import software.amazon.awssdk.auth.token.credentials.SdkToken;
import software.amazon.awssdk.auth.token.credentials.StaticTokenProvider;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.awscore.retry.AwsRetryStrategy;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.document.Document;
import software.amazon.awssdk.core.exception.ApiCallAttemptTimeoutException;
import software.amazon.awssdk.core.exception.ApiCallTimeoutException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.auth.scheme.BedrockRuntimeAuthSchemeProvider;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.DocumentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.DocumentSource;
import software.amazon.awssdk.services.bedrockruntime.model.InferenceConfiguration;
import software.amazon.awssdk.services.bedrockruntime.model.ModelTimeoutException;
import software.amazon.awssdk.services.bedrockruntime.model.SpecificToolChoice;
import software.amazon.awssdk.services.bedrockruntime.model.SystemContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ThrottlingException;
import software.amazon.awssdk.services.bedrockruntime.model.Tool;
import software.amazon.awssdk.services.bedrockruntime.model.ToolChoice;
import software.amazon.awssdk.services.bedrockruntime.model.ToolConfiguration;
import software.amazon.awssdk.services.bedrockruntime.model.ToolInputSchema;
import software.amazon.awssdk.services.bedrockruntime.model.ToolResultBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ToolResultContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ToolSpecification;
import software.amazon.awssdk.services.bedrockruntime.model.ToolUseBlock;

/**
 * Converse over the AWS SDK v2. Authenticates with a Bedrock API key when one is given (passed explicitly
 * because Spring's .env import does not export it as an environment variable), otherwise with the default
 * credentials chain.
 */
public class SdkBedrockGateway implements BedrockGateway {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private final BedrockRuntimeClient client;
    private final ObjectMapper mapper;

    SdkBedrockGateway(BedrockRuntimeClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    /** apiKey null/blank = default credentials chain. */
    public static SdkBedrockGateway create(String region, String apiKey, Duration callTimeout, ObjectMapper mapper) {
        var http = ApacheHttpClient.builder().socketTimeout(callTimeout).connectionTimeout(Duration.ofSeconds(5));
        var builder = BedrockRuntimeClient.builder()
                .region(Region.of(region))
                .httpClientBuilder(http)
                .overrideConfiguration(config -> config
                        // our loop retries and tells the timeline; the SDK must not retry silently
                        .retryStrategy(AwsRetryStrategy.doNotRetry())
                        .apiCallTimeout(callTimeout.plusSeconds(10)));
        if (apiKey == null || apiKey.isBlank()) {
            builder.credentialsProvider(BedrockAvailableCondition.credentialsChain());
        } else {
            builder.tokenProvider(StaticTokenProvider.create(new ApiKey(apiKey.strip())))
                    // without this preference the SDK still tries SigV4 first and asks for AWS credentials
                    .authSchemeProvider(BedrockRuntimeAuthSchemeProvider.defaultProvider(List.of("httpBearerAuth")));
        }
        return new SdkBedrockGateway(builder.build(), mapper);
    }

    private record ApiKey(String token) implements SdkToken {

        @Override
        public Optional<Instant> expirationTime() {
            return Optional.empty();
        }
    }

    @Override
    public Response converse(Request request) throws BedrockCallException {
        try {
            ConverseResponse response = client.converse(toSdk(request));
            return fromSdk(response);
        } catch (ThrottlingException e) {
            throw new BedrockCallException(BedrockCallException.Kind.THROTTLED, summary(e), e);
        } catch (ModelTimeoutException | ApiCallTimeoutException | ApiCallAttemptTimeoutException e) {
            throw new BedrockCallException(BedrockCallException.Kind.TIMEOUT, summary(e), e);
        } catch (AwsServiceException e) {
            int status = e.statusCode();
            BedrockCallException.Kind kind = status == 429 ? BedrockCallException.Kind.THROTTLED
                    : status == 408 || status == 504 ? BedrockCallException.Kind.TIMEOUT
                    : status >= 500 ? BedrockCallException.Kind.UNAVAILABLE : BedrockCallException.Kind.REJECTED;
            throw new BedrockCallException(kind, summary(e), e);
        } catch (SdkClientException e) {
            boolean timeout = hasCause(e, SocketTimeoutException.class);
            throw new BedrockCallException(timeout ? BedrockCallException.Kind.TIMEOUT
                    : BedrockCallException.Kind.NO_NETWORK, summary(e), e);
        }
    }

    private static String summary(Exception e) {
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return message.length() > 300 ? message.substring(0, 300) : message;
    }

    private static boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (type.isInstance(t)) {
                return true;
            }
        }
        return false;
    }

    // ---- request mapping

    ConverseRequest toSdk(Request request) {
        ConverseRequest.Builder builder = ConverseRequest.builder()
                .modelId(request.modelId())
                .messages(request.messages().stream().map(this::message).toList())
                .inferenceConfig(InferenceConfiguration.builder().maxTokens(request.maxTokens()).build());
        if (request.system() != null && !request.system().isBlank()) {
            builder.system(SystemContentBlock.builder().text(request.system()).build());
        }
        if (request.tools() != null && !request.tools().isEmpty()) {
            ToolConfiguration.Builder tools = ToolConfiguration.builder()
                    .tools(request.tools().stream().map(this::tool).toList());
            if (request.forcedTool() != null) {
                tools.toolChoice(ToolChoice.builder()
                        .tool(SpecificToolChoice.builder().name(request.forcedTool()).build()).build());
            }
            builder.toolConfig(tools.build());
        }
        return builder.build();
    }

    private Tool tool(ToolSpec spec) {
        return Tool.fromToolSpec(ToolSpecification.builder().name(spec.name()).description(spec.description())
                .inputSchema(ToolInputSchema.fromJson(toDocument(spec.inputSchema()))).build());
    }

    private software.amazon.awssdk.services.bedrockruntime.model.Message message(Message message) {
        return software.amazon.awssdk.services.bedrockruntime.model.Message.builder()
                .role("assistant".equals(message.role()) ? ConversationRole.ASSISTANT : ConversationRole.USER)
                .content(message.blocks().stream().map(this::block).toList()).build();
    }

    private ContentBlock block(Block block) {
        return switch (block) {
            case Text text -> ContentBlock.fromText(text.text());
            case ToolUse use -> ContentBlock.fromToolUse(ToolUseBlock.builder().toolUseId(use.id()).name(use.name())
                    .input(toDocument(use.input())).build());
            case ToolResult result -> ContentBlock.fromToolResult(ToolResultBlock.builder()
                    .toolUseId(result.toolUseId())
                    .content(ToolResultContentBlock.fromJson(toDocument(result.content())))
                    .status(result.error() ? "error" : "success").build());
            case Attachment doc -> ContentBlock.fromDocument(DocumentBlock.builder()
                    .format(doc.format()).name(doc.name())
                    .source(DocumentSource.fromBytes(SdkBytes.fromByteArray(doc.bytes()))).build());
        };
    }

    // ---- response mapping

    Response fromSdk(ConverseResponse response) {
        List<Block> blocks = new ArrayList<>();
        if (response.output() != null && response.output().message() != null) {
            for (ContentBlock content : response.output().message().content()) {
                if (content.text() != null) {
                    blocks.add(new Text(content.text()));
                } else if (content.toolUse() != null) {
                    ToolUseBlock use = content.toolUse();
                    blocks.add(new ToolUse(use.toolUseId(), use.name(), toJson(use.input())));
                }
            }
        }
        int in = response.usage() == null || response.usage().inputTokens() == null ? 0 : response.usage().inputTokens();
        int out = response.usage() == null || response.usage().outputTokens() == null ? 0 : response.usage().outputTokens();
        return new Response(blocks, response.stopReasonAsString(), in, out);
    }

    // ---- JsonNode <-> Document

    Document toDocument(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return Document.fromNull();
        }
        if (node.isObject()) {
            Map<String, Document> map = new LinkedHashMap<>();
            node.fields().forEachRemaining(entry -> map.put(entry.getKey(), toDocument(entry.getValue())));
            return Document.fromMap(map);
        }
        if (node.isArray()) {
            List<Document> list = new ArrayList<>();
            node.forEach(item -> list.add(toDocument(item)));
            return Document.fromList(list);
        }
        if (node.isBoolean()) {
            return Document.fromBoolean(node.booleanValue());
        }
        if (node.isNumber()) {
            return Document.fromNumber(node.decimalValue());
        }
        return Document.fromString(node.asText());
    }

    JsonNode toJson(Document document) {
        if (document == null || document.isNull()) {
            return JSON.nullNode();
        }
        if (document.isMap()) {
            ObjectNode object = JSON.objectNode();
            document.asMap().forEach((key, value) -> object.set(key, toJson(value)));
            return object;
        }
        if (document.isList()) {
            ArrayNode array = JSON.arrayNode();
            document.asList().forEach(item -> array.add(toJson(item)));
            return array;
        }
        if (document.isBoolean()) {
            return JSON.booleanNode(document.asBoolean());
        }
        if (document.isNumber()) {
            return JSON.numberNode(document.asNumber().bigDecimalValue());
        }
        return JSON.textNode(document.asString());
    }
}
