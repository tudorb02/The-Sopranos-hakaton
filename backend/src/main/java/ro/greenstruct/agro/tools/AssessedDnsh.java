package ro.greenstruct.agro.tools;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.orchestration.AgentSlot;

/**
 * The overall DNSH status of the dossier: the tool input dnshStatus when the model sends one, else the worst
 * status of the technical auditor's dnshChecks (submit_technical_assessment).
 */
public final class AssessedDnsh {

    public static final String INPUT_SCHEMA = """
            "dnshStatus": {"type": "string", "enum": ["PASS", "PASS_WITH_CONDITIONS", "MISSING_DATA", "FAIL"],
              "description": "Overall DNSH; defaults to the worst status in the technical assessment's dnshChecks."}""";

    private AssessedDnsh() {
    }

    public static DnshStatus overall(ToolContext context, JsonNode input) {
        if (input.hasNonNull("dnshStatus")) {
            return parse(input.path("dnshStatus").asText());
        }
        JsonNode checks = context.run().agentOutputs()
                .getOrDefault(AgentSlot.TECHNICAL_AUDITOR, MissingNode.getInstance()).path("dnshChecks");
        if (!checks.isArray() || checks.isEmpty()) {
            throw new IllegalArgumentException("DNSH status missing: send dnshStatus or wait for the "
                    + "technical auditor's assessment");
        }
        List<DnshStatus> statuses = new ArrayList<>();
        checks.forEach(check -> statuses.add(parse(check.path("status").asText())));
        return DnshStatus.overall(statuses);
    }

    private static DnshStatus parse(String status) {
        for (DnshStatus value : DnshStatus.values()) {
            if (value.name().equals(status)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown DNSH status: " + status);
    }
}
