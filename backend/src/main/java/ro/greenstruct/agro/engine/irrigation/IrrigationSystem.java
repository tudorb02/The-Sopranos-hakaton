package ro.greenstruct.agro.engine.irrigation;

import java.math.BigDecimal;

import static ro.greenstruct.agro.engine.Decimals.requirePct;

/**
 * An irrigation set-up: application efficiency (share of pumped water that reaches the roots) and the
 * reduction of the net need obtained by scheduling, e.g. soil moisture sensors. Both in percentage points.
 */
public record IrrigationSystem(String systemId, BigDecimal efficiencyPct, BigDecimal demandReductionPct) {

    public IrrigationSystem {
        requirePct(efficiencyPct, "efficiencyPct");
        if (efficiencyPct.signum() == 0) {
            throw new IllegalArgumentException("efficiencyPct must be > 0");
        }
        requirePct(demandReductionPct, "demandReductionPct");
    }
}
