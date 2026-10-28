package ro.greenstruct.agro.bedrock;

/** A failed Converse call, classified so the loop knows whether to retry, switch model or give up. */
public class BedrockCallException extends Exception {

    public enum Kind {
        /** 429 / ThrottlingException: retry with backoff. */
        THROTTLED("THROTTLED", true),
        /** Model or client timeout: retry. */
        TIMEOUT("TIMEOUT", true),
        /** 5xx, model not ready: retry. */
        UNAVAILABLE("UNAVAILABLE", true),
        /** No route to AWS: retry, then fall back. */
        NO_NETWORK("NO_NETWORK", true),
        /** 4xx (bad credentials, access denied, validation): retrying the same call cannot help. */
        REJECTED("UNAVAILABLE", false);

        private final String eventReason;
        private final boolean retryable;

        Kind(String eventReason, boolean retryable) {
            this.eventReason = eventReason;
            this.retryable = retryable;
        }

        /** Value for agent.degraded data.reason in contracts/schemas/event.json. */
        public String eventReason() {
            return eventReason;
        }

        public boolean retryable() {
            return retryable;
        }
    }

    private final Kind kind;

    public BedrockCallException(Kind kind, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}
