package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.MC;

/** The classic and the green rate side by side, with the difference of each component (green − classic, in pp). */
public record LoanPricing(RateBreakdown classic, RateBreakdown green) {

    public BigDecimal riskCostDifferencePp() {
        return green.riskCostPct().subtract(classic.riskCostPct(), MC);
    }

    public BigDecimal capitalCostDifferencePp() {
        return green.capitalCostPct().subtract(classic.capitalCostPct(), MC);
    }

    public BigDecimal fundingCostDifferencePp() {
        return green.fundingCostPct().subtract(classic.fundingCostPct(), MC);
    }

    public BigDecimal operationalCostDifferencePp() {
        return green.operationalCostPct().subtract(classic.operationalCostPct(), MC);
    }

    public BigDecimal programSubsidyDifferencePp() {
        return green.programSubsidyPct().subtract(classic.programSubsidyPct(), MC);
    }

    public BigDecimal tierAdjustmentDifferencePp() {
        return green.tierAdjustmentPct().subtract(classic.tierAdjustmentPct(), MC);
    }

    /** green rate − classic rate; the sum of the component differences. */
    public BigDecimal rateDifferencePp() {
        return green.ratePct().subtract(classic.ratePct(), MC);
    }
}
