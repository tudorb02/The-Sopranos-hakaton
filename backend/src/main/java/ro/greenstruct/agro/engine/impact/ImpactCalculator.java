package ro.greenstruct.agro.engine.impact;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/** CO₂ in tonnes; emission factors come from config with their source. */
public final class ImpactCalculator {

    private static final BigDecimal KG_PER_TONNE = BigDecimal.valueOf(1_000);
    private static final BigDecimal G_PER_TONNE = BigDecimal.valueOf(1_000_000);

    private ImpactCalculator() {
    }

    /**
     * CO₂ avoided by a saving of litres, kWh, ...: saved × kg CO₂ per unit / 1000. A negative saving (the
     * investment uses more, e.g. a sprinkler pumping at higher pressure than furrows) gives negative avoided CO₂.
     */
    public static BigDecimal co2AvoidedTonnes(BigDecimal savedQuantity, BigDecimal kgCo2PerUnit) {
        return savedQuantity.multiply(requireNonNegative(kgCo2PerUnit, "kgCo2PerUnit"), MC).divide(KG_PER_TONNE, MC);
    }

    /** README §6, category 3: CO₂e avoided = (Δ litres × kg CO₂/l + Δ kg N × kg CO₂e/kg N) / 1000. */
    public static BigDecimal co2eFromDieselAndNitrogenTonnes(BigDecimal savedLitres, BigDecimal kgCo2PerLitre,
                                                             BigDecimal savedKgN, BigDecimal kgCo2ePerKgN) {
        return co2AvoidedTonnes(savedLitres, kgCo2PerLitre).add(co2AvoidedTonnes(savedKgN, kgCo2ePerKgN), MC);
    }

    public static BigDecimal co2FromDieselTonnes(BigDecimal litres, BigDecimal kgCo2PerLitre) {
        return requireNonNegative(litres, "litres")
                .multiply(requireNonNegative(kgCo2PerLitre, "kgCo2PerLitre"), MC)
                .divide(KG_PER_TONNE, MC);
    }

    /** Generic: quantity (litres, kWh, ...) × kg CO₂ per unit / 1000. */
    public static BigDecimal co2Tonnes(BigDecimal quantity, BigDecimal kgCo2PerUnit) {
        return requireNonNegative(quantity, "quantity")
                .multiply(requireNonNegative(kgCo2PerUnit, "kgCo2PerUnit"), MC)
                .divide(KG_PER_TONNE, MC);
    }

    public static BigDecimal co2FromElectricityTonnes(BigDecimal kwh, BigDecimal gCo2PerKwh) {
        return requireNonNegative(kwh, "kwh")
                .multiply(requireNonNegative(gCo2PerKwh, "gCo2PerKwh"), MC)
                .divide(G_PER_TONNE, MC);
    }
}
