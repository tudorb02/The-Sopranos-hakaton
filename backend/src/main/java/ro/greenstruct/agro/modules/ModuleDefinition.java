package ro.greenstruct.agro.modules;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * One investment module from config/modules/&lt;moduleId&gt;.json. The first fields follow the Module schema in
 * contracts/openapi.yaml; calculator and everything after it are backend-only (tools, agents, financing, document classification).
 */
public record ModuleDefinition(
        String moduleId,
        String nameRo,
        String icon,
        String status,
        String descriptionRo,
        List<String> examplesRo,
        String indicator,
        Threshold threshold,
        List<RequiredDoc> requiredDocs,
        JsonNode questionnaire,
        String calculator,
        String catalog,
        String substantialContribution,
        List<DnshCheck> dnsh,
        List<String> fundingPrograms,
        Map<String, LabelRule> labels,
        Financing financing,
        JsonNode parameters,
        List<String> detectionKeywords) {

    public boolean demoReady() {
        return calculator != null;
    }

    public record Threshold(String kind, BigDecimal value, String unit, String sourceRo, boolean demo) {
    }

    public record RequiredDoc(String docType, String labelRo, boolean required) {
    }

    /** objective uses the DNSH names from the contract (CLIMATE_ADAPTATION, WATER_MARINE_RESOURCES, ...). */
    public record DnshCheck(String objective, String checkRo, String evidence) {
    }

    /**
     * Label per component category; when = ALWAYS or CONFIG_PASSES (only if the configuration passes the
     * threshold). usedLabel, when set, replaces label for second-hand equipment.
     */
    public record LabelRule(String label, String taxonomyActivity, String when, String usedLabel) {
    }

    public record Financing(int termMonths, int horizonYears, String standardLine, String greenLine,
                            String cofinancingLine, String bridgeLine) {
    }
}
