package ro.greenstruct.agro.engine.greentier;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.Optional;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.requireNonNegative;

/**
 * The green tier of README §4 step 8, decided on the configuration the green loan would finance (the requested
 * investment, or the upgraded one when the farmer accepts the upgrade), in this order:
 * <ol>
 *   <li>CLASIC: the financed configuration is below the threshold (no upgrade accepted, or one that does not
 *       reach it), or DNSH fails: an investment that does significant harm is never green;</li>
 *   <li>VERDE_PLUS: indicator ≥ threshold × multiplier (1.5 in config/pricing.json) and DNSH complete, also when
 *       an accepted upgrade got it there (README demo: drip + sensors, 40% on a 25% threshold);</li>
 *   <li>VERDE_CU_UPGRADE: the requested investment was below the threshold and the accepted upgrade reaches it;</li>
 *   <li>VERDE: the requested investment reaches the threshold, with DNSH passed or with conditions.</li>
 * </ol>
 * Modules without a percentage threshold (module threshold kind): BY_NATURE (renewable energy) is eligible as
 * such, CERTIFICATION (organic) needs an EU organic certificate or a conversion contract. Both get VERDE at most:
 * there is no indicator that could exceed a threshold by 50%, and their guidance (resizing, staged conversion)
 * does not change whether the criterion is met, so there is no "with upgrade" tier either.
 */
public final class GreenTierCalculator {

    private GreenTierCalculator() {
    }

    /** MIN_PCT modules; acceptedUpgradeIndicatorPct is empty when the farmer did not accept an upgrade. */
    public static GreenTierResult forThreshold(BigDecimal thresholdPct, BigDecimal verdePlusMultiplier,
                                               BigDecimal requestedIndicatorPct,
                                               Optional<BigDecimal> acceptedUpgradeIndicatorPct, DnshStatus dnsh) {
        requireNonNegative(thresholdPct, "thresholdPct");
        if (verdePlusMultiplier == null || verdePlusMultiplier.compareTo(BigDecimal.ONE) < 0) {
            throw new IllegalArgumentException("verdePlusMultiplier must be >= 1, was " + verdePlusMultiplier);
        }
        Objects.requireNonNull(requestedIndicatorPct, "requestedIndicatorPct");
        Objects.requireNonNull(dnsh, "dnsh");
        acceptedUpgradeIndicatorPct.ifPresent(upgraded -> {
            if (upgraded.compareTo(requestedIndicatorPct) < 0) {
                throw new IllegalArgumentException("An accepted upgrade cannot lower the indicator: "
                        + requestedIndicatorPct + " → " + upgraded);
            }
        });

        BigDecimal verdePlusMin = thresholdPct.multiply(verdePlusMultiplier, MC);
        BigDecimal financed = acceptedUpgradeIndicatorPct.orElse(requestedIndicatorPct);
        boolean requestedMeets = requestedIndicatorPct.compareTo(thresholdPct) >= 0;
        boolean financedMeets = financed.compareTo(thresholdPct) >= 0;

        GreenTier tier;
        if (!financedMeets || !dnsh.acceptable()) {
            tier = GreenTier.CLASIC;
        } else if (financed.compareTo(verdePlusMin) >= 0 && dnsh.complete()) {
            tier = GreenTier.VERDE_PLUS;
        } else if (!requestedMeets) {
            tier = GreenTier.VERDE_CU_UPGRADE;
        } else {
            tier = GreenTier.VERDE;
        }
        return new GreenTierResult(tier, financedMeets, !requestedMeets, financed, verdePlusMin);
    }

    /** BY_NATURE modules (renewable energy): eligible directly, so VERDE unless DNSH fails. */
    public static GreenTierResult byNature(DnshStatus dnsh) {
        Objects.requireNonNull(dnsh, "dnsh");
        return new GreenTierResult(dnsh.acceptable() ? GreenTier.VERDE : GreenTier.CLASIC, true, false, null, null);
    }

    /** CERTIFICATION modules (organic): VERDE with a certificate or conversion contract and no DNSH failure. */
    public static GreenTierResult byCertification(boolean certifiedOrInConversion, DnshStatus dnsh) {
        Objects.requireNonNull(dnsh, "dnsh");
        GreenTier tier = certifiedOrInConversion && dnsh.acceptable() ? GreenTier.VERDE : GreenTier.CLASIC;
        return new GreenTierResult(tier, certifiedOrInConversion, false, null, null);
    }
}
