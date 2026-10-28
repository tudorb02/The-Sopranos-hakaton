package ro.greenstruct.agro.tools;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One number produced by the deterministic engine (calcResult in contracts/schemas/event.json). The only
 * place where figures appear; agents refer to them by calcId and the UI shows display.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record Calc(
        String calcId,
        String tool,
        String key,
        String labelRo,
        BigDecimal value,
        Unit unit,
        String display,
        String formula,
        String sourceRo,
        List<String> dependsOn,
        List<SeriesPoint> series) {

    /** One month of a schedule chart; values keys are payment, interest, principal, balance, savings. */
    public record SeriesPoint(String period, Map<String, BigDecimal> values) {
    }
}
