package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.GreenTier;
import ro.greenstruct.agro.engine.pricing.GreenAdjustments;
import ro.greenstruct.agro.engine.pricing.PricingParameters;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.ToolContext;

/** config/pricing.json read into the engine's pricing records (README §4 step 6). */
public final class PricingConfig {

    private PricingConfig() {
    }

    public static PricingParameters parameters(ToolContext context) {
        JsonNode pricing = context.reference().pricing();
        JsonNode classic = pricing.path("classic");
        JsonNode risk = pricing.path("risk");
        return new PricingParameters(value(pricing, "index"), value(classic, "fundingCostPct"), value(classic, "pdPct"),
                value(risk, "lgdPct"), value(risk, "riskWeightClientPct"), value(risk, "capitalRatioPct"),
                value(risk, "costOfCapitalPct"), value(classic, "operationalCostPct"), value(classic, "targetProfitPct"));
    }

    /** A green loan: green PD, cheaper funding and operations, the programme subsidy and the tier's margin. */
    public static GreenAdjustments green(ToolContext context, BigDecimal guaranteeCoveragePct, GreenTier tier) {
        JsonNode green = context.reference().pricing().path("green");
        return new GreenAdjustments(value(green, "pdPct"), guaranteeCoveragePct, guarantorRiskWeight(context),
                value(green, "fundingCostAdjustmentPp"), value(green, "operationalCostAdjustmentPp"),
                value(green, "programSubsidyAdjustmentPp"), tierAdjustment(context, tier));
    }

    /** A classic loan with a guarantee (e.g. AFIR co-financing): only the risk and capital costs change. */
    public static GreenAdjustments guaranteedOnly(ToolContext context, BigDecimal guaranteeCoveragePct) {
        JsonNode classic = context.reference().pricing().path("classic");
        return new GreenAdjustments(value(classic, "pdPct"), guaranteeCoveragePct, guarantorRiskWeight(context),
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    /** The extra margin of a green tier (0 for Verde Plus, which gets the full reduction). */
    public static BigDecimal tierAdjustment(ToolContext context, GreenTier tier) {
        JsonNode adjustment = context.reference().pricing().path("greenTiers").path("marginAdjustmentPp")
                .path(tier.name());
        if (adjustment.isMissingNode()) {
            throw new IllegalArgumentException("Nivelul " + tier + " nu are o marjă în config/pricing.json");
        }
        return Params.value(adjustment, "pricing.greenTiers.marginAdjustmentPp." + tier);
    }

    /** The source of a pricing value, e.g. sourceOf(context, "risk", "lgdPct"). */
    public static String sourceOf(ToolContext context, String block, String field) {
        JsonNode node = block == null ? context.reference().pricing().path(field)
                : context.reference().pricing().path(block).path(field);
        return node.path("sourceRo").asText(null);
    }

    private static BigDecimal guarantorRiskWeight(ToolContext context) {
        return value(context.reference().pricing().path("risk"), "riskWeightGuarantorPct");
    }

    private static BigDecimal value(JsonNode block, String field) {
        return Params.value(block.path(field), "pricing." + field);
    }
}
