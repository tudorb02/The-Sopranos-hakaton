package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * One irrigated crop: its area, its seasonal crop coefficient Kc and, for its location, the reference
 * evapotranspiration ET₀ and the effective rain of the irrigation season, both in mm.
 */
public record CropDemand(String crop, BigDecimal hectares, BigDecimal kc, BigDecimal et0Mm, BigDecimal effectiveRainMm) {

    public CropDemand {
        requireNonNegative(hectares, "hectares");
        requireNonNegative(kc, "kc");
        requireNonNegative(et0Mm, "et0Mm");
        requireNonNegative(effectiveRainMm, "effectiveRainMm");
    }
}
