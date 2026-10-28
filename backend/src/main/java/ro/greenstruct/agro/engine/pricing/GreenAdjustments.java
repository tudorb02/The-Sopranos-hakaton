package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;
import java.util.Objects;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;

/**
 * What changes for a green loan (README §4 step 6), from config/pricing.json and the guarantee of config/funds.json.
 * The adjustments are added to the classic components, so a negative value lowers the rate; tierAdjustmentPp is the
 * extra margin of the green tier (0 for Verde Plus, which gets the full reduction).
 */
public record GreenAdjustments(
        BigDecimal pdPct,
        BigDecimal guaranteeCoveragePct,
        BigDecimal riskWeightGuarantorPct,
        BigDecimal fundingCostAdjustmentPp,
        BigDecimal operationalCostAdjustmentPp,
        BigDecimal programSubsidyAdjustmentPp,
        BigDecimal tierAdjustmentPp) {

    public GreenAdjustments {
        requirePct(pdPct, "pdPct");
        requirePct(guaranteeCoveragePct, "guaranteeCoveragePct");
        requireNonNegative(riskWeightGuarantorPct, "riskWeightGuarantorPct");
        Objects.requireNonNull(fundingCostAdjustmentPp, "fundingCostAdjustmentPp");
        Objects.requireNonNull(operationalCostAdjustmentPp, "operationalCostAdjustmentPp");
        Objects.requireNonNull(programSubsidyAdjustmentPp, "programSubsidyAdjustmentPp");
        Objects.requireNonNull(tierAdjustmentPp, "tierAdjustmentPp");
    }
}
