package ro.greenstruct.agro.tools.underwriting;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;

/** Lookups in config/funds.json. */
final class Funds {

    private Funds() {
    }

    static JsonNode moduleEntry(ToolContext context) {
        JsonNode entry = context.reference().funds().path("modules").path(context.module().moduleId());
        if (entry.isMissingNode()) {
            throw new IllegalArgumentException("Modulul " + context.module().moduleId() + " nu are fond în config/funds.json");
        }
        return entry;
    }

    static JsonNode fund(ToolContext context, String fundId) {
        for (JsonNode fund : context.reference().funds().path("funds")) {
            if (fundId.equals(fund.path("fundId").asText())) {
                return fund;
            }
        }
        throw new IllegalArgumentException("Fond necunoscut: " + fundId);
    }
}
