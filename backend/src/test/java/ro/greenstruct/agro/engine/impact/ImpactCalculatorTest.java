package ro.greenstruct.agro.engine.impact;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImpactCalculatorTest {

    @Test
    void dieselCo2UsesLitresTimesFactor() {
        assertThat(ImpactCalculator.co2FromDieselTonnes(new BigDecimal("7488"), new BigDecimal("2.66")))
                .isEqualByComparingTo("19.91808");
    }

    @Test
    void electricityCo2UsesGramsPerKwh() {
        assertThat(ImpactCalculator.co2FromElectricityTonnes(new BigDecimal("39000"), new BigDecimal("230")))
                .isEqualByComparingTo("8.97");
    }
}
