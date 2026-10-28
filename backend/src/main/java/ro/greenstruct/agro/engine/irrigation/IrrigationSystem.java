package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;
import static ro.greenstruct.agro.engine.Decimals.requirePct;

/**
 * An irrigation set-up: application efficiency (share of the extracted water that reaches the roots), the
 * reduction of the need obtained with soil moisture sensors (both in percentage points) and the working
 * pressure the pump must add, in metres of water column.
 */
public record IrrigationSystem(String systemId, BigDecimal efficiencyPct, BigDecimal demandReductionPct,
                               BigDecimal pressureHeadM) {

    public IrrigationSystem {
        requirePct(efficiencyPct, "efficiencyPct");
        if (efficiencyPct.signum() == 0) {
            throw new IllegalArgumentException("efficiencyPct must be > 0");
        }
        requirePct(demandReductionPct, "demandReductionPct");
        requireNonNegative(pressureHeadM, "pressureHeadM");
    }
}
