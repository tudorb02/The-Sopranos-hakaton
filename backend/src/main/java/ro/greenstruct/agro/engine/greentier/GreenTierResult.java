package ro.greenstruct.agro.engine.greentier;

import java.math.BigDecimal;

/**
 * thresholdMet: the configuration the green loan would finance meets the module's green criterion;
 * upgradeNeeded: the investment as requested did not meet it on its own. financedIndicatorPct and
 * verdePlusMinPct (threshold × multiplier) are set for MIN_PCT modules only, null otherwise.
 */
public record GreenTierResult(GreenTier tier, boolean thresholdMet, boolean upgradeNeeded,
                              BigDecimal financedIndicatorPct, BigDecimal verdePlusMinPct) {
}
