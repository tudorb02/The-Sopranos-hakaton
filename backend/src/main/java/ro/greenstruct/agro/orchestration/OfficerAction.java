package ro.greenstruct.agro.orchestration;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

/** What the Raiffeisen officer did on the dossier (OfficerAction in contracts/openapi.yaml). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OfficerAction(Action action, Instant at, String officerId, String commentRo) {

    public enum Action { APPROVE, REQUEST_DOCUMENTS }
}
