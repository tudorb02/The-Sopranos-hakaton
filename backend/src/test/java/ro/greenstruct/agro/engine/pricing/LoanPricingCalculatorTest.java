package ro.greenstruct.agro.engine.pricing;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The illustrative example of README §4 step 6, with the demo values of config/pricing.json:
 * index 2.00, funding 1.20, PD 3% → 2.5%, LGD 45%, RW 75% / FEI 0%, capital 12% at 12%, operational 1.50,
 * profit 1.77, FEI guarantee g = 70%, green adjustments −0.30 funding, −0.15 operational, −0.40 subsidy.
 */
class LoanPricingCalculatorTest {

    private static final PricingParameters README_EXAMPLE = new PricingParameters(
            new BigDecimal("2.00"), new BigDecimal("1.20"), new BigDecimal("3"), new BigDecimal("45"),
            new BigDecimal("75"), new BigDecimal("12"), new BigDecimal("12"), new BigDecimal("1.50"),
            new BigDecimal("1.77"));

    private static GreenAdjustments green(String tierAdjustmentPp) {
        return new GreenAdjustments(new BigDecimal("2.5"), new BigDecimal("70"), BigDecimal.ZERO,
                new BigDecimal("-0.30"), new BigDecimal("-0.15"), new BigDecimal("-0.40"), new BigDecimal(tierAdjustmentPp));
    }

    @Test
    void classicLoanIsEightPointNinePercent() {
        RateBreakdown classic = LoanPricingCalculator.classic(README_EXAMPLE);

        // risk 3 × 0.45 = 1.35; capital 0.75 × 12 × 0.12 = 1.08
        assertThat(classic.riskCostPct()).isEqualByComparingTo("1.35");
        assertThat(classic.capitalCostPct()).isEqualByComparingTo("1.08");
        // margin 1.20 + 1.35 + 1.08 + 1.50 + 1.77 = 6.90; rate 2.00 + 6.90 = 8.90
        assertThat(classic.marginPct()).isEqualByComparingTo("6.90");
        assertThat(classic.ratePct()).isEqualByComparingTo("8.90");
    }

    @Test
    void greenLoanReproducesTheReadmeDecomposition() {
        LoanPricing pricing = LoanPricingCalculator.price(README_EXAMPLE, green("0"));
        RateBreakdown greenRate = pricing.green();

        // RW_effective = 75 × 0.30 + 0 × 0.70 = 22.5
        assertThat(greenRate.effectiveRiskWeightPct()).isEqualByComparingTo("22.5");
        // risk 2.5 × 0.45 × 0.30 = 0.3375; capital 0.225 × 12 × 0.12 = 0.324
        assertThat(greenRate.riskCostPct()).isEqualByComparingTo("0.3375");
        assertThat(greenRate.capitalCostPct()).isEqualByComparingTo("0.324");
        // README: −1.01 pp risk, −0.76 pp capital, −0.30 funding, −0.15 operational, −0.40 subsidy
        assertThat(pricing.riskCostDifferencePp()).isEqualByComparingTo("-1.0125");
        assertThat(pricing.capitalCostDifferencePp()).isEqualByComparingTo("-0.756");
        assertThat(pricing.fundingCostDifferencePp()).isEqualByComparingTo("-0.30");
        assertThat(pricing.operationalCostDifferencePp()).isEqualByComparingTo("-0.15");
        assertThat(pricing.programSubsidyDifferencePp()).isEqualByComparingTo("-0.40");
        // 2.00 + 0.90 + 0.3375 + 0.324 + 1.35 + 1.77 − 0.40 = 6.2815, about 6.3%; total −2.6185 ≈ −2.6 pp
        assertThat(greenRate.ratePct()).isEqualByComparingTo("6.2815");
        assertThat(pricing.rateDifferencePp()).isEqualByComparingTo("-2.6185");
    }

    @Test
    void standardTierKeepsPartOfTheReduction() {
        // Verde: the tier adds 0.20 pp back, 6.2815 + 0.20 = 6.4815
        RateBreakdown verde = LoanPricingCalculator.green(README_EXAMPLE, green("0.20"));

        assertThat(verde.ratePct()).isEqualByComparingTo("6.4815");
    }

    @Test
    void withoutAGuaranteeOnlyThePdAndTheAdjustmentsChange() {
        GreenAdjustments noGuarantee = new GreenAdjustments(new BigDecimal("2.5"), BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("-0.30"), new BigDecimal("-0.15"), new BigDecimal("-0.40"), BigDecimal.ZERO);

        RateBreakdown greenRate = LoanPricingCalculator.green(README_EXAMPLE, noGuarantee);

        // risk 2.5 × 0.45 = 1.125; capital unchanged 1.08; rate 2.00 + 0.90 + 1.125 + 1.08 + 1.35 + 1.77 − 0.40 = 7.825
        assertThat(greenRate.riskCostPct()).isEqualByComparingTo("1.125");
        assertThat(greenRate.capitalCostPct()).isEqualByComparingTo("1.08");
        assertThat(greenRate.ratePct()).isEqualByComparingTo("7.825");
    }
}
