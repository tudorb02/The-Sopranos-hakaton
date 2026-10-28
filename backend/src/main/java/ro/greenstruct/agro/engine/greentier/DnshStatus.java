package ro.greenstruct.agro.engine.greentier;

import java.util.Collection;
import java.util.Comparator;

/** The DNSH statuses of contracts/schemas (dnshStatus), declared from best to worst. */
public enum DnshStatus {
    PASS,
    PASS_WITH_CONDITIONS,
    MISSING_DATA,
    FAIL;

    /** The worst status over the DNSH objectives; no check at all counts as missing data. */
    public static DnshStatus overall(Collection<DnshStatus> statuses) {
        return statuses.stream().max(Comparator.naturalOrder()).orElse(MISSING_DATA);
    }

    /** Every objective passed without conditions: what Verde Plus needs. */
    public boolean complete() {
        return this == PASS;
    }

    /** Conditions and missing data become conditions before drawdown (README §5.3); only a failure blocks. */
    public boolean acceptable() {
        return this != FAIL;
    }
}
