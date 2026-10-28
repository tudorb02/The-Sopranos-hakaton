package ro.greenstruct.agro.engine.upgrade;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import static ro.greenstruct.agro.engine.Decimals.HUNDRED;
import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * README §4 step 4: the cheapest upgrade package that takes the indicator over the threshold. One refinement from
 * the demo (README §12, drip + sensors at 40% instead of drip alone at 33%): when a package that reaches Verde Plus
 * costs at most {@code maxExtraCostPct} more than the cheapest passing one, that one is proposed instead.
 */
public final class UpgradeSelector {

    private UpgradeSelector() {
    }

    /** meetsSafetyMargin: the indicator clears the threshold by the module's safety margin. */
    public record Candidate(String id, BigDecimal costEur, BigDecimal indicatorPct, boolean passes,
                            boolean meetsSafetyMargin) {
    }

    /**
     * thresholdPct and verdePlusMultiplier may be null for modules without a percentage threshold: then only the
     * cheapest passing package is chosen. Packages with the safety margin win over those that pass without it.
     */
    public static Optional<Candidate> select(List<Candidate> candidates, BigDecimal thresholdPct,
                                             BigDecimal verdePlusMultiplier, BigDecimal maxExtraCostPct) {
        List<Candidate> passing = candidates.stream().filter(Candidate::passes).toList();
        List<Candidate> safe = passing.stream().filter(Candidate::meetsSafetyMargin).toList();
        List<Candidate> eligible = safe.isEmpty() ? passing : safe;
        Comparator<Candidate> cheapestFirst = Comparator.comparing(Candidate::costEur)
                .thenComparing(Comparator.comparing(Candidate::indicatorPct).reversed());
        Optional<Candidate> cheapest = eligible.stream().min(cheapestFirst);
        if (cheapest.isEmpty() || thresholdPct == null || verdePlusMultiplier == null || maxExtraCostPct == null) {
            return cheapest;
        }
        BigDecimal verdePlusMin = thresholdPct.multiply(verdePlusMultiplier, MC);
        BigDecimal costCeiling = cheapest.get().costEur()
                .multiply(BigDecimal.ONE.add(maxExtraCostPct.divide(HUNDRED, MC), MC), MC);
        return eligible.stream()
                .filter(c -> c.indicatorPct().compareTo(verdePlusMin) >= 0 && c.costEur().compareTo(costCeiling) <= 0)
                .min(cheapestFirst)
                .or(() -> cheapest);
    }
}
