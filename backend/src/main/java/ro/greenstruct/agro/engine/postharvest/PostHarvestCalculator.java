package ro.greenstruct.agro.engine.postharvest;

import java.math.BigDecimal;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/** Cold stores, dryers and greenhouses (README §6, category 5): energy per tonne (or m²) and its saving. */
public final class PostHarvestCalculator {

    private PostHarvestCalculator() {
    }

    /** I = kWh per year / tonnes (or m²). */
    public static BigDecimal specificConsumption(BigDecimal kwhPerYear, BigDecimal quantity) {
        return requireNonNegative(kwhPerYear, "kwhPerYear").divide(requirePositive(quantity, "quantity"), MC);
    }

    /**
     * Energy saving = 1 − I_new / I_old, with I the electricity and gas per unit added together (the data sheet
     * and the invoices are in kWh, so the carriers add up). The saved kWh stay separate for prices and CO2.
     */
    public static EnergyComparison compare(BigDecimal oldElectricityKwh, BigDecimal oldGasKwh,
                                           BigDecimal newSpecificElectricity, BigDecimal newSpecificGas,
                                           BigDecimal quantity) {
        BigDecimal oldSpecific = specificConsumption(oldElectricityKwh.add(requireNonNegative(oldGasKwh, "oldGasKwh")),
                quantity);
        requirePositive(oldSpecific, "oldSpecific");
        BigDecimal newSpecific = requireNonNegative(newSpecificElectricity, "newSpecificElectricity")
                .add(requireNonNegative(newSpecificGas, "newSpecificGas"));
        // Work in yearly kWh so that no intermediate division leaves rounding noise in the saved energy.
        BigDecimal newElectricityKwh = newSpecificElectricity.multiply(quantity, MC);
        BigDecimal newGasKwh = newSpecificGas.multiply(quantity, MC);
        BigDecimal oldTotalKwh = oldElectricityKwh.add(oldGasKwh);
        BigDecimal savingPct = toPct(BigDecimal.ONE.subtract(newElectricityKwh.add(newGasKwh).divide(oldTotalKwh, MC)));
        return new EnergyComparison(oldSpecific, newSpecific, savingPct,
                oldElectricityKwh.subtract(newElectricityKwh), oldGasKwh.subtract(newGasKwh));
    }

    /** CO2 avoided in tonnes = ΔMWh electricity × grid factor + ΔMWh gas × gas factor (factors in kg CO2 per kWh). */
    public static BigDecimal co2Tonnes(BigDecimal savedElectricityKwh, BigDecimal electricityKgCo2PerKwh,
                                       BigDecimal savedGasKwh, BigDecimal gasKgCo2PerKwh) {
        return ImpactCalculator.co2Tonnes(savedElectricityKwh.max(BigDecimal.ZERO), electricityKgCo2PerKwh)
                .add(ImpactCalculator.co2Tonnes(savedGasKwh.max(BigDecimal.ZERO), gasKgCo2PerKwh));
    }

    /** Saved kWh × price per kWh. */
    public static BigDecimal savingEur(BigDecimal savedKwh, BigDecimal pricePerKwh) {
        return savedKwh.multiply(requireNonNegative(pricePerKwh, "pricePerKwh"), MC);
    }

    /** DNSH pollution: the refrigerant's global warming potential must not exceed the limit (inclusive). */
    public static boolean refrigerantOk(BigDecimal gwp, BigDecimal maxGwp) {
        return requireNonNegative(gwp, "gwp").compareTo(requireNonNegative(maxGwp, "maxGwp")) <= 0;
    }
}
