package ro.greenstruct.agro.external.anaf;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.external.UpstreamUnavailableException;

/**
 * The two public ANAF web services we use, both without a key:
 * the VAT register (identity, CAEN, address, VAT and inactive status) and the published balance sheets.
 */
@Component
public class AnafClient {

    static final String VAT_PATH = "/api/PlatitorTvaRest/v9/tva";
    static final String BALANCE_SHEET_PATH = "/bilant";

    private final RestClient http;
    private final Duration minInterval;
    private final ReentrantLock throttle = new ReentrantLock();
    private Instant lastCall = Instant.EPOCH;

    @Autowired
    public AnafClient(RestClient.Builder builder, GreenStructProperties properties) {
        this(builder.baseUrl(properties.anaf().baseUrl()).requestFactory(requestFactory(properties.anaf())).build(),
                properties.anaf().minInterval());
    }

    AnafClient(RestClient http, Duration minInterval) {
        this.http = http;
        this.minInterval = minInterval;
    }

    /** The company's entry in the VAT register on that date; empty when ANAF lists the CUI under notFound. */
    public Optional<JsonNode> vatRecord(String cui, LocalDate date) {
        JsonNode body = call(() -> http.post().uri(VAT_PATH).contentType(MediaType.APPLICATION_JSON)
                .body(List.of(Map.of("cui", Long.parseLong(cui), "data", date.toString())))
                .retrieve().onStatus(AnafClient::isNotFound, (request, response) -> { })
                .body(JsonNode.class));
        JsonNode found = body.path("found");
        return found.isArray() && !found.isEmpty() ? Optional.of(found.get(0)) : Optional.empty();
    }

    /** The balance sheet filed for a year; empty when none was filed (ANAF answers with an empty indicator list). */
    public Optional<JsonNode> balanceSheet(String cui, int year) {
        JsonNode body = call(() -> http.get()
                .uri(uri -> uri.path(BALANCE_SHEET_PATH).queryParam("an", year).queryParam("cui", cui).build())
                .retrieve().onStatus(AnafClient::isNotFound, (request, response) -> { })
                .body(JsonNode.class));
        JsonNode indicators = body.path("i");
        return indicators.isArray() && !indicators.isEmpty() ? Optional.of(body) : Optional.empty();
    }

    /** ANAF answers an unknown CUI with 404 and a normal JSON body ({"found": [], "notFound": [...]}). */
    private static boolean isNotFound(HttpStatusCode status) {
        return status.value() == 404;
    }

    private JsonNode call(Supplier<JsonNode> request) {
        waitForTurn();
        try {
            JsonNode body = request.get();
            if (body == null) {
                throw new UpstreamUnavailableException("ANAF answered without data. Try again in a few seconds.", null);
            }
            return body;
        } catch (RestClientException e) {
            throw new UpstreamUnavailableException("ANAF is not responding right now. Try again in a few seconds.", e);
        }
    }

    /** ANAF allows one request per second; a lock (not synchronized) so waiting virtual threads are not pinned. */
    private void waitForTurn() {
        throttle.lock();
        try {
            Duration wait = Duration.between(Instant.now(), lastCall.plus(minInterval));
            if (wait.isPositive()) {
                Thread.sleep(wait);
            }
            lastCall = Instant.now();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UpstreamUnavailableException("The request to ANAF was interrupted", e);
        } finally {
            throttle.unlock();
        }
    }

    private static JdkClientHttpRequestFactory requestFactory(GreenStructProperties.Anaf anaf) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(anaf.connectTimeout()).build());
        factory.setReadTimeout(anaf.readTimeout());
        return factory;
    }
}
