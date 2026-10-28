package ro.greenstruct.agro.external;

/** A real data source (ANAF, later APIA or Open Banking) did not answer and nothing is cached; the API returns 502. */
public class UpstreamUnavailableException extends RuntimeException {

    public UpstreamUnavailableException(String messageRo, Throwable cause) {
        super(messageRo, cause);
    }
}
