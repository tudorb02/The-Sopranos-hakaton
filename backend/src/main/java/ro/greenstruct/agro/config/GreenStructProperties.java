package ro.greenstruct.agro.config;

import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("greenstruct")
public record GreenStructProperties(Paths paths, Agents agents, Cors cors, String analysisDate, String mode,
                                    Bedrock bedrock, Anaf anaf) {

    /** mode: LIVE = Bedrock only, HYBRID = Bedrock with cache/golden fallback, REPLAY = recorded runs only. */
    public GreenStructProperties {
        mode = mode == null || mode.isBlank() ? "HYBRID" : mode;
        if (!List.of("LIVE", "HYBRID", "REPLAY").contains(mode)) {
            throw new IllegalArgumentException("greenstruct.mode must be LIVE, HYBRID or REPLAY, was " + mode);
        }
        anaf = anaf == null ? new Anaf(false, null, null, null, null, null) : anaf;
    }

    /** Date used for eligibility (open sessions, years since installation) and schedules; empty = today. */
    public LocalDate today() {
        return analysisDate == null || analysisDate.isBlank()
                ? LocalDate.now(ZoneId.of("Europe/Bucharest"))
                : LocalDate.parse(analysisDate);
    }

    /**
     * config = thresholds/rates/programmes, data = catalogs and demo data, uploads = stored documents.
     * Bound as strings: Spring would resolve a Path property against the classpath when running from the jar.
     */
    public record Paths(String config, String data, String uploads) {

        public Path configDir() {
            return Path.of(config);
        }

        public Path dataDir() {
            return Path.of(data);
        }

        public Path uploadsDir() {
            return Path.of(uploads);
        }
    }

    public record Agents(Duration timeout) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    /** Model ids are Bedrock inference profiles; empty until the AI engineer configures them. */
    public record Bedrock(String region, String agentModelId, String extractionModelId) {
    }

    /**
     * Public ANAF web services (no key): VAT register for identity and fiscal status, balance sheets for turnover.
     * minInterval keeps us under ANAF's limit of one request per second; cacheTtl avoids asking twice per demo.
     */
    public record Anaf(boolean enabled, String baseUrl, Duration connectTimeout, Duration readTimeout,
                       Duration minInterval, Duration cacheTtl) {

        public Anaf {
            baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://webservicesp.anaf.ro" : baseUrl;
            connectTimeout = connectTimeout == null ? Duration.ofSeconds(3) : connectTimeout;
            readTimeout = readTimeout == null ? Duration.ofSeconds(8) : readTimeout;
            minInterval = minInterval == null ? Duration.ofSeconds(1) : minInterval;
            cacheTtl = cacheTtl == null ? Duration.ofHours(12) : cacheTtl;
        }
    }
}
