package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.engine.greentier.GreenTierCalculator;
import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;

/**
 * README §4 step 8: Verde Plus, Verde, Verde cu upgrade or Clasic, from the technical assessment (indicator of the
 * requested and of the recommended configuration, DNSH) and the module's threshold.
 */
@Component
public class DetermineGreenTierTool implements ToolHandler {

    @Override
    public String name() {
        return "determine_green_tier";
    }

    @Override
    public String description() {
        return "Decides the green tier of the loan (VERDE_PLUS, VERDE, VERDE_CU_UPGRADE or CLASIC) from the technical "
                + "assessment: indicator of the requested and of the recommended configuration against the "
                + "threshold, and the DNSH status. Call it before price_loan.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "acceptUpgrade": {"type": "boolean",
                    "description": "Whether the farmer takes the recommended upgrade. Default true: there is no green without the upgrade."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        JsonNode assessment = context.run().agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        if (assessment == null) {
            throw new IllegalArgumentException("Evaluarea tehnică (Agentul 1) lipsește");
        }
        DnshStatus dnsh = DnshStatus.overall(dnshStatuses(assessment));
        String initialId = assessment.path("initialConfigId").asText();
        String recommendedId = assessment.path("recommendedConfigId").asText(initialId);
        boolean acceptUpgrade = input.path("acceptUpgrade").asBoolean(true);
        var threshold = context.module().threshold();
        BigDecimal multiplier = PricingSupport.verdePlusMultiplier(context);

        GreenTierResult result = switch (threshold.kind()) {
            case "MIN_PCT" -> {
                BigDecimal requested = context.workspace().configuration(initialId).metric("indicator_pct");
                Optional<BigDecimal> upgraded = acceptUpgrade && !recommendedId.equals(initialId)
                        ? Optional.of(context.workspace().configuration(recommendedId).metric("indicator_pct"))
                        : Optional.empty();
                yield GreenTierCalculator.forThreshold(threshold.value(), multiplier, requested, upgraded, dnsh);
            }
            case "BY_NATURE" -> GreenTierCalculator.byNature(dnsh);
            case "CERTIFICATION" -> GreenTierCalculator.byCertification(hasCertification(context), dnsh);
            default -> throw new IllegalStateException("Tip de prag necunoscut: " + threshold.kind());
        };
        context.workspace().putTier(result);

        if (result.financedIndicatorPct() != null) {
            context.calc("tier.financed_indicator", "Indicatorul investiției finanțate", result.financedIndicatorPct(),
                    Unit.PCT).formula("indicatorul configurației verzi (cerută sau cu upgrade acceptat)").add();
            context.calc("tier.verde_plus_min", "Pragul pentru Verde Plus", result.verdePlusMinPct(), Unit.PCT)
                    .formula("prag × multiplicator Verde Plus (config/pricing.json)")
                    .source("config/pricing.json, greenTiers").add();
        }
        ObjectNode node = context.newResult();
        node.put("tier", result.tier().name());
        node.put("thresholdMet", result.thresholdMet());
        node.put("upgradeNeeded", result.upgradeNeeded());
        node.put("dnsh", dnsh.name());
        return context.ok(node, "Nivelul verde: " + result.tier());
    }

    private static List<DnshStatus> dnshStatuses(JsonNode assessment) {
        List<DnshStatus> statuses = new ArrayList<>();
        assessment.path("dnshChecks").forEach(check -> statuses.add(DnshStatus.valueOf(check.path("status").asText())));
        return statuses;
    }

    private static boolean hasCertification(ToolContext context) {
        return context.run().request().documents().stream()
                .anyMatch(doc -> "CERTIFICATION_CONTRACT".equals(doc.docType()));
    }
}
