package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FundingStackCalculatorTest {

    private static final GrantTerms DR_12 = new GrantTerms("DR-12", new BigDecimal("65"), new BigDecimal("200000"));

    @Test
    void grantIsCappedAndRestIsCofinancedWithBridgeLoan() {
        FundingStack stack = FundingStackCalculator.build(new FundingRequest(new BigDecimal("492000"),
                new BigDecimal("492000"), Optional.of(DR_12), BigDecimal.ZERO, new BigDecimal("80"), 12,
                new BigDecimal("7")));

        assertThat(stack.grantEur()).isEqualByComparingTo("200000");
        assertThat(stack.cofinancingLoanEur()).isEqualByComparingTo("292000");
        assertThat(stack.guaranteedAmountEur()).isEqualByComparingTo("233600");
        assertThat(stack.bridgeLoanEur()).isEqualByComparingTo("200000");
        assertThat(stack.bridgeInterestEur()).isEqualByComparingTo("14000");
    }

    @Test
    void grantBelowCapUsesIntensityOnEligibleCostOnly() {
        FundingStack stack = FundingStackCalculator.build(new FundingRequest(new BigDecimal("120000"),
                new BigDecimal("100000"), Optional.of(DR_12), new BigDecimal("10000"), BigDecimal.ZERO, 6,
                new BigDecimal("8")));

        assertThat(stack.grantEur()).isEqualByComparingTo("65000");
        assertThat(stack.cofinancingLoanEur()).isEqualByComparingTo("45000");
        assertThat(stack.bridgeInterestEur()).isEqualByComparingTo("2600");
    }

    @Test
    void withoutGrantEverythingIsLoanAndNoBridge() {
        FundingStack stack = FundingStackCalculator.build(new FundingRequest(new BigDecimal("85000"),
                new BigDecimal("85000"), Optional.empty(), BigDecimal.ZERO, new BigDecimal("70"), 12,
                new BigDecimal("7")));

        assertThat(stack.grantEur()).isZero();
        assertThat(stack.cofinancingLoanEur()).isEqualByComparingTo("85000");
        assertThat(stack.guaranteedAmountEur()).isEqualByComparingTo("59500");
        assertThat(stack.bridgeLoanEur()).isZero();
        assertThat(stack.bridgeInterestEur()).isZero();
    }

    @Test
    void rejectsOwnContributionAboveUncoveredPart() {
        assertThatThrownBy(() -> FundingStackCalculator.build(new FundingRequest(new BigDecimal("100000"),
                new BigDecimal("100000"), Optional.of(DR_12), new BigDecimal("50000"), BigDecimal.ZERO, 0,
                BigDecimal.ZERO)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsEligibleCostAboveInvestment() {
        assertThatThrownBy(() -> new FundingRequest(BigDecimal.ONE, BigDecimal.TEN, Optional.empty(), BigDecimal.ZERO,
                BigDecimal.ZERO, 0, BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deMinimisChecksRollingCeiling() {
        DeMinimisCheck ok = FundingStackCalculator.deMinimis(new BigDecimal("50000"), new BigDecimal("20000"),
                new BigDecimal("30000"));
        DeMinimisCheck over = FundingStackCalculator.deMinimis(new BigDecimal("50000"), new BigDecimal("20000"),
                new BigDecimal("30001"));

        assertThat(ok.withinCeiling()).isTrue();
        assertThat(ok.headroomEur()).isEqualByComparingTo("30000");
        assertThat(over.withinCeiling()).isFalse();
    }
}
