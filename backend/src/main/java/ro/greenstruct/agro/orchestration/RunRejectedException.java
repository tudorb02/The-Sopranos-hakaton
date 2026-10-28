package ro.greenstruct.agro.orchestration;

/**
 * A dossier that cannot be created: the CUI is unknown (FARM_NOT_FOUND) or the module is not ready for a
 * full analysis yet (MODULE_NOT_READY). The API maps the reason to 404 or 422.
 */
public class RunRejectedException extends RuntimeException {

    public enum Reason { FARM_NOT_FOUND, MODULE_NOT_READY }

    private final Reason reason;

    public RunRejectedException(Reason reason, String messageRo) {
        super(messageRo);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
