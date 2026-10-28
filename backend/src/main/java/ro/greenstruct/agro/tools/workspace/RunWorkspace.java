package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.GreenTierResult;

/**
 * Working memory of one dossier shared by the three agents' tools: parsed documents, the baseline,
 * configurations, eligibility results, the green tier and financing options. Only tools write here.
 */
public class RunWorkspace {

    private final Map<String, DocumentFacts> documents = new LinkedHashMap<>();
    private final Map<String, JsonNode> extractions = new LinkedHashMap<>();
    private final Map<String, Configuration> configurations = new LinkedHashMap<>();
    private final Map<String, FinancingOption> options = new LinkedHashMap<>();
    private final Map<String, JsonNode> programChecks = new LinkedHashMap<>();
    private Map<String, BigDecimal> baseline;
    private GreenTierResult greenTier;

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

    public synchronized void putGreenTier(GreenTierResult tier) {
        this.greenTier = tier;
    }

    public synchronized GreenTierResult greenTier() {
        if (greenTier == null) {
            throw new IllegalArgumentException("Apelează întâi determine_green_tier");
        }
        return greenTier;
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
}
