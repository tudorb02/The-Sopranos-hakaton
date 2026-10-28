package ro.greenstruct.agro.engine.energy;

import java.math.BigDecimal;
import java.util.List;

/**
 * The yearly energy balance of a photovoltaic installation against the farm's consumption.
 *
 * @param monthlyProductionKwh January to December
 * @param selfConsumedKwh      used on the farm: Σ min(production, daytime consumption) per month
 * @param exportedKwh          production − self-consumed, sold to the grid
 * @param exportSharePct       exported / production, in percent
 * @param selfShareOfProductionPct self-consumed / production, in percent
 * @param coveragePct          self-consumed / annual consumption, in percent
 */
public record PvBalance(BigDecimal kwp, BigDecimal productionKwh, List<BigDecimal> monthlyProductionKwh,
                        BigDecimal selfConsumedKwh, BigDecimal exportedKwh, BigDecimal exportSharePct,
                        BigDecimal selfShareOfProductionPct, BigDecimal coveragePct) {
}
