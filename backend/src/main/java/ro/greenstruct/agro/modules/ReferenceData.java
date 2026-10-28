package ro.greenstruct.agro.modules;

import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;
import ro.greenstruct.agro.engine.sme.SmeRule;

/**
 * Financing lines, EU funding programmes, emission factors, prices, the rate components and the green funds
 * (F1–F6) from config/; every value carries its source. The cross-references between the files are checked at
 * startup, so a renamed id or a guarantee percentage that differs between two files fails fast.
 */
@Component
public class ReferenceData {

    private final JsonNode financingLines;
    private final JsonNode fundingPrograms;
    private final JsonNode factors;
    private final JsonNode prices;
    private final JsonNode pricing;
    private final JsonNode funds;
    private final SmeRule smeRule;

    public ReferenceData(GreenStructProperties properties, ObjectMapper mapper) {
        Path config = properties.paths().configDir();
        this.financingLines = JsonFiles.read(mapper, config.resolve("financing-lines.json"));
        this.fundingPrograms = JsonFiles.read(mapper, config.resolve("funding-programs.json"));
        this.factors = JsonFiles.read(mapper, config.resolve("factors.json"));
        this.prices = JsonFiles.read(mapper, config.resolve("prices.json"));
        this.pricing = JsonFiles.read(mapper, config.resolve("pricing.json"));
        this.funds = JsonFiles.read(mapper, config.resolve("funds.json"));
        checkFundReferences();
        JsonNode sme = funds.path("smeDefinition");
        this.smeRule = new SmeRule(sme.path("employeesBelow").asInt(), sme.path("maxTurnoverEur").decimalValue(),
                sme.path("maxTotalAssetsEur").decimalValue());
    }

    /** The SME definition of config/funds.json, the first requirement of F1 (README §3.2). */
    public SmeRule smeRule() {
        return smeRule;
    }

    public JsonNode financingLines() {
        return financingLines;
    }

    public JsonNode fundingPrograms() {
        return fundingPrograms;
    }

    public JsonNode factors() {
        return factors;
    }

    public JsonNode prices() {
        return prices;
    }

    /** config/pricing.json: the rate components of README §4 step 6 and the green tiers. */
    public JsonNode pricing() {
        return pricing;
    }

    /** config/funds.json: F1–F6, their requirements, the fund and green-bond category per module, the SME rule. */
    public JsonNode funds() {
        return funds;
    }

    private void checkFundReferences() {
        Set<String> fundIds = ids(funds.path("funds"), "fundId");
        Set<String> lineIds = ids(financingLines.path("lines"), "lineId");
        Set<String> programCodes = ids(fundingPrograms.path("programs"), "programCode");
        Set<String> bondCategories = ids(funds.path("bondCategories"), "categoryId");

        for (JsonNode fund : funds.path("funds")) {
            String fundId = fund.path("fundId").asText();
            if (fund.hasNonNull("guaranteeId")) {
                JsonNode guarantee = guarantee(fund.path("guaranteeId").asText());
                if (guarantee == null) {
                    throw invalid(fundId + " refers to an unknown guarantee " + fund.path("guaranteeId").asText());
                }
                if (fund.has("coveragePct")
                        && fund.path("coveragePct").path("value").decimalValue().compareTo(guarantee.path("coveragePct").decimalValue()) != 0) {
                    throw invalid(fundId + " coveragePct differs from guarantee " + guarantee.path("guaranteeId").asText()
                            + " in financing-lines.json");
                }
            }
            for (JsonNode code : fund.path("programCodes")) {
                if (!programCodes.contains(code.asText())) {
                    throw invalid(fundId + " refers to an unknown funding programme " + code.asText());
                }
            }
            if (fund.hasNonNull("cofinancingLineId") && !lineIds.contains(fund.path("cofinancingLineId").asText())) {
                throw invalid(fundId + " refers to an unknown financing line " + fund.path("cofinancingLineId").asText());
            }
        }

        funds.path("modules").fields().forEachRemaining(entry -> {
            JsonNode module = entry.getValue();
            requireKnown(fundIds, module.path("primaryFund").asText(), entry.getKey() + " primaryFund");
            module.path("alternatives").forEach(alternative ->
                    requireKnown(fundIds, alternative.path("fundId").asText(), entry.getKey() + " alternative"));
            module.path("bondCategories").forEach(category ->
                    requireKnown(bondCategories, category.asText(), entry.getKey() + " bond category"));
        });
    }

    private JsonNode guarantee(String guaranteeId) {
        for (JsonNode guarantee : financingLines.path("guarantees")) {
            if (guaranteeId.equals(guarantee.path("guaranteeId").asText())) {
                return guarantee;
            }
        }
        return null;
    }

    private static Set<String> ids(JsonNode items, String field) {
        Set<String> ids = new HashSet<>();
        items.forEach(item -> ids.add(item.path(field).asText()));
        return ids;
    }

    private static void requireKnown(Set<String> known, String id, String what) {
        if (!known.contains(id)) {
            throw invalid(what + " refers to an unknown id " + id);
        }
    }

    private static IllegalStateException invalid(String message) {
        return new IllegalStateException("config/funds.json: " + message);
    }
}
