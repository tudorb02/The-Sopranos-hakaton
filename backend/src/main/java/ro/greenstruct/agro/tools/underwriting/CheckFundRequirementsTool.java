package ro.greenstruct.agro.tools.underwriting;

import java.math.BigDecimal;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.engine.pricing.LoanPricingCalculator;
import ro.greenstruct.agro.engine.sme.SmeStatus;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.AssessedDnsh;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.funding.PricingConfig;
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
                ? "Fondul " + fundId + " nu are cerințe verzi proprii în config/funds.json"
                : "Fondul " + fundId + ": " + met + " din " + requirements.size() + " cerințe îndeplinite");
    }

    private static Check check(String requirementId, String fundId, FinancingOption option, Configuration cfg,
                               JsonNode input, ToolContext context) {
        return switch (requirementId) {
            case "SME_STATUS" -> sme(context.farm().company().smeStatus());
            case "ELIGIBLE_CATEGORY" -> FundsConfig.moduleFundIds(context).contains(fundId)
                    ? new Check("MET", "Categoria " + context.module().nameRo() + " e legată de fond (README §3.3).")
                    : new Check("NOT_MET", "Categoria " + context.module().nameRo() + " nu e legată de fond.");
            case "TECHNICAL_THRESHOLD" -> cfg.passesThreshold()
                    ? new Check("MET", "Configurația finanțată trece pragul verde, calculat de motor din documente.")
                    : new Check("NOT_MET", "Configurația finanțată nu trece pragul verde.");
            case "DNSH" -> dnsh(AssessedDnsh.overall(context, input));
            case "IMPACT_QUANTIFIED" -> cfg.metricOrZero("indicator_pct").signum() > 0
                    || cfg.metricOrZero("co2_avoided_t").signum() > 0
                    ? new Check("MET", "Impactul e calculat de motor pe acest credit.")
                    : new Check("TO_CONFIRM", "Motorul nu a găsit un impact măsurabil pentru configurația finanțată.");
            case "CLIENT_BENEFIT" -> benefit(option, context);
            case "PERIODIC_REPORTING" -> new Check("MET",
                    "Dosarul are indicatori de monitorizare la 12 luni, din contoare și facturi.");
            default -> throw new IllegalStateException("Unknown fund requirement " + requirementId);
        };
    }

    private static Check sme(SmeStatus status) {
        if (status == SmeStatus.SME) {
            return new Check("MET", "Firma e IMM după bilanțul de la ANAF (angajați, cifră de afaceri, active).");
        }
        if (status == SmeStatus.NOT_SME) {
            return new Check("NOT_MET", "Firma depășește pragurile de IMM după bilanțul de la ANAF.");
        }
        return new Check("TO_CONFIRM", "Bilanțul de la ANAF nu dă toate cifrele: statutul de IMM se confirmă cu "
                + "declarația de IMM.");
    }

    private static Check dnsh(DnshStatus status) {
        return switch (status) {
            case PASS -> new Check("MET", "DNSH trecut pe toate obiectivele.");
            case PASS_WITH_CONDITIONS -> new Check("TO_CONFIRM", "DNSH trecut cu condiții înainte de tragere.");
            case MISSING_DATA -> new Check("TO_CONFIRM", "Lipsesc date pentru DNSH; devin condiții înainte de tragere.");
            case FAIL -> new Check("NOT_MET", "Investiția nu trece DNSH.");
        };
    }

    /** A lower rate than the classic loan (price_loan), or no mortgage where the standard loan needs one. */
    private static Check benefit(FinancingOption option, ToolContext context) {
        JsonNode line = FinancingConfig.requireLine(context, option.mainLineId());
        JsonNode standard = FinancingConfig.requireLine(context, context.module().financing().standardLine());
        BigDecimal classicRate = LoanPricingCalculator.classic(PricingConfig.parameters(context)).ratePct();
        boolean lowerRate = option.ratePct() != null && option.ratePct().compareTo(classicRate) < 0;
        boolean noMortgage = collateral(line).signum() == 0 && collateral(standard).signum() > 0;
        if (lowerRate && noMortgage) {
            return new Check("MET", "Dobândă mai mică decât la creditul clasic și fără ipotecă.");
        }
        if (lowerRate || noMortgage) {
            return new Check("MET", lowerRate ? "Dobândă mai mică decât la creditul clasic."
                    : "Fără ipotecă, spre deosebire de creditul clasic.");
        }
        return new Check("TO_CONFIRM", "Beneficiul pentru client nu reiese din dobândă sau din garanții.");
    }

    private static BigDecimal collateral(JsonNode line) {
        return line.path("collateralUpfrontEur").decimalValue().add(line.path("collateralAnnualEur").decimalValue());
    }
}
