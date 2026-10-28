package ro.greenstruct.agro.engine.portfolio;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * The bank's portfolio of green loans (README §8 panel 7, §9): sums per category, per fund and per green tier, and the
 * total impact. Impact is the measured one for loans whose 12-month monitoring was done, the estimated one otherwise.
 */
public final class PortfolioAggregator {

    private static final BigDecimal KWH_PER_MWH = new BigDecimal("1000");

    private PortfolioAggregator() {
    }

    /** One approved green loan. Impact amounts are per year; energyKwh is renewable or saved energy, never both. */
    public record Loan(String moduleId, String fundId, String tier, BigDecimal amountEur, BigDecimal co2AvoidedT,
                       BigDecimal energyKwh, BigDecimal waterM3, BigDecimal fuelL, BigDecimal nitrogenKg,
                       BigDecimal certifiedAreaHa, boolean monitored, boolean monitoringConfirmed) {
    }

    public record Group(String key, int count, BigDecimal amountEur) {
    }

    public record Impact(BigDecimal co2AvoidedT, BigDecimal energyMwh, BigDecimal waterM3, BigDecimal fuelL,
                         BigDecimal nitrogenKg, BigDecimal certifiedAreaHa) {
    }

    public record Portfolio(int loanCount, BigDecimal totalAmountEur, List<Group> byModule, List<Group> byFund,
                            List<Group> byTier, Impact impact, int monitoredCount, int confirmedCount) {
    }

    public static Portfolio aggregate(List<Loan> loans) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        Map<String, Map<String, BigDecimal>> sums = new LinkedHashMap<>();
        Map<String, Map<String, Integer>> numbers = new LinkedHashMap<>();
        BigDecimal co2 = BigDecimal.ZERO;
        BigDecimal kwh = BigDecimal.ZERO;
        BigDecimal water = BigDecimal.ZERO;
        BigDecimal fuel = BigDecimal.ZERO;
        BigDecimal nitrogen = BigDecimal.ZERO;
        BigDecimal area = BigDecimal.ZERO;
        int monitored = 0;
        int confirmed = 0;
        for (Loan loan : loans) {
            total = total.add(loan.amountEur(), MC);
            add(sums, numbers, "module", loan.moduleId(), loan.amountEur());
            add(sums, numbers, "fund", loan.fundId(), loan.amountEur());
            add(sums, numbers, "tier", loan.tier(), loan.amountEur());
            co2 = co2.add(loan.co2AvoidedT(), MC);
            kwh = kwh.add(loan.energyKwh(), MC);
            water = water.add(loan.waterM3(), MC);
            fuel = fuel.add(loan.fuelL(), MC);
            nitrogen = nitrogen.add(loan.nitrogenKg(), MC);
            area = area.add(loan.certifiedAreaHa(), MC);
            monitored += loan.monitored() ? 1 : 0;
            confirmed += loan.monitoringConfirmed() ? 1 : 0;
        }
        return new Portfolio(loans.size(), total, groups(sums, numbers, "module"), groups(sums, numbers, "fund"),
                groups(sums, numbers, "tier"),
                new Impact(co2, kwh.divide(KWH_PER_MWH, MC), water, fuel, nitrogen, area), monitored, confirmed);
    }

    private static void add(Map<String, Map<String, BigDecimal>> sums, Map<String, Map<String, Integer>> numbers,
                            String dimension, String key, BigDecimal amount) {
        sums.computeIfAbsent(dimension, d -> new TreeMap<>()).merge(key, amount, (a, b) -> a.add(b, MC));
        numbers.computeIfAbsent(dimension, d -> new TreeMap<>()).merge(key, 1, Integer::sum);
    }

    private static List<Group> groups(Map<String, Map<String, BigDecimal>> sums,
                                      Map<String, Map<String, Integer>> numbers, String dimension) {
        Map<String, BigDecimal> amounts = sums.getOrDefault(dimension, Map.of());
        return amounts.entrySet().stream()
                .map(e -> new Group(e.getKey(), numbers.get(dimension).get(e.getKey()), e.getValue())).toList();
    }
}
