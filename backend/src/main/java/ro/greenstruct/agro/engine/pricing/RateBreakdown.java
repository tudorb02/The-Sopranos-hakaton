package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * One loan's rate by component, in percentage points. riskCostPct = PD × LGD × (1 − g); capitalCostPct =
 * RW_effective × capital ratio × cost of capital; programSubsidyPct and tierAdjustmentPct are 0 for the classic
 * loan. guaranteeCoveragePct and effectiveRiskWeightPct are kept to explain the risk and capital components.
 */
public record RateBreakdown(
        BigDecimal indexPct,
        BigDecimal fundingCostPct,
        BigDecimal riskCostPct,
        BigDecimal capitalCostPct,
        BigDecimal operationalCostPct,
        BigDecimal targetProfitPct,
        BigDecimal programSubsidyPct,
        BigDecimal tierAdjustmentPct,
        BigDecimal guaranteeCoveragePct,
        BigDecimal effectiveRiskWeightPct) {

    /** Everything above the index. */
    public BigDecimal marginPct() {
        return fundingCostPct.add(riskCostPct, MC)
                .add(capitalCostPct, MC)
                .add(operationalCostPct, MC)
                .add(targetProfitPct, MC)
                .add(programSubsidyPct, MC)
                .add(tierAdjustmentPct, MC);
    }

    /** index + margin. */
    public BigDecimal ratePct() {
        return indexPct.add(marginPct(), MC);
    }
}
