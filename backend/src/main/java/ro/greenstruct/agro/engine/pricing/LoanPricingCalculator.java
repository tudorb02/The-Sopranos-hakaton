package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;
import java.util.Objects;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;

/**
 * The rate by component of README §4 step 6:
 * <pre>
 * rate   = index + margin
 * margin = funding + PD × LGD × (1 − g) + RW_effective × capital ratio × cost of capital + operational + profit
 *          (+ programme subsidy + tier adjustment, green loan only)
 * RW_effective = RW_client × (1 − g) + RW_guarantor × g
 * </pre>
 * g is the share covered by the FEI guarantee (0 for the classic loan). The green loan costs the bank less because
 * the guarantee lowers the expected loss and the capital, the savings lower the PD, the bond funding is cheaper and
 * the technical analysis is automatic.
 */
public final class LoanPricingCalculator {

    private LoanPricingCalculator() {
    }

    public static LoanPricing price(PricingParameters parameters, GreenAdjustments green) {
        return new LoanPricing(classic(parameters), green(parameters, green));
    }

    /** No guarantee, no programme subsidy. */
    public static RateBreakdown classic(PricingParameters p) {
        Objects.requireNonNull(p, "parameters");
        return new RateBreakdown(
                p.indexPct(),
                p.fundingCostPct(),
                riskCost(p.pdPct(), p.lgdPct(), BigDecimal.ZERO),
                capitalCost(p.riskWeightClientPct(), p.capitalRatioPct(), p.costOfCapitalPct()),
                p.operationalCostPct(),
                p.targetProfitPct(),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                p.riskWeightClientPct());
    }

    public static RateBreakdown green(PricingParameters p, GreenAdjustments a) {
        Objects.requireNonNull(p, "parameters");
        Objects.requireNonNull(a, "green");
        BigDecimal g = fraction(a.guaranteeCoveragePct());
        BigDecimal effectiveRiskWeightPct = p.riskWeightClientPct().multiply(BigDecimal.ONE.subtract(g), MC)
                .add(a.riskWeightGuarantorPct().multiply(g, MC), MC);
        return new RateBreakdown(
                p.indexPct(),
                p.fundingCostPct().add(a.fundingCostAdjustmentPp(), MC),
                riskCost(a.pdPct(), p.lgdPct(), a.guaranteeCoveragePct()),
                capitalCost(effectiveRiskWeightPct, p.capitalRatioPct(), p.costOfCapitalPct()),
                p.operationalCostPct().add(a.operationalCostAdjustmentPp(), MC),
                p.targetProfitPct(),
                a.programSubsidyAdjustmentPp(),
                a.tierAdjustmentPp(),
                a.guaranteeCoveragePct(),
                effectiveRiskWeightPct);
    }

    /** PD × LGD × (1 − g), in pp: PD 3%, LGD 45%, no guarantee → 1.35. */
    static BigDecimal riskCost(BigDecimal pdPct, BigDecimal lgdPct, BigDecimal guaranteeCoveragePct) {
        BigDecimal uncovered = BigDecimal.ONE.subtract(fraction(guaranteeCoveragePct));
        return pdPct.multiply(fraction(lgdPct), MC).multiply(uncovered, MC);
    }

    /** RW × capital ratio × cost of capital, in pp: RW 75%, 12%, 12% → 1.08. */
    static BigDecimal capitalCost(BigDecimal riskWeightPct, BigDecimal capitalRatioPct, BigDecimal costOfCapitalPct) {
        return fraction(riskWeightPct).multiply(capitalRatioPct, MC).multiply(fraction(costOfCapitalPct), MC);
    }
}
