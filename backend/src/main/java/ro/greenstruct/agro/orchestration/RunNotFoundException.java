package ro.greenstruct.agro.orchestration;

public class RunNotFoundException extends RuntimeException {

    public RunNotFoundException(String runId) {
        super("Dosarul " + runId + " nu există");
    }
}
