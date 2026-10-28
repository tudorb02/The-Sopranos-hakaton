package ro.greenstruct.agro.api;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.farm.FarmProfile;
import ro.greenstruct.agro.orchestration.OfficerAction;
import ro.greenstruct.agro.orchestration.PendingDocument;
import ro.greenstruct.agro.orchestration.Submission;
import ro.greenstruct.agro.tools.Calc;

/**
 * GET /api/runs/{id} (RunView in contracts/openapi.yaml). Nullable fields (scenario, submission, error, the
 * agents' outputs) are always present; optional ones inside nested objects are omitted when empty.
 */
public record RunView(
        String runId,
        String cui,
        String moduleId,
        String scenario,
        String state,
        String mode,
        JsonNode monitoring,
        Instant createdAt,
        Instant updatedAt,
        long lastEventSeq,
        FarmProfile farm,
        List<String> parcelIds,
        List<Document> documents,
        JsonNode questionnaire,
        List<AgentStatus> agentStatus,
        Agents agents,
        Map<String, Calc> calcs,
        Submission submission,
        List<OfficerAction> officerActions,
        List<PendingDocument> pendingDocuments,
        Error error) {

    public record Document(String documentId, String docType, String fileName, long sizeBytes) {
    }

    /** status: PENDING, RUNNING, COMPLETED, DEGRADED (finished on a fallback) or FAILED. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AgentStatus(String agent, String status, String source, Instant startedAt, Instant completedAt) {
    }

    public record Agents(List<JsonNode> extractions, JsonNode technicalAssessment, JsonNode fundingRecommendation,
                         JsonNode underwritingReport) {
    }

    public record Error(String code, String message, String failedStep) {
    }
}
