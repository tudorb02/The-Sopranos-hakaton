package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;

/**
 * The classic loan's rate components of README §4 step 6, in percentage points (8.9 = 8.9%), from
 * config/pricing.json. pdPct is the client's probability of default without the green investment.
 */
public record PricingParameters(
        BigDecimal indexPct,
        BigDecimal fundingCostPct,
        BigDecimal pdPct,
        BigDecimal lgdPct,
        BigDecimal riskWeightClientPct,
        BigDecimal capitalRatioPct,
        BigDecimal costOfCapitalPct,
        BigDecimal operationalCostPct,
        BigDecimal targetProfitPct) {

    public PricingParameters {
        requireNonNegative(indexPct, "indexPct");
        requireNonNegative(fundingCostPct, "fundingCostPct");
        requirePct(pdPct, "pdPct");
        requirePct(lgdPct, "lgdPct");
        requireNonNegative(riskWeightClientPct, "riskWeightClientPct");
        requirePct(capitalRatioPct, "capitalRatioPct");
        requireNonNegative(costOfCapitalPct, "costOfCapitalPct");
        requireNonNegative(operationalCostPct, "operationalCostPct");
        requireNonNegative(targetProfitPct, "targetProfitPct");
    }
}
