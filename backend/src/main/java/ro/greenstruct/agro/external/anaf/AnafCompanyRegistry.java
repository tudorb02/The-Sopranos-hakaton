package ro.greenstruct.agro.external.anaf;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.external.CompanyRegistryPort;
import ro.greenstruct.agro.external.Cui;
import ro.greenstruct.agro.external.UpstreamUnavailableException;
import ro.greenstruct.agro.external.anaf.AnafCompanyMapper.AnafCompany;
import ro.greenstruct.agro.external.mock.MockDataSources;
import ro.greenstruct.agro.external.model.CompanyRecord;
import ro.greenstruct.agro.external.model.DataSourceInfo;
import ro.greenstruct.agro.modules.ReferenceData;

/**
 * Company data for a CUI: the demo farms keep their files (they are fictional and unknown to ANAF), every other
 * CUI is looked up at ANAF. Answers are cached; when ANAF is down a cached answer is served with mode CACHE.
 */
@Primary
@Component
public class AnafCompanyRegistry implements CompanyRegistryPort {

    private static final Logger log = LoggerFactory.getLogger(AnafCompanyRegistry.class);

    private final AnafClient anaf;
    private final MockDataSources demo;
    private final GreenStructProperties properties;
    private final ReferenceData reference;
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(AnafCompany company, Instant fetchedAt) {
    }

    public AnafCompanyRegistry(AnafClient anaf, MockDataSources demo, GreenStructProperties properties,
                               ReferenceData reference) {
        this.anaf = anaf;
        this.demo = demo;
        this.properties = properties;
        this.reference = reference;
    }

    @Override
    public Optional<CompanyRecord> company(String rawCui) {
        String cui = Cui.normalize(rawCui);
        if (!properties.anaf().enabled() || demo.isDemoFarm(cui)) {
            return demo.company(cui);
        }
        if (!cui.matches("[0-9]{2,10}")) {
            throw new IllegalArgumentException("CUI-ul „" + rawCui + "” nu este valid: are între 2 și 10 cifre");
        }
        Cached cached = cache.get(cui);
        if (cached != null && cached.fetchedAt().plus(properties.anaf().cacheTtl()).isAfter(Instant.now())) {
            return Optional.of(record(cached, "CACHE"));
        }
        try {
            Optional<AnafCompany> fresh = fetch(cui);
            if (fresh.isEmpty()) {
                return Optional.empty();
            }
            Cached entry = new Cached(fresh.get(), Instant.now());
            cache.put(cui, entry);
            return Optional.of(record(entry, "LIVE"));
        } catch (UpstreamUnavailableException e) {
            if (cached == null) {
                throw e;
            }
            log.warn("ANAF unavailable, serving the cached answer for {} from {}", cui, cached.fetchedAt());
            return Optional.of(record(cached, "CACHE"));
        }
    }

    private Optional<AnafCompany> fetch(String cui) {
        LocalDate date = lookupDate();
        Optional<JsonNode> vatRecord = anaf.vatRecord(cui, date);
        if (vatRecord.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(AnafCompanyMapper.map(vatRecord.get(), latestBalanceSheet(cui, date.getYear()), ronPerEur(),
                reference.smeRule()));
    }

    /** Balance sheets are filed by the end of May: last year's may not exist yet, so we also try the one before. */
    private JsonNode latestBalanceSheet(String cui, int currentYear) {
        for (int year = currentYear - 1; year >= currentYear - 2; year--) {
            Optional<JsonNode> sheet = anaf.balanceSheet(cui, year);
            if (sheet.isPresent()) {
                return sheet.get();
            }
        }
        return null;
    }

    /** The analysis date, but never in the future: ANAF rejects VAT queries for dates that have not come yet. */
    private LocalDate lookupDate() {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Bucharest"));
        LocalDate analysis = properties.today();
        return analysis.isAfter(today) ? today : analysis;
    }

    private BigDecimal ronPerEur() {
        return reference.factors().path("ronPerEur").path("value").decimalValue();
    }

    private static CompanyRecord record(Cached cached, String mode) {
        if (cached.company().blockedReasonRo() != null) {
            throw new IllegalArgumentException(cached.company().blockedReasonRo());
        }
        return new CompanyRecord(cached.company().info(), new DataSourceInfo("ANAF", mode, cached.fetchedAt()));
    }
}
