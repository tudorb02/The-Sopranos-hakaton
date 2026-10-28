package ro.greenstruct.agro.engine.funding;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;

/** Aid intensity and ceiling of a grant programme the farm is eligible for (e.g. AFIR DR-12: 65% up to 200.000 EUR). */
public record GrantTerms(String programId, BigDecimal intensityPct, BigDecimal capEur) {

    public GrantTerms {
        requirePct(intensityPct, "intensityPct");
        requireNonNegative(capEur, "capEur");
    }
}
