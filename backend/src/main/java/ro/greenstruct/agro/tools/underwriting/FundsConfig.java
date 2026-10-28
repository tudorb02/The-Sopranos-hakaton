package ro.greenstruct.agro.tools.underwriting;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/** The green funds F1–F6 of config/funds.json and the funds of each module (README §3.3), looked up by id. */
final class FundsConfig {

    private FundsConfig() {
    }

    static Optional<JsonNode> fund(ToolContext context, String fundId) {
        for (JsonNode fund : context.reference().funds().path("funds")) {
            if (fundId.equals(fund.path("fundId").asText())) {
                return Optional.of(fund);
            }
        }
        return Optional.empty();
    }

    static JsonNode requireFund(ToolContext context, String fundId) {
        return fund(context, fundId).orElseThrow(() -> new IllegalArgumentException("Fondul " + fundId
                + " nu există în config/funds.json"));
    }

    /** primaryFund, alternatives and bondCategories of the dossier's module. */
    static JsonNode module(ToolContext context) {
        JsonNode module = context.reference().funds().path("modules").path(context.module().moduleId());
        if (module.isMissingNode()) {
            throw new IllegalArgumentException("Modulul " + context.module().moduleId()
                    + " nu are fonduri în config/funds.json");
        }
        return module;
    }

    /** The module's primary fund first, then its alternatives. */
    static List<String> moduleFundIds(ToolContext context) {
        JsonNode module = module(context);
        List<String> ids = new ArrayList<>();
        ids.add(module.path("primaryFund").asText());
        module.path("alternatives").forEach(alternative -> ids.add(alternative.path("fundId").asText()));
        return ids;
    }

    /**
     * The fund an option draws on: the one whose guarantee secures its loan (F1 = the FEI InvestEU guarantee),
     * else the grant fund whose programme or co-financing line it uses (F6 = AFIR).
     */
    static Optional<JsonNode> backing(ToolContext context, FinancingOption option) {
        JsonNode funds = context.reference().funds().path("funds");
        for (JsonNode fund : funds) {
            if (option.guaranteeId() != null && option.guaranteeId().equals(fund.path("guaranteeId").asText())) {
                return Optional.of(fund);
            }
        }
        for (JsonNode fund : funds) {
            boolean cofinancing = option.mainLineId().equals(fund.path("cofinancingLineId").asText());
            boolean grant = false;
            for (JsonNode code : fund.path("programCodes")) {
                grant |= code.asText().equals(option.grantProgram());
            }
            if (cofinancing || grant) {
                return Optional.of(fund);
            }
        }
        return Optional.empty();
    }

    /**
     * AVAILABLE, TO_CONFIRM or NOT_AVAILABLE. A grant fund is available only if one of its programmes has an open
     * session the farm is eligible for (check_program_eligibility); the others follow their status in the config.
     */
    static String availability(ToolContext context, JsonNode fund) {
        if (fund.path("programCodes").isEmpty()) {
            return "ACTIVE".equals(fund.path("status").asText()) ? "AVAILABLE" : "TO_CONFIRM";
        }
        boolean checked = false;
        for (JsonNode code : fund.path("programCodes")) {
            Optional<JsonNode> check = context.workspace().programCheck(code.asText());
            if (check.isPresent()) {
                checked = true;
                if ("ELIGIBLE".equals(check.get().path("result").asText())
                        && "OPEN".equals(check.get().path("session").asText())) {
                    return "AVAILABLE";
                }
            }
        }
        return checked ? "NOT_AVAILABLE" : "TO_CONFIRM";
    }
}
