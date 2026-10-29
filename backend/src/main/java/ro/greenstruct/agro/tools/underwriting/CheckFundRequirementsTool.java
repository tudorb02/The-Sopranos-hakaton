package ro.greenstruct.agro.tools.underwriting;

import java.math.BigDecimal;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.engine.sme.SmeStatus;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.AssessedDnsh;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * The requirements of a fund (README §3.2) checked on a financing option: MET, TO_CONFIRM (becomes a condition
 * before drawdown) or NOT_MET. Requirements marked NOT_APPLICABLE for the fund in config/funds.json are left out.
 */
@Component
public class CheckFundRequirementsTool implements ToolHandler {

    private record Check(String status, String reasonRo) {
    }

    @Override
    public String name() {
        return "check_fund_requirements";
    }

    @Override
    public String description() {
        return "Checks the requirements of a fund on a financing option: SME status (ANAF), eligible category, "
                + "technical threshold, DNSH, quantified impact, benefit for the client and periodic reporting. "
                + "Each one is MET, TO_CONFIRM (turn it into a condition before drawdown) or NOT_MET.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["fundId", "optionId"], "properties": {
                  "fundId": {"type": "string", "pattern": "^F[1-6]$"},
                  "optionId": {"type": "string", "enum": ["A", "B", "C"]},
                  %s}}
                """.formatted(AssessedDnsh.INPUT_SCHEMA));
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        String fundId = Params.requiredText(input, "fundId");
        JsonNode fund = FundsConfig.requireFund(context, fundId);
        FinancingOption option = context.workspace().option(Params.requiredText(input, "optionId"));
        Configuration cfg = context.workspace().configuration(option.configId());

        ObjectNode result = context.newResult();
        result.put("fundId", fundId);
        ArrayNode requirements = result.putArray("requirements");
        int met = 0;
        for (Map.Entry<String, JsonNode> entry : fund.path("requirements").properties()) {
            String level = entry.getValue().asText();
            if ("NOT_APPLICABLE".equals(level)) {
                continue;
            }
            Check check = check(entry.getKey(), fundId, option, cfg, input, context);
            requirements.addObject().put("requirementId", entry.getKey()).put("level", level)
                    .put("status", check.status()).put("reasonRo", check.reasonRo());
            met += "MET".equals(check.status()) ? 1 : 0;
        }
        result.put("allMet", met == requirements.size());
        return context.ok(result, requirements.isEmpty()
                ? "Fund " + fundId + " has no green requirements of its own in config/funds.json"
                : "Fund " + fundId + ": " + met + " of " + requirements.size() + " requirements met");
    }

    private static Check check(String requirementId, String fundId, FinancingOption option, Configuration cfg,
                               JsonNode input, ToolContext context) {
        return switch (requirementId) {
            case "SME_STATUS" -> sme(context.farm().company().smeStatus());
            case "ELIGIBLE_CATEGORY" -> FundsConfig.moduleFundIds(context).contains(fundId)
                    ? new Check("MET", "Category " + context.module().nameRo() + " is linked to the fund (README §3.3).")
                    : new Check("NOT_MET", "Category " + context.module().nameRo() + " is not linked to the fund.");
            case "TECHNICAL_THRESHOLD" -> cfg.passesThreshold()
                    ? new Check("MET", "The financed configuration passes the green threshold, computed by the engine from the documents.")
                    : new Check("NOT_MET", "The financed configuration does not pass the green threshold.");
            case "DNSH" -> dnsh(AssessedDnsh.overall(context, input));
            case "IMPACT_QUANTIFIED" -> cfg.metricOrZero("indicator_pct").signum() > 0
                    || cfg.metricOrZero("co2_avoided_t").signum() > 0
                    ? new Check("MET", "The impact is computed by the engine for this loan.")
                    : new Check("TO_CONFIRM", "The engine found no measurable impact for the financed configuration.");
            case "CLIENT_BENEFIT" -> benefit(option, context);
            case "PERIODIC_REPORTING" -> new Check("MET",
                    "The dossier has 12-month monitoring indicators, from meters and invoices.");
            default -> throw new IllegalStateException("Unknown fund requirement " + requirementId);
        };
    }

    private static Check sme(SmeStatus status) {
        if (status == SmeStatus.SME) {
            return new Check("MET", "The company is an SME per its ANAF balance sheet (employees, turnover, assets).");
        }
        if (status == SmeStatus.NOT_SME) {
            return new Check("NOT_MET", "The company exceeds the SME thresholds per its ANAF balance sheet.");
        }
        return new Check("TO_CONFIRM", "The ANAF balance sheet lacks some figures: SME status is confirmed with "
                + "the SME declaration.");
    }

    private static Check dnsh(DnshStatus status) {
        return switch (status) {
            case PASS -> new Check("MET", "DNSH passed on all objectives.");
            case PASS_WITH_CONDITIONS -> new Check("TO_CONFIRM", "DNSH passed with conditions precedent to drawdown.");
            case MISSING_DATA -> new Check("TO_CONFIRM", "DNSH data missing; it becomes conditions precedent to drawdown.");
            case FAIL -> new Check("NOT_MET", "The investment fails DNSH.");
        };
    }

    /** A lower rate than the module's standard loan, or no mortgage where the standard loan needs one. */
    private static Check benefit(FinancingOption option, ToolContext context) {
        JsonNode line = FinancingConfig.requireLine(context, option.mainLineId());
        JsonNode standard = FinancingConfig.requireLine(context, context.module().financing().standardLine());
        boolean lowerRate = FinancingConfig.rate(line).compareTo(FinancingConfig.rate(standard)) < 0;
        boolean noMortgage = collateral(line).signum() == 0 && collateral(standard).signum() > 0;
        if (lowerRate && noMortgage) {
            return new Check("MET", "Lower interest rate than the classic credit and no mortgage.");
        }
        if (lowerRate || noMortgage) {
            return new Check("MET", lowerRate ? "Lower interest rate than the classic credit."
                    : "No mortgage, unlike the classic credit.");
        }
        return new Check("TO_CONFIRM", "The client benefit does not follow from the interest rate or the collateral.");
    }

    private static BigDecimal collateral(JsonNode line) {
        return line.path("collateralUpfrontEur").decimalValue().add(line.path("collateralAnnualEur").decimalValue());
    }
}
