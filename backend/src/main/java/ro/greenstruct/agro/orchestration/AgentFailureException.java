package ro.greenstruct.agro.orchestration;

/**
 * Thrown by an agent when it cannot produce a valid output. errorCode is one of the run.failed codes in
 * contracts/schemas/event.json (AGENT_INVALID_OUTPUT, AGENT_MAX_ITERATIONS, BEDROCK_UNAVAILABLE, ...).
 */
public class AgentFailureException extends RuntimeException {

    private final String errorCode;
    private final boolean retryable;

    public AgentFailureException(String errorCode, String messageRo, boolean retryable, Throwable cause) {
        super(messageRo, cause);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public String errorCode() {
        return errorCode;
    }

    public boolean retryable() {
        return retryable;
    }
}
