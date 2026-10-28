package ro.greenstruct.agro.engine.sme;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Recommendation 2003/361/EC: fewer than 250 employees and (turnover ≤ 50 mil. EUR or assets ≤ 43 mil. EUR). */
class SmeRuleTest {

    private static final SmeRule RULE = new SmeRule(250, new BigDecimal("50000000"), new BigDecimal("43000000"));

    private static BigDecimal eur(String value) {
        return value == null ? null : new BigDecimal(value);
    }

    @Test
    void aSmallFarmIsAnSme() {
        assertThat(RULE.classify(14, eur("486000"), eur("1320000"))).isEqualTo(SmeStatus.SME);
    }

    @Test
    void oneFinancialLimitIsEnough() {
        // turnover above 50 mil. but assets at the limit
        assertThat(RULE.classify(120, eur("60000000"), eur("43000000"))).isEqualTo(SmeStatus.SME);
        assertThat(RULE.classify(120, eur("50000000"), eur("90000000"))).isEqualTo(SmeStatus.SME);
    }

    @Test
    void tooManyEmployeesOrBothLimitsExceededIsNotAnSme() {
        assertThat(RULE.classify(250, eur("1000000"), eur("1000000"))).isEqualTo(SmeStatus.NOT_SME);
        assertThat(RULE.classify(120, eur("60000000"), eur("44000000"))).isEqualTo(SmeStatus.NOT_SME);
    }

    @Test
    void missingFiguresLeaveItUnknown() {
        assertThat(RULE.classify(0, null, null)).isEqualTo(SmeStatus.UNKNOWN);
        // turnover above the limit and assets not published: the assets could still make it an SME
        assertThat(RULE.classify(120, eur("60000000"), null)).isEqualTo(SmeStatus.UNKNOWN);
        assertThat(RULE.classify(120, null, eur("1000000"))).isEqualTo(SmeStatus.SME);
    }
}
