package ro.greenstruct.agro.engine.energy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.TWELVE;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * README §6, category 2 (energy on the farm): yearly and monthly production, the part consumed on the farm
 * during the day, the part sold, the savings, the CO₂ and the sizing check. Pure functions, no I/O; yields,
 * prices and factors are arguments that come from config/.
 */
public final class EnergyCalculator {

    private static final int MONTHS = 12;
    private static final BigDecimal SHARE_TOLERANCE = new BigDecimal("0.000001");
    private static final BigDecimal KG_PER_TONNE = BigDecimal.valueOf(1_000);

    private EnergyCalculator() {
    }

    /** E = kWp × specific yield (kWh/kWp/year). */
    public static BigDecimal annualProductionKwh(BigDecimal kwp, BigDecimal specificYieldKwhPerKwp) {
        return requireNonNegative(kwp, "kwp").multiply(requirePositive(specificYieldKwhPerKwp, "specificYield"), MC);
    }

    /** The yearly production spread over the months with the monthly profile (12 shares summing to 1). */
    public static List<BigDecimal> monthlyProductionKwh(BigDecimal annualKwh, List<BigDecimal> monthlyShares) {
        requireMonths(monthlyShares, "monthlyShares");
        BigDecimal sum = monthlyShares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.subtract(BigDecimal.ONE).abs().compareTo(SHARE_TOLERANCE) > 0) {
            throw new IllegalArgumentException("monthlyShares must sum to 1, was " + sum);
        }
        List<BigDecimal> months = new ArrayList<>();
        for (BigDecimal share : monthlyShares) {
            months.add(annualKwh.multiply(requireNonNegative(share, "monthlyShare"), MC));
        }
        return months;
    }

    /**
     * Twelve monthly consumptions from the months the invoices cover (1 = January). A month without an invoice
     * takes the mean of the months that have one; no invoice at all is an error.
     */
    public static List<BigDecimal> completeMonths(Map<Integer, BigDecimal> kwhByMonth) {
        if (kwhByMonth.isEmpty()) {
            throw new IllegalArgumentException("No monthly consumption to complete");
        }
        BigDecimal mean = kwhByMonth.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(kwhByMonth.size()), MC);
        List<BigDecimal> months = new ArrayList<>();
        for (int month = 1; month <= MONTHS; month++) {
            BigDecimal kwh = kwhByMonth.getOrDefault(month, mean);
            months.add(requireNonNegative(kwh, "monthlyConsumption"));
        }
        return months;
    }

    /**
     * E_auto = Σ over months of min(E_month, consumption_month × daytime share): the panels produce only by
     * day, so only the daytime part of the consumption can be covered directly.
     */
    public static BigDecimal selfConsumedKwh(List<BigDecimal> monthlyProductionKwh, List<BigDecimal> monthlyConsumptionKwh,
                                             BigDecimal daytimeSharePct) {
        requireMonths(monthlyProductionKwh, "monthlyProductionKwh");
        requireMonths(monthlyConsumptionKwh, "monthlyConsumptionKwh");
        BigDecimal daytime = fraction(requirePct(daytimeSharePct, "daytimeSharePct"));
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < MONTHS; i++) {
            BigDecimal usable = requireNonNegative(monthlyConsumptionKwh.get(i), "consumption").multiply(daytime, MC);
            total = total.add(monthlyProductionKwh.get(i).min(usable));
        }
        return total;
    }

    /** Production, self-consumption, sold energy, export share and coverage of one installation. */
    public static PvBalance balance(BigDecimal kwp, BigDecimal specificYieldKwhPerKwp, List<BigDecimal> monthlyShares,
                                    List<BigDecimal> monthlyConsumptionKwh, BigDecimal daytimeSharePct) {
        BigDecimal production = annualProductionKwh(kwp, specificYieldKwhPerKwp);
        List<BigDecimal> monthly = monthlyProductionKwh(production, monthlyShares);
        BigDecimal self = selfConsumedKwh(monthly, monthlyConsumptionKwh, daytimeSharePct);
        BigDecimal exported = production.subtract(self);
        BigDecimal consumption = monthlyConsumptionKwh.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal exportShare = production.signum() == 0 ? BigDecimal.ZERO : toPct(exported.divide(production, MC));
        BigDecimal selfShare = production.signum() == 0 ? BigDecimal.ZERO : toPct(self.divide(production, MC));
        BigDecimal coverage = consumption.signum() == 0 ? BigDecimal.ZERO : toPct(self.divide(consumption, MC));
        return new PvBalance(kwp, production, List.copyOf(monthly), self, exported, exportShare, selfShare, coverage);
    }

    /** Savings in EUR per year: self-consumed energy at the buy price plus sold energy at the sell price. */
    public static BigDecimal savingsEur(BigDecimal selfConsumedKwh, BigDecimal exportedKwh, BigDecimal buyEurPerKwh,
                                        BigDecimal sellEurPerKwh) {
        return requireNonNegative(selfConsumedKwh, "selfConsumedKwh")
                .multiply(requireNonNegative(buyEurPerKwh, "buyEurPerKwh"), MC)
                .add(requireNonNegative(exportedKwh, "exportedKwh")
                        .multiply(requireNonNegative(sellEurPerKwh, "sellEurPerKwh"), MC));
    }

    /** CO₂ avoided = E / 1000 × grid factor (t CO₂/MWh), the whole production displaces grid energy. */
    public static BigDecimal co2AvoidedTonnes(BigDecimal productionKwh, BigDecimal gridKgCo2PerKwh) {
        return ImpactCalculator.co2Tonnes(productionKwh, gridKgCo2PerKwh);
    }

    /** A solar pump in place of a diesel one: litres avoided × diesel price, litres × kg CO₂/l / 1000. */
    public static SolarPumpSaving solarPump(BigDecimal dieselLitresPerYear, BigDecimal dieselEurPerLitre,
                                            BigDecimal kgCo2PerLitre) {
        BigDecimal litres = requireNonNegative(dieselLitresPerYear, "dieselLitresPerYear");
        BigDecimal saving = litres.multiply(requireNonNegative(dieselEurPerLitre, "dieselEurPerLitre"), MC);
        BigDecimal co2 = litres.multiply(requireNonNegative(kgCo2PerLitre, "kgCo2PerLitre"), MC)
                .divide(KG_PER_TONNE, MC);
        return new SolarPumpSaving(litres, saving, co2);
    }

    /** Years to recover the investment from the yearly savings; empty when there are no savings. */
    public static Optional<BigDecimal> paybackYears(BigDecimal investmentEur, BigDecimal yearlySavingsEur) {
        requireNonNegative(investmentEur, "investmentEur");
        if (requireNonNegative(yearlySavingsEur, "yearlySavingsEur").signum() == 0) {
            return Optional.empty();
        }
        return Optional.of(investmentEur.divide(yearlySavingsEur, MC));
    }

    /** The same payback in months: years × 12. */
    public static Optional<BigDecimal> paybackMonths(BigDecimal investmentEur, BigDecimal yearlySavingsEur) {
        return paybackYears(investmentEur, yearlySavingsEur).map(years -> years.multiply(TWELVE, MC));
    }

    /** Sizing rule: at most maxExportSharePct of the production may be sold to the grid. */
    public static boolean exportWithinLimit(BigDecimal exportSharePct, BigDecimal maxExportSharePct) {
        return exportSharePct.compareTo(requirePct(maxExportSharePct, "maxExportSharePct")) <= 0;
    }

    /** Roof or land needed = kWp × m² per kWp. */
    public static BigDecimal areaNeededM2(BigDecimal kwp, BigDecimal m2PerKwp) {
        return requireNonNegative(kwp, "kwp").multiply(requirePositive(m2PerKwp, "m2PerKwp"), MC);
    }

    private static void requireMonths(List<BigDecimal> values, String name) {
        if (values == null || values.size() != MONTHS) {
            throw new IllegalArgumentException(name + " must have 12 months, had " + (values == null ? 0 : values.size()));
        }
    }
}
