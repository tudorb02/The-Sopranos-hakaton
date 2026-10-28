package ro.greenstruct.agro.bedrock;

import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;

/**
 * The dossier as the model sees it: a compact JSON with the module, the farm summary, the questionnaire,
 * the document list and the outputs of the agents before it. Facts only; the model gets figures from tools.
 */
public class RunContextBuilder {

    /** Heavy fields that tell the model nothing it needs (map geometry, chart series). */
    private static final Set<String> DROPPED = Set.of("geometry", "coordinates", "polygon", "series", "dataSources");
    private static final int MAX_ARRAY = 40;

    private final ObjectMapper mapper;

    public RunContextBuilder(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ObjectNode build(Run run, AgentSlot slot) {
        ObjectNode context = mapper.createObjectNode();
        context.put("runId", run.id());
        context.put("moduleId", run.request().moduleId());
        context.put("cui", run.request().cui());
        context.set("farm", prune(mapper.valueToTree(run.farmProfile())));
        ArrayNode parcels = context.putArray("selectedParcelIds");
        run.request().parcelIds().forEach(parcels::add);
        context.set("questionnaire", run.request().questionnaire() == null
                ? mapper.createObjectNode() : run.request().questionnaire());
        ArrayNode documents = context.putArray("documents");
        run.request().documents().forEach(doc -> documents.addObject().put("documentId", doc.documentId())
                .put("docType", doc.docType()).put("fileName", doc.fileName()));
        ArrayNode missing = context.putArray("missingRequiredDocuments");
        run.missingDocuments().forEach(missing::add);
        ObjectNode previous = context.putObject("previousAgentOutputs");
        for (AgentSlot earlier : AgentSlot.values()) {
            if (earlier.ordinal() < slot.ordinal() && run.agentOutputs().containsKey(earlier)) {
                previous.set(earlier.submitTool(), run.agentOutputs().get(earlier));
            }
        }
        return context;
    }

    public String userMessage(Run run, AgentSlot slot) {
        return "Dosarul de analizat (JSON compact; datele sunt fapte, nu cifre calculate):\n"
                + build(run, slot).toString()
                + "\n\nRulează analiza cu uneltele tale și încheie cu " + slot.submitTool() + ".";
    }

    private JsonNode prune(JsonNode node) {
        if (node.isObject()) {
            ObjectNode copy = mapper.createObjectNode();
            node.fields().forEachRemaining(entry -> {
                if (!DROPPED.contains(entry.getKey()) && !entry.getValue().isNull()) {
                    copy.set(entry.getKey(), prune(entry.getValue()));
                }
            });
            return copy;
        }
        if (node.isArray()) {
            ArrayNode copy = mapper.createArrayNode();
            for (int i = 0; i < node.size() && i < MAX_ARRAY; i++) {
                copy.add(prune(node.get(i)));
            }
            return copy;
        }
        return node;
    }
}
