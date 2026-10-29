package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.funding.FundingRequest;
import ro.greenstruct.agro.engine.funding.FundingStack;
import ro.greenstruct.agro.engine.funding.FundingStackCalculator;
import ro.greenstruct.agro.engine.funding.GrantTerms;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * Splits each option's investment into grant, bank loan, guarantee and bridge loan. A grant is used only if
 * check_program_eligibility found the farm ELIGIBLE and the session OPEN; a green line only if the
 * configuration passes the threshold.
 */
@Component
public class BuildFundingStackTool implements ToolHandler {

    @Override
    public String name() {
        return "build_funding_stack";
    }

    @Override
    public String description() {
        return "For each option (A, B, C) takes a configuration and a list of products (line ids, programme codes, "
                + "guarantee ids) and computes grant, main loan, guaranteed amount and bridge loan.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["options"], "properties": {
                  "options": {"type": "array", "minItems": 1, "maxItems": 3, "items": {
                    "type": "object", "additionalProperties": false, "required": ["optionId", "configId", "products"],
                    "properties": {
                      "optionId": {"type": "string", "enum": ["A", "B", "C"]},
                      "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"},
                      "products": {"type": "array", "minItems": 1, "items": {"type": "string"}}}}}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        ObjectNode result = context.newResult();
        ArrayNode summary = result.putArray("options");
        for (JsonNode spec : input.path("options")) {
            FinancingOption option = build(context, spec);
            context.workspace().putOption(option);
            summary.add(describe(context, option));
        }
        return context.ok(result, "Built the funding structure for " + summary.size() + " options");
    }

    private FinancingOption build(ToolContext context, JsonNode spec) {
        String optionId = Params.requiredText(spec, "optionId");
        Configuration cfg = context.workspace().configuration(Params.requiredText(spec, "configId"));
        List<String> products = Params.textList(spec, "products");

        JsonNode mainLine = null;
        JsonNode bridgeLine = null;
        String grantProgram = null;
        String guaranteeId = null;
        for (String product : products) {
            Optional<JsonNode> line = FinancingConfig.line(context, product);
            if (line.isPresent()) {
                if ("BRIDGE_LOAN".equals(line.get().path("kind").asText())) {
                    bridgeLine = line.get();
                } else if (mainLine == null) {
                    mainLine = line.get();
                } else {
                    throw new IllegalArgumentException("Option " + optionId + " has two main loans");
                }
            } else if (FinancingConfig.guarantee(context, product).isPresent()) {
                guaranteeId = product;
            } else if (FinancingConfig.program(context, product).isPresent()) {
                grantProgram = product;
            } else {
                throw new IllegalArgumentException("Unknown product: " + product);
            }
        }
        if (mainLine == null) {
            throw new IllegalArgumentException("Option " + optionId + " has no main loan");
        }
        if (mainLine.path("green").asBoolean(false) && !cfg.passesThreshold()) {
            throw new IllegalArgumentException("The green loan needs a configuration that passes the threshold; "
                    + cfg.configId() + " does not");
        }
        if (guaranteeId == null && mainLine.has("guaranteeId")) {
            guaranteeId = mainLine.path("guaranteeId").asText();
        }

        Optional<GrantTerms> grant = Optional.empty();
        int monthsUntilPaid = 0;
        if (grantProgram != null) {
            String programCode = grantProgram;
            JsonNode check = context.workspace().programCheck(programCode).orElseThrow(() ->
                    new IllegalArgumentException("Run check_program_eligibility first for " + programCode));
            if (!"ELIGIBLE".equals(check.path("result").asText()) || !"OPEN".equals(check.path("session").asText())) {
                throw new IllegalArgumentException("Grant " + programCode + " cannot be used: "
                        + check.path("result").asText() + ", session " + check.path("session").asText());
            }
            grant = Optional.of(new GrantTerms(grantProgram, check.path("intensityPct").decimalValue(),
                    check.path("capEur").decimalValue()));
            monthsUntilPaid = check.path("monthsUntilPaid").asInt(12);
        }
        BigDecimal coverage = guaranteeId == null ? BigDecimal.ZERO
                : FinancingConfig.guarantee(context, guaranteeId).orElseThrow().path("coveragePct").decimalValue();
        BigDecimal bridgeRate = bridgeLine == null ? BigDecimal.ZERO : FinancingConfig.rate(bridgeLine);

        FundingStack stack = FundingStackCalculator.build(new FundingRequest(cfg.totalCost(), cfg.totalCost(), grant,
                BigDecimal.ZERO, coverage, monthsUntilPaid, bridgeRate));
        BigDecimal bridge = bridgeLine == null ? BigDecimal.ZERO : stack.bridgeLoanEur();
        BigDecimal bridgeInterest = bridgeLine == null ? BigDecimal.ZERO : stack.bridgeInterestEur();
        return new FinancingOption(optionId, cfg.configId(), products, mainLine.path("lineId").asText(),
                stack.cofinancingLoanEur(), stack.grantEur(), grantProgram, stack.guaranteedAmountEur(), guaranteeId,
                bridge, bridgeInterest, bridgeLine == null ? null : bridgeLine.path("lineId").asText(), null, null);
    }

    private ObjectNode describe(ToolContext context, FinancingOption option) {
        String p = "option_" + option.optionId().toLowerCase() + ".";
        List<String> parts = new ArrayList<>();
        JsonNode line = FinancingConfig.requireLine(context, option.mainLineId());
        parts.add(line.path("kind").asText());
        context.calc(p + "loan.amount", line.path("nameRo").asText(), option.mainLoanEur(), Unit.EUR).add();
        if (option.grantEur().signum() > 0) {
            parts.add("GRANT");
            context.calc(p + "grant.amount", "Grant " + option.grantProgram(), option.grantEur(), Unit.EUR)
                    .formula("min(intensity × eligible value, cap)").add();
        }
        if (option.guaranteeEur().signum() > 0) {
            parts.add("GUARANTEE");
            context.calc(p + "guarantee.amount", "Guaranteed amount", option.guaranteeEur(), Unit.EUR)
                    .formula("loan × guarantee coverage").add();
        }
        if (option.bridgeLoanEur().signum() > 0) {
            parts.add("BRIDGE_LOAN");
            context.calc(p + "bridge.amount", "Bridge loan until the grant", option.bridgeLoanEur(), Unit.EUR).add();
        }
        ObjectNode node = context.newResult();
        node.put("optionId", option.optionId());
        node.put("configId", option.configId());
        node.set("components", context.mapper().valueToTree(parts));
        return node;
    }
}
