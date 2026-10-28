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
    void dieselAndNitrogenAddUpToCo2e() {
        // Machinery test farm of data/demo/test-documents (DEMO-0003): 9,672 l and 4,201 kg N a year
        // (9,672 × 2.68 + 4,201 × 4.29) / 1000 = (25,920.96 + 18,022.29) / 1000 = 43.94325 t
        assertThat(ImpactCalculator.co2eFromDieselAndNitrogenTonnes(new BigDecimal("9672"), new BigDecimal("2.68"),
                new BigDecimal("4201"), new BigDecimal("4.29"))).isEqualByComparingTo("43.94325");
    }

    @Test
    void usingMoreEnergyIsNegativeAvoidedCo2() {
        // −20,000 kWh × 0.26 kg/kWh / 1000 = −5.2 t
        assertThat(ImpactCalculator.co2AvoidedTonnes(new BigDecimal("-20000"), new BigDecimal("0.26")))
                .isEqualByComparingTo("-5.2");
    }

    @Test
    void electricityCo2UsesGramsPerKwh() {
        assertThat(ImpactCalculator.co2FromElectricityTonnes(new BigDecimal("39000"), new BigDecimal("230")))
                .isEqualByComparingTo("8.97");
    }
}
