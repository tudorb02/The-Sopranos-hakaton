package ro.greenstruct.agro.bedrock;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ro.greenstruct.agro.bedrock.BedrockGateway.Block;
import ro.greenstruct.agro.bedrock.BedrockGateway.Message;
import ro.greenstruct.agro.bedrock.BedrockGateway.Text;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolResult;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolSpec;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolUse;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.tools.ToolOutput;

/**
 * The Converse loop of one agent: the model calls tools, we run them, we send the results back, until it
 * calls the submit tool with an input that passes the schema. Rejected submits go back as tool errors and
 * count as iterations. Throttling and timeouts are retried with backoff, then the second model takes over.
 */
public class ToolLoop {

    private static final Logger log = LoggerFactory.getLogger(ToolLoop.class);

    /** maxAttempts: calls per model before switching to the next one; backoff doubles each attempt. */
    public record Settings(int maxIterations, int maxAttempts, Duration backoff, int maxTokens) {
    }

    /** One agent run. models: primary first, then the fallback (may be a single entry). */
    public record Request(String system, String userMessage, List<ToolSpec> tools, String submitTool,
                          SchemaSupport schemas, ToolExecutor executor, CalcDirectory calcs, List<String> models,
                          AgentContext context) {
    }

    /** source: LIVE, RETRY (a retry was needed) or FALLBACK_MODEL. */
    public record Result(JsonNode output, int iterations, String source, String modelId, List<Recording.Step> steps) {
    }

    @FunctionalInterface
    public interface Sleeper {
        void sleep(Duration duration) throws InterruptedException;
    }

    private final BedrockGateway gateway;
    private final ObjectMapper mapper;
    private final Settings settings;
    private final Sleeper sleeper;
    private final ToolEvents events;

    public ToolLoop(BedrockGateway gateway, ObjectMapper mapper, Settings settings, Sleeper sleeper) {
        this.gateway = gateway;
        this.mapper = mapper;
        this.settings = settings;
        this.sleeper = sleeper;
        this.events = new ToolEvents(mapper);
    }

    public Result run(Request request) throws InterruptedException {
        List<ToolSpec> tools = new ArrayList<>(request.tools());
        tools.add(new ToolSpec(request.submitTool(),
                "Trimite rezultatul final al analizei. Se cheamă o singură dată, la sfârșit; input-ul trebuie să "
                        + "respecte exact schema, iar cifrele sunt referite doar prin calcId.",
                request.schemas().forBedrock(request.submitTool())));

        List<Message> messages = new ArrayList<>();
        messages.add(Message.user(new Text(request.userMessage())));
        List<Recording.Step> steps = new ArrayList<>();
        CallState state = new CallState();

        for (int iteration = 1; iteration <= settings.maxIterations(); iteration++) {
            BedrockGateway.Response response = converse(request, tools, messages, state);
            messages.add(Message.assistant(response.blocks()));

            StringBuilder thought = new StringBuilder();
            List<ToolUse> toolUses = new ArrayList<>();
            for (Block block : response.blocks()) {
                if (block instanceof Text text && !text.text().isBlank()) {
                    thought.append(thought.isEmpty() ? "" : "\n").append(text.text().strip());
                } else if (block instanceof ToolUse use) {
                    toolUses.add(use);
                }
            }
            if (!thought.isEmpty()) {
                request.context().thought(thought.toString(), iteration);
                steps.add(Recording.Step.thought(iteration, thought.toString()));
            }

            if (toolUses.isEmpty()) {
                messages.add(Message.user(new Text("Nu ai apelat nicio unealtă. Continuă cu uneltele disponibile "
                        + "sau încheie acum cu " + request.submitTool() + ".")));
                continue;
            }

            Map<String, ToolResult> results = new HashMap<>();
            for (ToolUse use : toolUses) {
                if (!use.name().equals(request.submitTool())) {
                    results.put(use.id(), runTool(request, use, iteration, steps));
                }
            }
            JsonNode accepted = null;
            for (ToolUse use : toolUses) {
                if (use.name().equals(request.submitTool())) {
                    List<SchemaSupport.Issue> issues = checkSubmit(request, use.input());
                    if (issues.isEmpty() && accepted == null) {
                        accepted = use.input();
                    } else if (!issues.isEmpty()) {
                        results.put(use.id(), rejectSubmit(request, use, issues));
                    }
                }
            }
            if (accepted != null) {
                return new Result(accepted, iteration, state.source(), state.model(request), steps);
            }
            List<Block> reply = new ArrayList<>();
            for (ToolUse use : toolUses) {
                reply.add(results.getOrDefault(use.id(), new ToolResult(use.id(),
                        mapper.createObjectNode().put("error", "Trimite un singur " + request.submitTool() + "."),
                        true)));
            }
            messages.add(Message.user(reply));
        }
        throw new AgentFailureException("AGENT_MAX_ITERATIONS", request.context().slot().label()
                + " nu a ajuns la rezultat în " + settings.maxIterations() + " iterații", true, null);
    }

