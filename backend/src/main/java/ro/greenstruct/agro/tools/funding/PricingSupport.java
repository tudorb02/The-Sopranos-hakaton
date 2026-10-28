package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.GreenTier;
import ro.greenstruct.agro.engine.pricing.GreenAdjustments;
import ro.greenstruct.agro.engine.pricing.PricingParameters;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.ToolContext;

/** Reads config/pricing.json and config/funds.json into the engine's parameter records. */
final class PricingSupport {

    private PricingSupport() {
    }

    static PricingParameters parameters(ToolContext context) {
        JsonNode pricing = context.reference().pricing();
        return new PricingParameters(
                value(pricing, "index"),
                value(pricing.path("classic"), "fundingCostPct"),
                value(pricing.path("classic"), "pdPct"),
                value(pricing.path("risk"), "lgdPct"),
                value(pricing.path("risk"), "riskWeightClientPct"),
                value(pricing.path("risk"), "capitalRatioPct"),
                value(pricing.path("risk"), "costOfCapitalPct"),
                value(pricing.path("classic"), "operationalCostPct"),
                value(pricing.path("classic"), "targetProfitPct"));
    }

    /** Margin adjustment of a tier; VERDE_PLUS has the full reduction, CLASIC has no green loan at all. */
    static BigDecimal tierAdjustmentPp(ToolContext context, GreenTier tier) {
        if (tier == GreenTier.CLASIC) {
            throw new IllegalArgumentException("Nivelul CLASIC nu are credit verde de calculat");
        }
        return value(context.reference().pricing().path("greenTiers").path("marginAdjustmentPp"), tier.name());
    }

    static BigDecimal verdePlusMultiplier(ToolContext context) {
        return value(context.reference().pricing().path("greenTiers"), "verdePlusThresholdMultiplier");
    }

    static GreenAdjustments green(ToolContext context, GreenTier tier) {
        JsonNode pricing = context.reference().pricing();
        JsonNode green = pricing.path("green");
        return new GreenAdjustments(
                value(green, "pdPct"),
                guaranteeCoveragePct(context),
                value(pricing.path("risk"), "riskWeightGuarantorPct"),
                value(green, "fundingCostAdjustmentPp"),
                value(green, "operationalCostAdjustmentPp"),
                value(green, "programSubsidyAdjustmentPp"),
                tierAdjustmentPp(context, tier));
    }

    /** g: the share covered by the FEI guarantee, from fund F1 (equal to the guarantee in financing-lines.json). */
    static BigDecimal guaranteeCoveragePct(ToolContext context) {
        for (JsonNode fund : context.reference().funds().path("funds")) {
            if ("F1".equals(fund.path("fundId").asText())) {
                return Params.value(fund.path("coveragePct"), "funds.F1.coveragePct");
            }
        }
        throw new IllegalStateException("config/funds.json has no fund F1");
    }

    private static BigDecimal value(JsonNode parent, String field) {
        return Params.value(parent.path(field), field);
    }
}
