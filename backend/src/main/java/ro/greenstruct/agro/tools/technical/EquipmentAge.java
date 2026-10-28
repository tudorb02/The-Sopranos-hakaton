package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * New or second-hand, and how old: read from the offer (CONDITION, MANUFACTURE_YEAR) and used by the fuel
 * calculation, AFIR eligibility (new equipment only), the loan term limit and the green label.
 */
public final class EquipmentAge {

    public static final String USED = "used";
    public static final String MANUFACTURE_YEAR = "manufactureYear";
    /** 1 when the offer states the required emission stage (Stage V), 0 when it states another one. */
    public static final String STAGE_V = "stageV";

    private EquipmentAge() {
    }

    /**
     * Attributes for one offer line: used = 1 for second-hand, manufactureYear when printed, stageV when the line
     * states an emission stage and the module requires one (requiredStage, e.g. "V"; null for no requirement).
     */
    public static Map<String, BigDecimal> fromOfferLine(DocumentFacts.LineFacts line, int currentYear,
                                                        String requiredStage) {
        Map<String, BigDecimal> attributes = new HashMap<>();
        BigDecimal year = line.numbers().get("MANUFACTURE_YEAR");
        if (year != null) {
            attributes.put(MANUFACTURE_YEAR, year);
        }
        String stage = line.texts().get("EMISSION_STAGE");
        if (requiredStage != null && stage != null) {
            String declared = stage.toUpperCase(Locale.ROOT).replace("STAGE", "").replace("TREAPTA", "").trim();
            attributes.put(STAGE_V, declared.equals(requiredStage) ? BigDecimal.ONE : BigDecimal.ZERO);
        }
        String condition = line.texts().getOrDefault("CONDITION", "").toLowerCase(Locale.ROOT);
        boolean used = condition.contains("second") || condition.contains("folosit") || condition.contains("utilizat")
                || condition.contains("rulat");
        boolean declaredNew = condition.contains("nou");
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

    /** Specific fuel consumption (g/kWh) of a tractor of this age, from the module's age bands. */
    public static BigDecimal specificFuel(ToolContext context, int ageYears) {
        JsonNode bands = context.module().parameters().path("specificFuelByAge").path("value");
        for (JsonNode band : bands) {
            if (ageYears <= band.path("maxAgeYears").asInt()) {
                return band.path("gPerKwh").decimalValue();
            }
        }
        throw new IllegalStateException("No fuel band for a " + ageYears + "-year-old tractor");
    }

    /** Fuel saving of a newer tractor over an older one: 1 − g/kWh(newer) / g/kWh(older), never negative. */
    public static BigDecimal savingFraction(ToolContext context, int offeredAge, int replacedAge) {
        BigDecimal saving = BigDecimal.ONE.subtract(
                specificFuel(context, offeredAge).divide(specificFuel(context, replacedAge), MC));
        return saving.max(BigDecimal.ZERO);
    }
}
