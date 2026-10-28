package ro.greenstruct.agro.engine.greentier;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** README §4 step 8 on the irrigation threshold of 25%; Verde Plus starts at 25 × 1.5 = 37.5%. */
class GreenTierCalculatorTest {

    private static final BigDecimal THRESHOLD = new BigDecimal("25");
    private static final BigDecimal MULTIPLIER = new BigDecimal("1.5");

    private static GreenTierResult tier(String requested, String upgraded, DnshStatus dnsh) {
        Optional<BigDecimal> upgrade = upgraded == null ? Optional.empty() : Optional.of(new BigDecimal(upgraded));
        return GreenTierCalculator.forThreshold(THRESHOLD, MULTIPLIER, new BigDecimal(requested), upgrade, dnsh);
    }

    @Test
    void readmeDemoReachesVerdePlusThroughTheUpgrade() {
        // sprinklers 20% (under 25%), drip + sensors 40% (≥ 37.5%), DNSH complete
        GreenTierResult result = tier("20", "40", DnshStatus.PASS);

        assertThat(result.tier()).isEqualTo(GreenTier.VERDE_PLUS);
        assertThat(result.upgradeNeeded()).isTrue();
        assertThat(result.verdePlusMinPct()).isEqualByComparingTo("37.5");
    }

    @Test
    void verdePlusStartsExactlyAtOneAndAHalfTimesTheThreshold() {
        assertThat(tier("37.5", null, DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE_PLUS);
        assertThat(tier("37.49", null, DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE);
    }

    @Test
    void upgradeThatOnlyReachesTheThresholdIsVerdeCuUpgrade() {
        // drip alone: 33%, above 25% but under 37.5%
        assertThat(tier("20", "33", DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE_CU_UPGRADE);
    }

    @Test
    void requestedInvestmentAboveTheThresholdIsVerde() {
        assertThat(tier("30", null, DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE);
        assertThat(tier("30", null, DnshStatus.PASS_WITH_CONDITIONS).tier()).isEqualTo(GreenTier.VERDE);
    }

    @Test
    void conditionsKeepAHighIndicatorOutOfVerdePlus() {
        assertThat(tier("40", null, DnshStatus.PASS_WITH_CONDITIONS).tier()).isEqualTo(GreenTier.VERDE);
        assertThat(tier("20", "40", DnshStatus.MISSING_DATA).tier()).isEqualTo(GreenTier.VERDE_CU_UPGRADE);
    }

    @Test
    void belowTheThresholdWithoutAnUpgradeIsClassic() {
        assertThat(tier("20", null, DnshStatus.PASS).tier()).isEqualTo(GreenTier.CLASIC);
        assertThat(tier("20", "24", DnshStatus.PASS).tier()).isEqualTo(GreenTier.CLASIC);
    }

    @Test
    void aDnshFailureIsNeverGreen() {
        assertThat(tier("40", null, DnshStatus.FAIL).tier()).isEqualTo(GreenTier.CLASIC);
    }

    @Test
    void byNatureAndCertificationModulesAreVerdeAtMost() {
        assertThat(GreenTierCalculator.byNature(DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE);
        assertThat(GreenTierCalculator.byNature(DnshStatus.FAIL).tier()).isEqualTo(GreenTier.CLASIC);
        assertThat(GreenTierCalculator.byCertification(true, DnshStatus.PASS).tier()).isEqualTo(GreenTier.VERDE);
        assertThat(GreenTierCalculator.byCertification(false, DnshStatus.PASS).tier()).isEqualTo(GreenTier.CLASIC);
    }

    @Test
    void overallDnshIsTheWorstObjective() {
        assertThat(DnshStatus.overall(List.of(DnshStatus.PASS, DnshStatus.PASS_WITH_CONDITIONS))).isEqualTo(DnshStatus.PASS_WITH_CONDITIONS);
        assertThat(DnshStatus.overall(List.of())).isEqualTo(DnshStatus.MISSING_DATA);
    }

    @Test
    void anUpgradeCannotLowerTheIndicator() {
        assertThatThrownBy(() -> tier("30", "20", DnshStatus.PASS)).isInstanceOf(IllegalArgumentException.class);
    }
}
