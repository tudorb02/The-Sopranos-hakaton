package ro.greenstruct.agro.external.model;

import java.time.Instant;

/** Where a piece of farm data came from; mode is LIVE, MOCK or CACHE (the badge in the officer's view). */
public record DataSourceInfo(String source, String mode, Instant fetchedAt) {
}
