package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/** Irrigated area of one crop and its net seasonal water need (what the plants must receive). */
public record CropArea(String crop, BigDecimal hectares, BigDecimal netNeedM3PerHa) {

    public CropArea {
        requireNonNegative(hectares, "hectares");
        requireNonNegative(netNeedM3PerHa, "netNeedM3PerHa");
    }
}
