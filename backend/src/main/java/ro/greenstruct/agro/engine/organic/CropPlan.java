package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;

/** One crop of the farm today: hectares, conventional yield (t/ha) and conventional price (EUR/t). */
public record CropPlan(String crop, BigDecimal ha, BigDecimal yieldTPerHa, BigDecimal priceEurPerT) {
}
