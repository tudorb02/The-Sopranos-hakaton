package ro.greenstruct.agro.tools.underwriting;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.external.model.CompanyInfo;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;

/**
 * README §3.2: ticks the requirements of a fund. REQUIRED requirements come out MET, CONDITIONAL (becomes a
 * condition before drawdown, README §5.3) or NOT_MET; PROBABLE ones that hold come out TO_CONFIRM, because the
 * fund's real terms are confirmed with the bank (README §14).
 */
@Component
public class CheckFundRequirementsTool implements ToolHandler {

    @Override
    public String name() {
        return "check_fund_requirements";
    }

    @Override
    public String description() {
        return "Checks the requirements of a fund (SME status, eligible category, technical threshold, DNSH, "
                + "quantified impact, benefit to the client, periodic reporting) against the dossier. Returns MET, "
                + "CONDITIONAL, NOT_MET, TO_CONFIRM or NOT_APPLICABLE for each, with a suggested condition id.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["fundCode"], "properties": {
                  "fundCode": {"type": "string", "enum": ["F1", "F2", "F3", "F4", "F5", "F6"]}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        String fundCode = Params.requiredText(input, "fundCode");
        JsonNode fund = Funds.fund(context, fundCode);
        ObjectNode result = context.newResult();
        result.put("fundCode", fundCode);
        ArrayNode rows = result.putArray("requirements");
        fund.path("requirements").fields().forEachRemaining(entry -> {
            Check check = check(context, entry.getKey());
            String level = entry.getValue().asText();
            String status = check.status;
            if ("NOT_APPLICABLE".equals(level)) {
                status = "NOT_APPLICABLE";
            } else if ("PROBABLE".equals(level) && "MET".equals(status)) {
                status = "TO_CONFIRM";
            }
            ObjectNode row = rows.addObject();
            row.put("requirement", entry.getKey());
            row.put("level", level);
            row.put("status", status);
            row.put("noteRo", check.noteRo);
            if (check.calcId != null) {
                row.put("calcId", check.calcId);
            }
            if ("CONDITIONAL".equals(status)) {
                row.put("conditionId", "cp_" + entry.getKey().toLowerCase());
            }
        });
        return context.ok(result, "Am verificat cerințele fondului " + fundCode);
    }

    private record Check(String status, String noteRo, String calcId) {
    }

    private Check check(ToolContext context, String requirement) {
        return switch (requirement) {
            case "SME_STATUS" -> sme(context);
            case "ELIGIBLE_CATEGORY" -> new Check("MET", "Modulul " + context.module().nameRo()
                    + " are categorie eligibilă în config/funds.json", null);
            case "TECHNICAL_THRESHOLD" -> threshold(context);
            case "DNSH" -> dnsh(context);
            case "IMPACT_QUANTIFIED" -> impact(context);
            case "CLIENT_BENEFIT" -> benefit(context);
            case "PERIODIC_REPORTING" -> new Check("MET", "Monitorizarea la 12 luni și raportul de portofoliu", null);
            default -> new Check("TO_CONFIRM", "Cerință fără verificare automată", null);
        };
    }

    private static Check sme(ToolContext context) {
        CompanyInfo company = context.farm().company();
        return switch (company.smeStatus()) {
            case SME -> new Check("MET", "Firma este IMM după bilanțul ANAF", null);
            case NOT_SME -> new Check("NOT_MET", "Firma nu se încadrează ca IMM", null);
            case UNKNOWN -> new Check("CONDITIONAL", "Bilanțul nu permite stabilirea statutului de IMM; "
                    + "de confirmat înainte de tragere", null);
        };
    }

    private static Check threshold(ToolContext context) {
        GreenTierResult tier = context.workspace().tier();
        return tier.thresholdMet()
                ? new Check("MET", "Criteriul verde al modulului este atins", null)
                : new Check("NOT_MET", "Criteriul verde al modulului nu este atins", null);
    }

    private static Check dnsh(ToolContext context) {
        JsonNode assessment = context.run().agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        List<DnshStatus> statuses = new ArrayList<>();
        if (assessment != null) {
            assessment.path("dnshChecks").forEach(c -> statuses.add(DnshStatus.valueOf(c.path("status").asText())));
        }
        return switch (DnshStatus.overall(statuses)) {
            case PASS -> new Check("MET", "DNSH trecut pe toate obiectivele", null);
            case PASS_WITH_CONDITIONS, MISSING_DATA -> new Check("CONDITIONAL",
                    "DNSH cu condiții sau date lipsă, de închis înainte de tragere", null);
            case FAIL -> new Check("NOT_MET", "DNSH nu este trecut", null);
        };
    }

    private static Check impact(ToolContext context) {
        Optional<Calc> co2 = context.latestCalc("impact.co2_horizon");
        return co2.map(calc -> new Check("MET", "Impact cuantificat (CO₂, resurse) pe orizont", calc.calcId()))
                .orElseGet(() -> new Check("CONDITIONAL", "Impactul nu a fost încă cuantificat; apelează calculate_impact", null));
    }

    private static Check benefit(ToolContext context) {
        Optional<Calc> diff = context.latestCalc("pricing.diff.total");
        if (diff.isPresent() && diff.get().value().signum() < 0) {
            return new Check("MET", "Dobânda verde este mai mică decât cea clasică", diff.get().calcId());
        }
        return new Check("NOT_MET", "Creditul verde nu aduce un beneficiu clientului", null);
    }
}
