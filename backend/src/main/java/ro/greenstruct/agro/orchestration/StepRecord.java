package ro.greenstruct.agro.orchestration;

import java.time.Instant;

/** Audit trail of one pipeline step; mode is LIVE, CACHE or FALLBACK once the fallback layer exists. */
public record StepRecord(RunStatus step, String mode, Instant startedAt, long durationMs, String note) {
}
