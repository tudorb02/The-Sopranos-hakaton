package ro.greenstruct.agro.engine.machinery;

import java.math.BigDecimal;
import java.util.List;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;
import static ro.greenstruct.agro.engine.Decimals.requirePositive;
import static ro.greenstruct.agro.engine.Decimals.toPct;

public final class MachineryCalculator {

    private MachineryCalculator() {
    }

    /**
     * Baseline litres = ha × l/ha. Savings stack multiplicatively, each applied to what is left:
     * proposed = baseline × Π(1 − sᵢ), e.g. new tractor 12% then auto-steer 10%.
     */
    public static FuelComparison fuel(BigDecimal hectares, BigDecimal baselineLitresPerHa, List<BigDecimal> savingPcts) {
        BigDecimal baseline = requireNonNegative(hectares, "hectares")
                .multiply(requireNonNegative(baselineLitresPerHa, "baselineLitresPerHa"), MC);
        BigDecimal remaining = BigDecimal.ONE;
        for (BigDecimal saving : savingPcts) {
            remaining = remaining.multiply(BigDecimal.ONE.subtract(fraction(requirePct(saving, "savingPct"))), MC);
        }
        BigDecimal proposed = baseline.multiply(remaining, MC);
        return new FuelComparison(baseline, proposed, baseline.subtract(proposed),
                toPct(BigDecimal.ONE.subtract(remaining)));
    }

    /** README §6, category 3: today's diesel per hectare = litres invoiced in 12 months / hectares worked. */
    public static BigDecimal litresPerHa(BigDecimal litres, BigDecimal hectares) {
        return requireNonNegative(litres, "litres").divide(requirePositive(hectares, "hectares"), MC);
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

    /** kg N saved = ha × kg N/ha × variable-rate saving. */
    public static BigDecimal nitrogenSavedKg(BigDecimal hectares, BigDecimal kgNPerHa, BigDecimal savingPct) {
        return requireNonNegative(hectares, "hectares")
                .multiply(requireNonNegative(kgNPerHa, "kgNPerHa"), MC)
                .multiply(fraction(requirePct(savingPct, "savingPct")), MC);
    }

    /** Fleet power must stay proportional to the farmed area (AFIR sizing rule); the limit comes from config. */
    public static PowerCheck power(BigDecimal totalHp, BigDecimal hectares, BigDecimal maxHpPerHa) {
        BigDecimal hpPerHa = requireNonNegative(totalHp, "totalHp").divide(requirePositive(hectares, "hectares"), MC);
        return new PowerCheck(hpPerHa, maxHpPerHa, hpPerHa.compareTo(requirePositive(maxHpPerHa, "maxHpPerHa")) <= 0);
    }
}
