package ro.greenstruct.agro.orchestration;

import java.time.Instant;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonInclude;

/** A document the officer asked for; shown to the farmer (PendingDocument in contracts/openapi.yaml). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PendingDocument(String docType, String labelRo, String conditionId, LocalDate dueDate,
                              Instant requestedAt) {
}
