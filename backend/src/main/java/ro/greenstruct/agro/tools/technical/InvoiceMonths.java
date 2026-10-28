package ro.greenstruct.agro.tools.technical;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The calendar month (1 = January) of an invoice period as the model copied it from the document:
 * "01.10.2025", "10.2025", "2025-10-01" or "octombrie 2025".
 */
final class InvoiceMonths {

    private static final Pattern ISO = Pattern.compile("(\\d{4})-(\\d{1,2})");
    private static final Pattern DAY_MONTH_YEAR = Pattern.compile("(\\d{1,2})[./](\\d{1,2})[./](\\d{4})");
    private static final Pattern MONTH_YEAR = Pattern.compile("(\\d{1,2})[./](\\d{4})");
    private static final List<String> NAMES = List.of("ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
            "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie");

    private InvoiceMonths() {
    }

    static Optional<Integer> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        Matcher iso = ISO.matcher(raw);
        if (iso.find()) {
            return valid(Integer.parseInt(iso.group(2)));
        }
        Matcher dmy = DAY_MONTH_YEAR.matcher(raw);
        if (dmy.find()) {
            return valid(Integer.parseInt(dmy.group(2)));
        }
        Matcher my = MONTH_YEAR.matcher(raw);
        if (my.find()) {
            return valid(Integer.parseInt(my.group(1)));
        }
        String plain = Normalizer.normalize(raw, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        for (int i = 0; i < NAMES.size(); i++) {
            if (plain.contains(NAMES.get(i))) {
                return Optional.of(i + 1);
            }
        }
        return Optional.empty();
    }

    private static Optional<Integer> valid(int month) {
        return month >= 1 && month <= 12 ? Optional.of(month) : Optional.empty();
    }
}
