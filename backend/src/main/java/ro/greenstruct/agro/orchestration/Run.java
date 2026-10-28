package ro.greenstruct.agro.orchestration;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.farm.FarmProfile;

/**
 * Immutable state of one dossier. Agents only see this object: each agent reads the previous agents'
 * outputs from agentOutputs and its own output is stored there when it finishes. The API exposes it
 * through RunView (contracts/openapi.yaml).
 */
public record Run(
        String id,
        RunStatus status,
        Instant createdAt,
        Instant updatedAt,
        RunRequest request,
        List<String> missingDocuments,
        FarmProfile farmProfile,
        Map<AgentSlot, JsonNode> agentOutputs,
        List<StepRecord> steps,
        List<OfficerAction> officerActions,
        List<PendingDocument> pendingDocuments,
        RunError error,
        String chosenVariant,
        JsonNode monitoring) {

    public Run {
        missingDocuments = List.copyOf(missingDocuments);
        agentOutputs = agentOutputs.isEmpty() ? Map.of() : new EnumMap<>(agentOutputs);
        steps = List.copyOf(steps);
        officerActions = List.copyOf(officerActions);
        pendingDocuments = List.copyOf(pendingDocuments);
    }

    public static Run create(RunRequest request, List<String> missingDocuments, FarmProfile farmProfile) {
        Instant now = Instant.now();
        return new Run(newId(), RunStatus.CREAT, now, now, request, missingDocuments, farmProfile, Map.of(), List.of(),
                List.of(), List.of(), null, null, null);
    }

    /** run_ + 12 base-36 characters, as required by contracts/schemas/event.json. */
    private static String newId() {
        String random = Long.toString(UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE, 36);
        return "run_" + (random + "000000000000").substring(0, 12);
    }

    public Run withStatus(RunStatus next) {
        if (!status.canMoveTo(next)) {
            throw new IllegalStateException("Dosarul nu poate trece din " + status + " în " + next);
        }
        return new Run(id, next, createdAt, Instant.now(), request, missingDocuments, farmProfile, agentOutputs, steps,
                officerActions, pendingDocuments, error, chosenVariant, monitoring);
    }

    public Run withFarmProfile(FarmProfile profile) {
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, profile, agentOutputs, steps,
                officerActions, pendingDocuments, error, chosenVariant, monitoring);
    }

    public Run withAgentOutput(AgentSlot slot, JsonNode output) {
        Map<AgentSlot, JsonNode> outputs = new EnumMap<>(AgentSlot.class);
        outputs.putAll(agentOutputs);
        outputs.put(slot, output);
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, farmProfile, outputs, steps,
                officerActions, pendingDocuments, error, chosenVariant, monitoring);
    }

    public Run withStep(StepRecord step) {
        List<StepRecord> all = new ArrayList<>(steps);
        all.add(step);
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, farmProfile, agentOutputs, all,
                officerActions, pendingDocuments, error, chosenVariant, monitoring);
    }

    public Run withOfficerAction(OfficerAction action, List<PendingDocument> newPendingDocuments) {
        List<OfficerAction> actions = new ArrayList<>(officerActions);
        actions.add(action);
        List<PendingDocument> pending = new ArrayList<>(pendingDocuments);
        pending.addAll(newPendingDocuments);
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, farmProfile, agentOutputs,
                steps, actions, pending, error, chosenVariant, monitoring);
    }

    /** The variant the farmer sends to the bank: CLASIC or VERDE (POST /submit). */
    public Run withChosenVariant(String variant) {
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, farmProfile, agentOutputs, steps,
                officerActions, pendingDocuments, error, variant, monitoring);
    }

    /** Result of "Simulează 12 luni" (MonitoringResult in contracts/openapi.yaml). */
    public Run withMonitoring(JsonNode result) {
        return new Run(id, status, createdAt, Instant.now(), request, missingDocuments, farmProfile, agentOutputs, steps,
                officerActions, pendingDocuments, error, chosenVariant, result);
    }

    public Run failed(RunError reason) {
        return new Run(id, RunStatus.ESUAT, createdAt, Instant.now(), request, missingDocuments, farmProfile,
                agentOutputs, steps, officerActions, pendingDocuments, reason, chosenVariant, monitoring);
    }
}
