package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.engine.greentier.GreenTierCalculator;
import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.AssessedDnsh;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;

/**
 * The green tier of README §4 step 8 for the configuration the green loan would finance; price_loan reads it for
 * the tier's margin adjustment.
 */
@Component
public class DetermineGreenTierTool implements ToolHandler {

    @Override
    public String name() {
        return "determine_green_tier";
    }

    @Override
    public String description() {
        return "Decides the green tier of the green offer: VERDE_PLUS (indicator at least threshold x 1.5 and DNSH "
                + "passed), VERDE, VERDE_CU_UPGRADE (the requested investment was below the threshold and the upgrade "
                + "reaches it) or CLASIC. requestedConfigId is the investment as requested, financedConfigId the "
                + "configuration of the green option. Call it before price_loan.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["requestedConfigId", "financedConfigId"],
                 "properties": {
                  "requestedConfigId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"},
                  "financedConfigId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"},
                  %s}}
                """.formatted(AssessedDnsh.INPUT_SCHEMA));
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration requested = context.workspace().configuration(Params.requiredText(input, "requestedConfigId"));
        Configuration financed = context.workspace().configuration(Params.requiredText(input, "financedConfigId"));
        DnshStatus dnsh = AssessedDnsh.overall(context, input);
        String kind = context.module().threshold().kind();
        GreenTierResult tier = switch (kind) {
            case "MIN_PCT" -> byThreshold(context, requested, financed, dnsh);
            case "BY_NATURE" -> GreenTierCalculator.byNature(dnsh);
            default -> throw new IllegalArgumentException("Nivelul verde pentru criteriul " + kind
                    + " nu e încă disponibil");
        };
        context.workspace().putGreenTier(tier);

        ObjectNode result = context.newResult();
        result.put("tier", tier.tier().name());
        result.put("thresholdMet", tier.thresholdMet());
        result.put("upgradeNeeded", tier.upgradeNeeded());
        result.put("dnshStatus", dnsh.name());
        return context.ok(result, "Nivelul verde: " + tier.tier().name());
    }

    private static GreenTierResult byThreshold(ToolContext context, Configuration requested, Configuration financed,
                                               DnshStatus dnsh) {
        JsonNode multiplierNode = context.reference().pricing().path("greenTiers").path("verdePlusThresholdMultiplier");
        BigDecimal multiplier = Params.value(multiplierNode, "pricing.greenTiers.verdePlusThresholdMultiplier");
        BigDecimal requestedPct = requested.metric("indicator_pct");
        Optional<BigDecimal> upgraded = requested.configId().equals(financed.configId()) ? Optional.empty()
                : Optional.of(financed.metric("indicator_pct"));
        GreenTierResult tier = GreenTierCalculator.forThreshold(RuleValues.thresholdPct(context), multiplier,
                requestedPct, upgraded, dnsh);

        Calc threshold = context.calc("green_tier.threshold", "Pragul verde", RuleValues.thresholdPct(context),
                Unit.PCT).source(context.module().threshold().sourceRo()).add();
        context.calc("green_tier.requested_indicator", "Indicatorul investiției cerute", requestedPct, Unit.PCT).add();
        context.calc("green_tier.financed_indicator", "Indicatorul investiției finanțate de creditul verde",
                tier.financedIndicatorPct(), Unit.PCT).add();
        context.calc("green_tier.verde_plus_min", "Pragul pentru Verde Plus", tier.verdePlusMinPct(), Unit.PCT)
                .formula("prag × multiplicator").source(multiplierNode.path("sourceRo").asText(null))
                .dependsOn(threshold).add();
        return tier;
    }
}
