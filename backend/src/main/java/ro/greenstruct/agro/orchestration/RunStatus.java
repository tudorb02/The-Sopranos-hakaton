package ro.greenstruct.agro.orchestration;

import java.util.Map;
import java.util.Set;

/** Lifecycle of a dossier, as in the README: CREAT → DATE_FIRMA → AGENT_1 → AGENT_2 → AGENT_3 → GATA → APROBAT → MONITORIZARE. */
public enum RunStatus {
    CREAT, DATE_FIRMA, AGENT_1, AGENT_2, AGENT_3, GATA, APROBAT, MONITORIZARE, ESUAT;

    private static final Map<RunStatus, Set<RunStatus>> NEXT = Map.of(
            CREAT, Set.of(DATE_FIRMA, ESUAT),
            DATE_FIRMA, Set.of(AGENT_1, ESUAT),
            AGENT_1, Set.of(AGENT_2, ESUAT),
            AGENT_2, Set.of(AGENT_3, ESUAT),
            AGENT_3, Set.of(GATA, ESUAT),
            GATA, Set.of(APROBAT),
            APROBAT, Set.of(MONITORIZARE));

    public boolean canMoveTo(RunStatus next) {
        return NEXT.getOrDefault(this, Set.of()).contains(next);
    }
}
