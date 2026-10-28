package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;

/**
 * A part of the farm that enters conversion on 1 January of startYear. share is the fraction of every crop's
 * hectares (0.5 = half of each crop); what is not in a tranche stays conventional.
 */
public record Tranche(BigDecimal share, int startYear) {
}
