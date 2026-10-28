package ro.greenstruct.agro.agents.rules;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.bedrock.SchemaSupport;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.tools.CalcStore;

/**
 * Checks of an agent output as the contract sees it: valid against its contracts/schemas/submit_*.json and every
 * calcId (any field called calcId or ending in CalcId) resolves in the CalcStore of that run.
 */
final class OutputChecks {

    private OutputChecks() {
    }

    static List<String> problems(Run run, AgentSlot slot, SchemaSupport schemas, CalcStore calcs) {
        JsonNode output = run.agentOutputs().get(slot);
        List<String> problems = new ArrayList<>();
        if (output == null) {
            problems.add(slot + ": no output");
            return problems;
        }
        schemas.validate(slot.submitTool(), output)
                .forEach(i -> problems.add(slot + " schema " + i.path() + ": " + i.messageRo()));
        collectCalcIds(output, "", run.id(), calcs, problems, slot);
        return problems;
    }

    private static void collectCalcIds(JsonNode node, String path, String runId, CalcStore calcs, List<String> problems,
                                       AgentSlot slot) {
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey();
                JsonNode value = entry.getValue();
                if (value.isTextual() && (key.equals("calcId") || key.endsWith("CalcId"))) {
                    if (calcs.find(runId, value.asText()).isEmpty()) {
                        problems.add(slot + " unknown calcId at " + path + "/" + key + ": " + value.asText());
                    }
                } else if (value.isArray() && key.endsWith("CalcIds")) {
                    value.forEach(id -> {
                        if (calcs.find(runId, id.asText()).isEmpty()) {
                            problems.add(slot + " unknown calcId in " + path + "/" + key + ": " + id.asText());
                        }
                    });
                } else {
                    collectCalcIds(value, path + "/" + key, runId, calcs, problems, slot);
                }
            });
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                collectCalcIds(node.get(i), path + "/" + i, runId, calcs, problems, slot);
            }
        }
    }
}
