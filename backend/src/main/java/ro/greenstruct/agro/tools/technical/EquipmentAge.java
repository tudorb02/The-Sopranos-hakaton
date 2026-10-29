package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * New or second-hand, and how old: read from the offer (CONDITION, MANUFACTURE_YEAR) and used by AFIR
 * eligibility (new equipment only), the loan term limit and the green label.
 */
public final class EquipmentAge {

    public static final String USED = "used";
    public static final String MANUFACTURE_YEAR = "manufactureYear";

    /** English condition words, as whole words so "unused" or "renewed" do not count. */
    private static final Pattern USED_EN = Pattern.compile("\\bused\\b|\\bpre-?owned\\b");
    private static final Pattern NEW_EN = Pattern.compile("\\bnew\\b");

    private EquipmentAge() {
    }

    /** Attributes for one offer line: used = 1 for second-hand, manufactureYear when printed. */
    public static Map<String, BigDecimal> fromOfferLine(DocumentFacts.LineFacts line, int currentYear) {
        Map<String, BigDecimal> attributes = new HashMap<>();
        BigDecimal year = line.numbers().get("MANUFACTURE_YEAR");
        if (year != null) {
            attributes.put(MANUFACTURE_YEAR, year);
        }
        String condition = line.texts().getOrDefault("CONDITION", "").toLowerCase(Locale.ROOT);
        boolean used = condition.contains("second") || condition.contains("folosit") || condition.contains("utilizat")
                || condition.contains("rulat") || USED_EN.matcher(condition).find();
        boolean declaredNew = condition.contains("nou") || NEW_EN.matcher(condition).find();
        if (!used && !declaredNew && year != null) {
            used = currentYear - year.intValue() >= 2;
        }
        attributes.put(USED, used ? BigDecimal.ONE : BigDecimal.ZERO);
        return attributes;
    }

    public static boolean isUsed(InvestmentComponent component) {
        return BigDecimal.ONE.compareTo(component.attributes().getOrDefault(USED, BigDecimal.ZERO)) == 0;
    }

    /** Age in years at the analysis date; second-hand without a year gets the configured default age. */
    public static int ageYears(ToolContext context, InvestmentComponent component) {
        BigDecimal year = component.attribute(MANUFACTURE_YEAR);
        if (year != null) {
            return Math.max(0, context.today().getYear() - year.intValue());
        }
        return isUsed(component) ? context.param("usedAgeYearsDefault").intValue() : 0;
    }
}
