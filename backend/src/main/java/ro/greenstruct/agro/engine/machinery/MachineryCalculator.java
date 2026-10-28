package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;
import java.util.List;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/** README §6, category 3: diesel and nitrogen per hectare, savings and CO₂e. All inputs come from documents or config. */
public final class MachineryCalculator {

    private MachineryCalculator() {
    }

    /** Row 1: {@code l_ha_old = litres per year (invoices) / hectares worked}. */
    public static BigDecimal litresPerHa(BigDecimal litresPerYear, BigDecimal hectares) {
        return requireNonNegative(litresPerYear, "litresPerYear").divide(requirePositive(hectares, "hectares"), MC);
    }

    /** Average of the machines' data-sheet values weighted by power × quantity (several tractors in one offer). */
    public static BigDecimal weightedAverage(List<BigDecimal> values, List<BigDecimal> weights) {
        if (values.isEmpty() || values.size() != weights.size()) {
            throw new IllegalArgumentException("values and weights must be non-empty and of the same size");
        }
        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < values.size(); i++) {
            sum = sum.add(requireNonNegative(values.get(i), "value")
                    .multiply(requirePositive(weights.get(i), "weight"), MC));
            total = total.add(weights.get(i));
        }
        return sum.divide(total, MC);
    }

    /**
     * Rows 2-3. The tractor's consumption per hectare is cut by every precision upgrade, each applied to what is
     * left: {@code l_ha = l_ha_tractor × Π(1 − r_i)}. Reduction = {@code 1 − l_ha / l_ha_old}.
     */
    public static FuelComparison fuel(BigDecimal hectares, BigDecimal litresPerHaOld, BigDecimal tractorLitresPerHa,
                                      List<BigDecimal> precisionReductionPcts) {
        requirePositive(litresPerHaOld, "litresPerHaOld");
        BigDecimal litresPerHa = requireNonNegative(tractorLitresPerHa, "tractorLitresPerHa");
        for (BigDecimal reduction : precisionReductionPcts) {
            litresPerHa = litresPerHa.multiply(
                    BigDecimal.ONE.subtract(fraction(requirePct(reduction, "reductionPct"))), MC);
        }
        BigDecimal saved = litresPerHaOld.subtract(litresPerHa).multiply(requireNonNegative(hectares, "hectares"), MC);
        return new FuelComparison(litresPerHaOld, litresPerHa, saved,
                toPct(BigDecimal.ONE.subtract(litresPerHa.divide(litresPerHaOld, MC))));
    }

    /** Row 4: nitrogen reduction = sum of the catalog reductions of the dosing technologies (percentage points). */
    public static BigDecimal nitrogenReductionPct(List<BigDecimal> reductionPcts) {
        BigDecimal sum = BigDecimal.ZERO;
        for (BigDecimal reduction : reductionPcts) {
            sum = sum.add(requireNonNegative(reduction, "reductionPct"));
        }
        return requirePct(sum, "nitrogenReductionPct");
    }

    /** kg N saved per year = kg N per year (fertiliser invoices) × reduction. */
    public static BigDecimal nitrogenSavedKg(BigDecimal kgNPerYear, BigDecimal reductionPct) {
        return requireNonNegative(kgNPerYear, "kgNPerYear")
                .multiply(fraction(requirePct(reductionPct, "reductionPct")), MC);
    }

    public static BigDecimal dieselSavingEur(BigDecimal savedLitres, BigDecimal dieselEurPerLitre) {
        return savedLitres.multiply(requireNonNegative(dieselEurPerLitre, "dieselEurPerLitre"), MC);
    }

    public static BigDecimal nitrogenSavingEur(BigDecimal savedKgN, BigDecimal nitrogenEurPerKg) {
        return savedKgN.multiply(requireNonNegative(nitrogenEurPerKg, "nitrogenEurPerKg"), MC);
    }

    /** Row 5: {@code Δl × diesel price + ΔkgN × nitrogen price}, in EUR per year. */
    public static BigDecimal savingsEur(BigDecimal savedLitres, BigDecimal dieselEurPerLitre, BigDecimal savedKgN,
                                        BigDecimal nitrogenEurPerKg) {
        return dieselSavingEur(savedLitres, dieselEurPerLitre).add(nitrogenSavingEur(savedKgN, nitrogenEurPerKg));
    }

    /** Row 6: {@code (Δlitres × kgCO2/l + ΔkgN × kgCO2e/kgN) / 1000}, t CO₂e per year. */
    public static BigDecimal co2eTonnes(BigDecimal savedLitres, BigDecimal kgCo2PerLitre, BigDecimal savedKgN,
                                        BigDecimal kgCo2ePerKgN) {
        return savedLitres.multiply(requireNonNegative(kgCo2PerLitre, "kgCo2PerLitre"), MC)
                .add(savedKgN.multiply(requireNonNegative(kgCo2ePerKgN, "kgCo2ePerKgN"), MC))
                .divide(BigDecimal.valueOf(1_000), MC);
    }

    /** Net diesel cost for a VAT payer: pump price / (1 + VAT) − agricultural excise refund, converted to EUR. */
    public static BigDecimal netDieselEurPerLitre(BigDecimal pumpPriceLeiPerLitre, BigDecimal vatPct,
                                                  BigDecimal exciseRefundLeiPerLitre, BigDecimal ronPerEur) {
        BigDecimal withoutVat = requireNonNegative(pumpPriceLeiPerLitre, "pumpPriceLeiPerLitre")
                .divide(BigDecimal.ONE.add(fraction(requireNonNegative(vatPct, "vatPct"))), MC);
        BigDecimal netLei = withoutVat.subtract(requireNonNegative(exciseRefundLeiPerLitre, "exciseRefundLeiPerLitre"));
        if (netLei.signum() < 0) {
            throw new IllegalArgumentException("excise refund exceeds the price without VAT");
        }
        return netLei.divide(requirePositive(ronPerEur, "ronPerEur"), MC);
    }

    /** Offered power must stay proportional to the farmed area (AFIR sizing rule); the limit comes from config. */
    public static PowerCheck power(BigDecimal totalHp, BigDecimal hectares, BigDecimal maxHpPerHa) {
        BigDecimal hpPerHa = requireNonNegative(totalHp, "totalHp").divide(requirePositive(hectares, "hectares"), MC);
        return new PowerCheck(hpPerHa, maxHpPerHa, hpPerHa.compareTo(requirePositive(maxHpPerHa, "maxHpPerHa")) <= 0);
    }
}