    // ---- tools and submit

    private ToolResult runTool(Request request, ToolUse use, int iteration, List<Recording.Step> steps) {
        ToolOutput output = events.run(request.context(), request.executor(), use.id(), use.name(), iteration,
                use.input());
        JsonNode extraction = output.result() == null ? null : output.result().get("extraction");
        steps.add(Recording.Step.toolCall(iteration, use.name(), use.input(), extraction));
        return new ToolResult(use.id(), events.forModel(output), !output.ok());
    }

    /** Schema errors plus calcIds that this dossier never produced (the model invented or mistyped them). */
    private List<SchemaSupport.Issue> checkSubmit(Request request, JsonNode input) {
        List<SchemaSupport.Issue> issues = new ArrayList<>(request.schemas().validate(request.submitTool(), input));
        if (issues.isEmpty()) {
            for (String calcId : CalcPlaceholders.calcIds(input)) {
                if (!request.calcs().exists(calcId)) {
                    issues.add(new SchemaSupport.Issue("/", "calcId necunoscut: " + calcId
                            + ". Folosește doar calcId-urile primite de la unelte."));
                }
            }
        }
        return issues;
    }

    private ToolResult rejectSubmit(Request request, ToolUse use, List<SchemaSupport.Issue> issues) {
        ArrayNode errors = mapper.createArrayNode();
        issues.stream().limit(20).forEach(issue -> errors.addObject().put("path", issue.path())
                .put("messageRo", issue.messageRo()));
        String first = issues.getFirst().messageRo();
        request.context().toolResult(use.id(), use.name(), false, 0, mapper.createArrayNode(),
                mapper.createObjectNode().set("errors", errors),
                "⚠️ Output respins de validare: " + first + " Agentul se corectează");
        ObjectNode content = mapper.createObjectNode();
        content.put("ok", false);
        content.put("message", "Rezultatul nu respectă schema. Corectează și cheamă din nou "
                + request.submitTool() + ".");
        content.set("errors", errors);
        return new ToolResult(use.id(), content, true);
    }

    // ---- Converse call with retry and second model

    private final class CallState {
        private int modelIndex;
        private boolean retried;

        String source() {
            return modelIndex > 0 ? "FALLBACK_MODEL" : retried ? "RETRY" : "LIVE";
        }

        String model(Request request) {
            return request.models().get(modelIndex);
        }
    }

    private BedrockGateway.Response converse(Request request, List<ToolSpec> tools, List<Message> messages,
                                             CallState state) throws InterruptedException {
        BedrockCallException last = null;
        while (state.modelIndex < request.models().size()) {
            String model = request.models().get(state.modelIndex);
            Duration wait = settings.backoff();
            for (int attempt = 1; attempt <= settings.maxAttempts(); attempt++) {
                try {
                    return gateway.converse(new BedrockGateway.Request(model, request.system(), messages, tools,
                            null, settings.maxTokens()));
                } catch (BedrockCallException e) {
                    last = e;
                    log.warn("Bedrock call failed ({}) on {} attempt {}: {}", e.kind(), model, attempt, e.getMessage());
                    if (!e.kind().retryable() || attempt == settings.maxAttempts()) {
                        break;
                    }
                    state.retried = true;
                    request.context().degraded("RETRY", e.kind().eventReason(), attempt + 1,
                            "Bedrock a răspuns cu " + e.kind() + "; reîncerc după " + wait.toMillis() + " ms.");
                    sleeper.sleep(wait);
                    wait = wait.multipliedBy(2);
                }
            }
            if (state.modelIndex + 1 < request.models().size()) {
                state.modelIndex++;
                request.context().degraded("FALLBACK_MODEL", last.kind().eventReason(), 1,
                        "Trec pe modelul de rezervă " + request.models().get(state.modelIndex) + ".");
            } else {
                break;
            }
        }
        throw new AgentFailureException("BEDROCK_UNAVAILABLE",
                "Bedrock nu răspunde (" + (last == null ? "fără detalii" : last.kind()) + ")", true, last);
    }
}
