package ro.greenstruct.agro.engine.portfolio;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.engine.portfolio.PortfolioAggregator.Loan;
import ro.greenstruct.agro.engine.portfolio.PortfolioAggregator.Portfolio;

import static org.assertj.core.api.Assertions.assertThat;

class PortfolioAggregatorTest {

    private static BigDecimal n(String value) {
        return new BigDecimal(value);
    }

    private static final Loan IRRIGATION = new Loan("irigatii", "F1", "VERDE_PLUS", n("87200"), n("1.33"), n("5104.19"),
            n("97400"), n("0"), n("0"), n("0"), false, false);
    private static final Loan TRACTOR = new Loan("utilaje", "F1", "VERDE", n("201000"), n("43.94"), n("0"), n("0"),
            n("9672"), n("4201"), n("0"), true, true);
    private static final Loan ORGANIC = new Loan("ecologic", "F3", "VERDE", n("78000"), n("67.10"), n("0"), n("0"),
            n("0"), n("15640"), n("120"), false, false);

    @Test
    void sumsAmountsPerModuleFundAndTier() {
        Portfolio portfolio = PortfolioAggregator.aggregate(List.of(IRRIGATION, TRACTOR, ORGANIC));

        // 87,200 + 201,000 + 78,000 = 366,200
        assertThat(portfolio.loanCount()).isEqualTo(3);
        assertThat(portfolio.totalAmountEur()).isEqualByComparingTo("366200");
        assertThat(portfolio.byFund()).extracting(PortfolioAggregator.Group::key, PortfolioAggregator.Group::count)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("F1", 2), org.assertj.core.groups.Tuple.tuple("F3", 1));
        assertThat(portfolio.byFund().get(0).amountEur()).isEqualByComparingTo("288200");
        assertThat(portfolio.byTier()).extracting(PortfolioAggregator.Group::key).containsExactly("VERDE", "VERDE_PLUS");
        assertThat(portfolio.byTier().get(0).amountEur()).isEqualByComparingTo("279000");
    }

    @Test
    void sumsTheImpactAndConvertsEnergyToMwh() {
        Portfolio portfolio = PortfolioAggregator.aggregate(List.of(IRRIGATION, TRACTOR, ORGANIC));

        // CO2: 1.33 + 43.94 + 67.10 = 112.37; energy 5,104.19 kWh = 5.10419 MWh
        assertThat(portfolio.impact().co2AvoidedT()).isEqualByComparingTo("112.37");
        assertThat(portfolio.impact().energyMwh()).isEqualByComparingTo("5.10419");
        assertThat(portfolio.impact().waterM3()).isEqualByComparingTo("97400");
        assertThat(portfolio.impact().fuelL()).isEqualByComparingTo("9672");
        assertThat(portfolio.impact().nitrogenKg()).isEqualByComparingTo("19841");
        assertThat(portfolio.impact().certifiedAreaHa()).isEqualByComparingTo("120");
        assertThat(portfolio.monitoredCount()).isEqualTo(1);
        assertThat(portfolio.confirmedCount()).isEqualTo(1);
    }

    @Test
    void emptyPortfolioIsZero() {
        Portfolio portfolio = PortfolioAggregator.aggregate(List.of());

        assertThat(portfolio.loanCount()).isZero();
        assertThat(portfolio.totalAmountEur()).isEqualByComparingTo("0");
        assertThat(portfolio.byModule()).isEmpty();
    }
}
