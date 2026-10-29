package ro.greenstruct.agro.tools;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Every calc of every dossier. calcId = calc_ + first 12 hex of sha256(run, tool, key, rounded value): the
 * same computation always gets the same id, so a replayed run produces identical references.
 */
@Component
public class CalcStore {

    private static final int VALUE_SCALE = 2;

    private final Map<String, Map<String, Calc>> calcsByRun = new ConcurrentHashMap<>();

    public Calc create(String runId, String tool, String key, String labelRo, BigDecimal rawValue, Unit unit,
                       String formula, String sourceRo, List<String> dependsOn, List<Calc.SeriesPoint> series) {
        key = normalizeKey(key);
        labelRo = cut(labelRo, 160);
        formula = formula == null ? null : cut(formula, 300);
        sourceRo = sourceRo == null ? null : cut(sourceRo, 240);
        BigDecimal value = rawValue.setScale(VALUE_SCALE, RoundingMode.HALF_EVEN).stripTrailingZeros();
        if (value.scale() < 0) {
            value = value.setScale(0);
        }
        Calc calc = new Calc(calcId(runId, tool, key, value), tool, key, labelRo, value, unit, display(value, unit),
                formula, sourceRo, dependsOn == null ? List.of() : List.copyOf(dependsOn),
                series == null ? List.of() : List.copyOf(series));
        calcsByRun.computeIfAbsent(runId, id -> new LinkedHashMap<>());
        synchronized (calcsByRun.get(runId)) {
            // The same computation always has the same id; the first description stays, so the view and the
            // events of the dossier never disagree.
            return calcsByRun.get(runId).computeIfAbsent(calc.calcId(), id -> calc);
        }
    }

    /** camelCase → snake_case, as the contract requires for keys (^[a-z][a-z0-9_.]{2,80}$). */
    static String normalizeKey(String key) {
        return key.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
    }

    private static String cut(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    public Optional<Calc> find(String runId, String calcId) {
        Map<String, Calc> calcs = calcsByRun.get(runId);
        return calcs == null ? Optional.empty() : Optional.ofNullable(calcs.get(calcId));
    }

    /** The most recent calc with this key, e.g. option_b.installment. */
    public Optional<Calc> latestByKey(String runId, String key) {
        key = normalizeKey(key);
        List<Calc> all = all(runId);
        for (int i = all.size() - 1; i >= 0; i--) {
            if (all.get(i).key().equals(key)) {
                return Optional.of(all.get(i));
            }
        }
        return Optional.empty();
    }

    public List<Calc> all(String runId) {
        Map<String, Calc> calcs = calcsByRun.get(runId);
        if (calcs == null) {
            return List.of();
        }
        synchronized (calcs) {
            return new ArrayList<>(calcs.values());
        }
    }

    static String calcId(String runId, String tool, String key, BigDecimal value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(
                    (runId + "|" + tool + "|" + key + "|" + value.toPlainString()).getBytes(StandardCharsets.UTF_8));
            return "calc_" + HexFormat.of().formatHex(hash).substring(0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** English formatting: 85,000 EUR, 15.03%, 1,760.34 EUR/month. */
    static String display(BigDecimal value, Unit unit) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols();
        symbols.setGroupingSeparator(',');
        symbols.setDecimalSeparator('.');
        symbols.setMinusSign('−');
        String pattern = unit.displayDecimals() == 0 ? "#,##0" : "#,##0." + "0".repeat(unit.displayDecimals());
        DecimalFormat format = new DecimalFormat(pattern, symbols);
        format.setRoundingMode(RoundingMode.HALF_EVEN);
        return format.format(value) + unit.suffix();
    }
}
