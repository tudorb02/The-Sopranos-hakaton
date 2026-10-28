package ro.greenstruct.agro.orchestration;

/** Why a dossier stopped (RunError in contracts/openapi.yaml); code is one of the run.failed error codes. */
public record RunError(String code, String message, RunStatus failedStep) {
}
