package ro.greenstruct.agro.orchestration;

public class RunNotFoundException extends RuntimeException {

    public RunNotFoundException(String runId) {
        super("Dossier " + runId + " does not exist");
    }
}
