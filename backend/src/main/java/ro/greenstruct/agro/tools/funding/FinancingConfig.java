package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;

/** Financing lines, guarantees and EU programmes from config/, looked up by id. */
public final class FinancingConfig {

    private FinancingConfig() {
    }

    public static Optional<JsonNode> line(ToolContext context, String lineId) {
        return find(context.reference().financingLines().path("lines"), "lineId", lineId);
    }

    public static JsonNode requireLine(ToolContext context, String lineId) {
        return line(context, lineId).orElseThrow(() -> new IllegalArgumentException("Linia de finanțare " + lineId
                + " nu există"));
    }

    public static Optional<JsonNode> guarantee(ToolContext context, String guaranteeId) {
        return find(context.reference().financingLines().path("guarantees"), "guaranteeId", guaranteeId);
    }

    public static Optional<JsonNode> program(ToolContext context, String programCode) {
        return find(context.reference().fundingPrograms().path("programs"), "programCode", programCode);
    }

    /** The lines this module may use, in the order of its financing block. */
    public static List<String> moduleLines(ToolContext context) {
        var financing = context.module().financing();
        if (financing == null) {
            throw new IllegalArgumentException("Modulul " + context.module().moduleId() + " nu are finanțare configurată");
        }
        List<String> lines = new ArrayList<>();
        for (String id : new String[]{financing.standardLine(), financing.greenLine(), financing.cofinancingLine(),
                financing.bridgeLine()}) {
            if (id != null) {
                lines.add(id);
            }
        }
        return lines;
    }

    /**
     * Loan term in months: the tool input, else the farmer's answer (loan_term = ANI_7), else the module default.
     */
    public static int termMonths(ToolContext context, JsonNode input) {
        if (input.has("termMonths")) {
            return input.path("termMonths").asInt();
        }
        String answer = context.questionnaire().path("loan_term").asText("");
        if (answer.startsWith("ANI_")) {
            return Integer.parseInt(answer.substring(4)) * 12;
        }
        return context.module().financing().termMonths();
    }

    /** Comparison horizon in years: the farmer's loan term when given, else the module default. */
    public static int horizonYears(ToolContext context) {
        String answer = context.questionnaire().path("loan_term").asText("");
        return answer.startsWith("ANI_") ? Integer.parseInt(answer.substring(4))
                : context.module().financing().horizonYears();
    }

    public static BigDecimal rate(JsonNode line) {
        return line.path("annualRatePct").decimalValue();
    }

    /** "rbro.agri.green_investeu" → "green_investeu": the readable part used in calc keys. */
    public static String shortId(String id) {
        return id.substring(id.lastIndexOf('.') + 1);
    }

    private static Optional<JsonNode> find(JsonNode array, String field, String id) {
        for (JsonNode item : array) {
            if (id.equals(item.path(field).asText())) {
                return Optional.of(item);
            }
        }
        return Optional.empty();
    }
}
