package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * One irrigated crop: area, crop coefficient Kc and, for the location, the seasonal reference evapotranspiration ET0
 * and the effective rain, both in mm (README §6, category 1).
 */
public record CropNeed(String crop, BigDecimal hectares, BigDecimal kc, BigDecimal et0Mm, BigDecimal effectiveRainMm) {

    public CropNeed {
        requireNonNegative(hectares, "hectares");
        requireNonNegative(kc, "kc");
        requireNonNegative(et0Mm, "et0Mm");
        requireNonNegative(effectiveRainMm, "effectiveRainMm");
    }
}
