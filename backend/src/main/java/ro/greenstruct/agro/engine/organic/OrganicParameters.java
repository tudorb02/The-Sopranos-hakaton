package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;
import java.util.List;

/**
 * The economics of an organic conversion, all from config/modules/ecologic.json (README §6, category 6).
 * Percentages are percentage points (70 = 70%). conversionYieldPct has one entry per conversion year, so its
 * size is the length of the conversion period; certifiedYieldPct and organicPremiumPct apply after certification.
 */
public record OrganicParameters(
        List<BigDecimal> conversionYieldPct,
        BigDecimal certifiedYieldPct,
        BigDecimal organicPremiumPct,
        BigDecimal conventionalCostEurPerHa,
        BigDecimal organicCostEurPerHa,
        BigDecimal conversionPaymentEurPerHa,
        BigDecimal maintenancePaymentEurPerHa) {

    public OrganicParameters {
        conversionYieldPct = List.copyOf(conversionYieldPct);
        if (conversionYieldPct.isEmpty()) {
            throw new IllegalArgumentException("conversionYieldPct needs at least one conversion year");
        }
    }

    public int conversionYears() {
        return conversionYieldPct.size();
    }
}
