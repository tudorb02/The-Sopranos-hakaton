package ro.greenstruct.agro.orchestration;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.storage.StoredDocument;

/**
 * What the farmer submitted in the wizard: questionnaire answers are keyed by the module's questionId.
 * demoScenario is set when the run comes from "Încarcă dosarul demo".
 */
public record RunRequest(
        String cui,
        String moduleId,
        List<String> parcelIds,
        JsonNode questionnaire,
        List<StoredDocument> documents,
        String demoScenario) {

    public RunRequest {
        parcelIds = List.copyOf(parcelIds);
        documents = List.copyOf(documents);
    }
}
