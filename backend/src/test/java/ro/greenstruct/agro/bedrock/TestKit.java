package ro.greenstruct.agro.bedrock;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.bedrock.BedrockGateway.Block;
import ro.greenstruct.agro.bedrock.BedrockGateway.Text;
import ro.greenstruct.agro.bedrock.BedrockGateway.ToolUse;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.orchestration.events.RunEventPublisher;
import ro.greenstruct.agro.orchestration.events.SseHub;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/** Fakes shared by the bedrock tests: a scripted gateway, a tiny tool world with deterministic calcIds. */
final class TestKit {

    static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();
    static final String SUBMIT = "submit_demo";

    private TestKit() {
    }

    /** A schema like the real submit_* ones: $defs + $ref, additionalProperties false. */
    static final String DEMO_SCHEMA = """
            {
              "$schema": "https://json-schema.org/draft/2020-12/schema",
              "$id": "https://contracts.greenstruct.ro/schemas/submit_demo.json",
              "type": "object",
              "additionalProperties": false,
              "required": ["verdict", "savingCalcId"],
              "properties": {
                "verdict": {"type": "string", "enum": ["PASS", "FAIL"]},
                "savingCalcId": {"$ref": "#/$defs/calcRef"},
                "notesRo": {"type": "array", "items": {"$ref": "#/$defs/note"}}
              },
              "$defs": {
                "calcRef": {"type": "string", "pattern": "^calc_[0-9a-f]{12}$"},
                "note": {"type": "object", "additionalProperties": false, "required": ["text"],
                         "properties": {"text": {"type": "string"}, "calcId": {"$ref": "#/$defs/calcRef"}}}
              }
            }
            """;

    static SchemaSupport demoSchemas(Path dir) throws Exception {
        Files.writeString(dir.resolve(SUBMIT + ".json"), DEMO_SCHEMA);
        return new SchemaSupport(dir, MAPPER);
    }

