package ro.greenstruct.agro.engine.livestock;

import java.math.BigDecimal;
import java.util.List;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * Manure management and biogas (README §6, category 4). Emission factors, kWh per head, prices and the GWP are
 * arguments: they come from config/ with their sources, never from this class.
 */
public final class LivestockCalculator {

    private static final BigDecimal KG_PER_TONNE = BigDecimal.valueOf(1_000);

    private LivestockCalculator() {
    }

    /** CH4_old = heads × EF_CH4(species, storage), in kg per year. */
    public static BigDecimal methaneKg(BigDecimal heads, BigDecimal efKgPerHeadYear) {
        return requireNonNegative(heads, "heads").multiply(requireNonNegative(efKgPerHeadYear, "efKgPerHeadYear"), MC);
    }

    /**
     * The reduction of a combined system. Reductions in the catalog and on data sheets are totals for the whole
     * manure chain (digester −45%, digester with a covered digestate tank −85%), so they do not add up or
     * multiply: the best total of the installed components applies. Zero when nothing reduces methane.
     */
    public static BigDecimal systemReductionPct(List<BigDecimal> totalReductionPcts) {
        BigDecimal best = BigDecimal.ZERO;
        for (BigDecimal pct : totalReductionPcts) {
            best = best.max(requirePct(pct, "reductionPct"));
        }
        return best;
    }

    /** CH4_new = CH4_old × (1 − reduction); the reduction in % is the green indicator. */
    public static MethaneComparison methane(BigDecimal oldKg, BigDecimal reductionPct) {
        requirePositive(oldKg, "oldKg");
        BigDecimal newKg = oldKg.multiply(BigDecimal.ONE.subtract(fraction(requirePct(reductionPct, "reductionPct"))), MC);
        return new MethaneComparison(oldKg, newKg, oldKg.subtract(newKg),
                toPct(BigDecimal.ONE.subtract(newKg.divide(oldKg, MC))));
    }

    /** CO2e avoided in tonnes = ΔCH4 (kg) × GWP / 1000. */
    public static BigDecimal co2eTonnes(BigDecimal methaneSavedKg, BigDecimal gwp) {
        return requireNonNegative(methaneSavedKg, "methaneSavedKg")
                .multiply(requireNonNegative(gwp, "gwp"), MC).divide(KG_PER_TONNE, MC);
    }

    /** Electricity produced = heads × kWh per head (config, or the digester's data sheet). */
    public static BigDecimal energyKwh(BigDecimal heads, BigDecimal kwhPerHead) {
        return requireNonNegative(heads, "heads").multiply(requireNonNegative(kwhPerHead, "kwhPerHead"), MC);
    }

    /** Nitrogen in the digestate that replaces mineral fertiliser = heads × kg N per head. */
    public static BigDecimal nitrogenKg(BigDecimal heads, BigDecimal kgNPerHead) {
        return requireNonNegative(heads, "heads").multiply(requireNonNegative(kgNPerHead, "kgNPerHead"), MC);
    }

    /** The farm uses its own electricity first; the rest is sold. */
    public static EnergyUse energyUse(BigDecimal producedKwh, BigDecimal farmConsumptionKwh) {
        requireNonNegative(producedKwh, "producedKwh");
        BigDecimal own = producedKwh.min(requireNonNegative(farmConsumptionKwh, "farmConsumptionKwh"));
        return new EnergyUse(producedKwh, own, producedKwh.subtract(own));
    }

    /** Own kWh × electricity price + sold kWh × sell price. */
    public static BigDecimal energyValueEur(EnergyUse use, BigDecimal pricePerKwh, BigDecimal sellPricePerKwh) {
        return use.ownKwh().multiply(requireNonNegative(pricePerKwh, "pricePerKwh"), MC)
                .add(use.soldKwh().multiply(requireNonNegative(sellPricePerKwh, "sellPricePerKwh"), MC));
    }

    /** kg N from digestate × the price of mineral nitrogen it replaces. */
    public static BigDecimal fertiliserValueEur(BigDecimal kgN, BigDecimal pricePerKgN) {
        return requireNonNegative(kgN, "kgN").multiply(requireNonNegative(pricePerKgN, "pricePerKgN"), MC);
    }

    /** The manure is valorised when it produces energy or the digestate is used or sold as fertiliser. */
    public static boolean isValorised(BigDecimal producedKwh, boolean digestateAsFertiliser) {
        return requireNonNegative(producedKwh, "producedKwh").signum() > 0 || digestateAsFertiliser;
    }
}
