package ro.greenstruct.agro.engine.finance;

import java.math.BigDecimal;

/** Option A (as requested) vs option B (green package); a positive advantage means B costs the farm less. */
public record ScenarioComparison(ScenarioCost baseline, ScenarioCost proposed, BigDecimal netAdvantageEur) {

    public static ScenarioComparison of(ScenarioCost baseline, ScenarioCost proposed) {
        return new ScenarioComparison(baseline, proposed, baseline.netCostEur().subtract(proposed.netCostEur()));
    }

    public boolean proposedIsBetter() {
        return netAdvantageEur.signum() > 0;
    }
}
