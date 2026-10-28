package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.engine.pricing.RateBreakdown;

/**
 * Working memory of one dossier shared by the three agents' tools: parsed documents, the baseline,
 * configurations, eligibility results and financing options. Only tools write here.
 */
public class RunWorkspace {

    private final Map<String, DocumentFacts> documents = new LinkedHashMap<>();
    private final Map<String, JsonNode> extractions = new LinkedHashMap<>();
    private final Map<String, Configuration> configurations = new LinkedHashMap<>();
    private final Map<String, FinancingOption> options = new LinkedHashMap<>();
    private final Map<String, JsonNode> programChecks = new LinkedHashMap<>();
    private final Map<String, RateBreakdown> pricing = new LinkedHashMap<>();
    private GreenTierResult tier;
    private Map<String, BigDecimal> baseline;

    public synchronized void putDocument(DocumentFacts facts) {
        documents.put(facts.documentId(), facts);
    }

    /** The model's raw extraction (submit_offer_extraction), shown in RunView.agents.extractions. */
    public synchronized void putExtraction(String documentId, JsonNode extraction) {
        extractions.put(documentId, extraction);
    }

    public synchronized List<JsonNode> extractions() {
        return List.copyOf(extractions.values());
    }

    public synchronized Optional<DocumentFacts> document(String documentId) {
        return Optional.ofNullable(documents.get(documentId));
    }

    public synchronized Optional<DocumentFacts> documentOfType(String docType) {
        return documents.values().stream().filter(d -> d.docType().equals(docType)).findFirst();
    }

    public synchronized void putBaseline(Map<String, BigDecimal> metrics) {
        this.baseline = Map.copyOf(metrics);
    }

    public synchronized Map<String, BigDecimal> baseline() {
        if (baseline == null) {
            throw new IllegalArgumentException("Apelează întâi compute_baseline");
        }
        return baseline;
    }

    public synchronized void putConfiguration(Configuration configuration) {
        configurations.put(configuration.configId(), configuration);
    }

    public synchronized Configuration configuration(String configId) {
        Configuration configuration = configurations.get(configId);
        if (configuration == null) {
            throw new IllegalArgumentException("Configurația " + configId + " nu există; configurații: "
                    + configurations.keySet());
        }
        return configuration;
    }

    public synchronized void putProgramCheck(String programCode, JsonNode check) {
        programChecks.put(programCode, check);
    }

    public synchronized Optional<JsonNode> programCheck(String programCode) {
        return Optional.ofNullable(programChecks.get(programCode));
    }

    public synchronized void putOption(FinancingOption option) {
        options.put(option.optionId(), option);
    }

    public synchronized FinancingOption option(String optionId) {
        FinancingOption option = options.get(optionId);
        if (option == null) {
            throw new IllegalArgumentException("Opțiunea " + optionId + " nu există; apelează întâi build_funding_stack");
        }
        return option;
    }

    /** The green tier decided by determine_green_tier (README §4 step 8). */
    public synchronized void putTier(GreenTierResult result) {
        this.tier = result;
    }

    public synchronized GreenTierResult tier() {
        if (tier == null) {
            throw new IllegalArgumentException("Apelează întâi determine_green_tier");
        }
        return tier;
    }

    public synchronized boolean hasTier() {
        return tier != null;
    }

    /** The rate by component per variant, CLASIC or VERDE, set by price_loan. */
    public synchronized void putPricing(String variant, RateBreakdown rate) {
        pricing.put(variant, rate);
    }

    public synchronized Optional<RateBreakdown> pricing(String variant) {
        return Optional.ofNullable(pricing.get(variant));
    }
}