    static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException(e);
        }
    }

    // ---- gateway

    /** Plays back a script: each entry is a Response or a BedrockCallException. Remembers the requests. */
    static final class ScriptedGateway implements BedrockGateway {
        final Deque<Object> script = new ArrayDeque<>();
        final List<Request> requests = new ArrayList<>();

        ScriptedGateway then(Object... entries) {
            script.addAll(List.of(entries));
            return this;
        }

        @Override
        public Response converse(Request request) throws BedrockCallException {
            // snapshot: the loop keeps appending to its message list after the call
            requests.add(new Request(request.modelId(), request.system(), List.copyOf(request.messages()),
                    request.tools(), request.forcedTool(), request.maxTokens()));
            Object next = script.poll();
            if (next == null) {
                throw new IllegalStateException("Script exhausted at call " + requests.size());
            }
            if (next instanceof BedrockCallException e) {
                throw e;
            }
            return (Response) next;
        }
    }

    static BedrockGateway.Response reply(Block... blocks) {
        return new BedrockGateway.Response(List.of(blocks), "tool_use", 10, 10);
    }

    static ToolUse use(String id, String tool, String inputJson) {
        return new ToolUse(id, tool, json(inputJson));
    }

    static Text text(String text) {
        return new Text(text);
    }

    static BedrockCallException failure(BedrockCallException.Kind kind) {
        return new BedrockCallException(kind, kind.name(), null);
    }

    // ---- tools and calcs

    /**
     * Calcs of several runs. Tool "compute" turns {"key": "x"} into a calc tool=compute, key=x; its calcId
     * depends on the run id, like the real CalcStore.
     */
    static final class World {
        final Map<String, Map<String, Calc>> calcsByRun = new LinkedHashMap<>();
        final List<String> executed = new ArrayList<>();

        ToolExecutor executor(String runId) {
            return (tool, input) -> {
                executed.add(runId + ":" + tool + ":" + input);
                if (!tool.equals("compute")) {
                    throw new IllegalArgumentException("Unknown tool: " + tool);
                }
                String key = input.path("key").asText();
                Calc calc = calc(runId, "compute", key);
                calcsByRun.computeIfAbsent(runId, id -> new LinkedHashMap<>()).put(calc.calcId(), calc);
                ObjectNode result = MAPPER.createObjectNode().put("verdict", "OK");
                if (input.has("withExtraction")) {
                    result.set("extraction", MAPPER.createObjectNode().put("documentId", "doc_offer_1"));
                }
                return new ToolOutput(true, List.of(calc), result, null);
            };
        }

        CalcDirectory directory(String runId) {
            return new CalcDirectory() {
                @Override
                public boolean exists(String calcId) {
                    return calcsByRun.getOrDefault(runId, Map.of()).containsKey(calcId);
                }

                @Override
                public Optional<String> nameOf(String calcId) {
                    return Optional.ofNullable(calcsByRun.getOrDefault(runId, Map.of()).get(calcId))
                            .map(c -> CalcDirectory.name(c.tool(), c.key()));
                }

                @Override
                public Optional<String> idOf(String name) {
                    List<Calc> all = new ArrayList<>(calcsByRun.getOrDefault(runId, Map.of()).values());
                    for (int i = all.size() - 1; i >= 0; i--) {
                        if (CalcDirectory.name(all.get(i).tool(), all.get(i).key()).equals(name)) {
                            return Optional.of(all.get(i).calcId());
                        }
                    }
                    return Optional.empty();
                }
            };
        }

        AgentToolbox toolbox() {
            return new AgentToolbox() {
                @Override
                public List<BedrockGateway.ToolSpec> toolsFor(AgentSlot slot) {
                    return List.of(new BedrockGateway.ToolSpec("compute", "Fake tool",
                            json("{\"type\":\"object\",\"properties\":{\"key\":{\"type\":\"string\"}}}")));
                }

                @Override
                public ToolExecutor executorFor(String runId) {
                    return World.this.executor(runId);
                }

                @Override
                public CalcDirectory calcsFor(String runId) {
                    return directory(runId);
                }
            };
        }

        /** The calcId the world assigns to compute/key in this run. */
        String idOf(String runId, String key) {
            return calc(runId, "compute", key).calcId();
        }

        private static Calc calc(String runId, String tool, String key) {
            return new Calc(calcId(runId, tool, key), tool, key, "Eticheta " + key, new BigDecimal("12.5"), Unit.EUR,
                    "12,5 EUR", "f", "s", List.of(), List.of());
        }

        private static String calcId(String runId, String tool, String key) {
            try {
                byte[] hash = MessageDigest.getInstance("SHA-256")
                        .digest((runId + "|" + tool + "|" + key).getBytes(StandardCharsets.UTF_8));
                return "calc_" + HexFormat.of().formatHex(hash).substring(0, 12);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
    }

    // ---- run and events

    static Run run(String demoScenario) {
        StoredDocument doc = new StoredDocument("doc_offer_1", "OFFER", "oferta.pdf", "application/pdf", 10, "abc123", "k");
        return Run.create(new RunRequest("45871203", "irigatii", List.of("p1"), json("{\"q\": 1}"), List.of(doc),
                demoScenario), List.of(), null);
    }

    static Run run(String runId, String demoScenario) {
        Run base = run(demoScenario);
        return new Run(runId, base.status(), base.createdAt(), base.updatedAt(), base.request(),
                base.missingDocuments(), base.farmProfile(), base.agentOutputs(), base.steps(), base.submission(), base.officerActions(),
                base.pendingDocuments(), base.error(), base.monitoring());
    }

    record Events(SseHub hub, AgentContext context, String runId) {

        static Events forRun(String runId, AgentSlot slot) {
            SseHub hub = new SseHub();
            return new Events(hub, new AgentContext(runId, slot, new RunEventPublisher(hub, MAPPER)), runId);
        }

        List<String> types() {
            return hub.history(runId).stream().map(e -> e.type().wireName()).toList();
        }
    }
}
