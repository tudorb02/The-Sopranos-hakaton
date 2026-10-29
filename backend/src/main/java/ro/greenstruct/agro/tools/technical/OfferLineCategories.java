package ro.greenstruct.agro.tools.technical;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * The extraction model sometimes files every offer line under OTHER. The module calculators read technical
 * fields only from lines of the right category (the methane reduction from the DIGESTER line, the energy from
 * COGENERATION), so an OTHER biogas offer gave 0% and 0 EUR savings (live run, 29.10.2026). This maps the
 * line description to the contract's componentCategory; the first matching keyword wins, so the specific
 * ones come first.
 */
final class OfferLineCategories {

    // Romanian words for the Romanian supplier documents, English ones for English offers and English readings.
    private static final List<Map.Entry<String, String>> KEYWORDS = List.of(
            Map.entry("senzori de umiditate", "SOIL_MOISTURE_SENSORS"),
            Map.entry("soil moisture", "SOIL_MOISTURE_SENSORS"),
            Map.entry("pompa solara", "SOLAR_PUMP"),
            Map.entry("solar pump", "SOLAR_PUMP"),
            Map.entry("picurare", "IRRIGATION_DRIP"),
            Map.entry("drip", "IRRIGATION_DRIP"),
            Map.entry("aspersi", "IRRIGATION_SPRINKLER"),
            Map.entry("tambur", "IRRIGATION_SPRINKLER"),
            Map.entry("sprinkler", "IRRIGATION_SPRINKLER"),
            Map.entry("hose-reel", "IRRIGATION_SPRINKLER"),
            Map.entry("hose reel", "IRRIGATION_SPRINKLER"),
            Map.entry("contor", "WATER_METER"),
            Map.entry("water meter", "WATER_METER"),
            Map.entry("electropompa", "PUMP"),
            Map.entry("pompa", "PUMP"),
            Map.entry("pump", "PUMP"),
            Map.entry("conducta", "PIPES"),
            Map.entry("pipe", "PIPES"),
            Map.entry("panouri fotovoltaice", "PV_SYSTEM"),
            Map.entry("fotovoltaic", "PV_SYSTEM"),
            Map.entry("photovoltaic", "PV_SYSTEM"),
            Map.entry("pv panel", "PV_SYSTEM"),
            Map.entry("invertor", "PV_SYSTEM"),
            Map.entry("inverter", "PV_SYSTEM"),
            Map.entry("digestor", "DIGESTER"),
            Map.entry("digester", "DIGESTER"),
            Map.entry("cogenerare", "COGENERATION"),
            Map.entry("cogeneration", "COGENERATION"),
            Map.entry("acoperire etansa", "DIGESTATE_COVER"),
            Map.entry("gastight cover", "DIGESTATE_COVER"),
            Map.entry("digestate cover", "DIGESTATE_COVER"),
            Map.entry("agregat frigorific", "REFRIGERATION_UNIT"),
            Map.entry("refrigeration unit", "REFRIGERATION_UNIT"),
            Map.entry("vaporizator", "REFRIGERATION_UNIT"),
            Map.entry("evaporator", "REFRIGERATION_UNIT"),
            Map.entry("panouri de izolatie", "INSULATION_PANELS"),
            Map.entry("insulation panel", "INSULATION_PANELS"),
            Map.entry("recuperare de caldura", "HEAT_RECOVERY"),
            Map.entry("heat recovery", "HEAT_RECOVERY"),
            Map.entry("uscator", "DRYER"),
            Map.entry("dryer", "DRYER"),
            Map.entry("ecrane termice", "GREENHOUSE_SCREEN"),
            Map.entry("thermal screen", "GREENHOUSE_SCREEN"),
            Map.entry("pilot automat", "PRECISION_GUIDANCE"),
            Map.entry("autosteer", "PRECISION_GUIDANCE"),
            Map.entry("auto-steer", "PRECISION_GUIDANCE"),
            Map.entry("dozare variabila", "PRECISION_VARIABLE_RATE"),
            Map.entry("variable rate", "PRECISION_VARIABLE_RATE"),
            Map.entry("variable-rate", "PRECISION_VARIABLE_RATE"),
            Map.entry("tractor", "TRACTOR"),
            Map.entry("combina", "COMBINE"),
            Map.entry("combine harvester", "COMBINE"),
            Map.entry("prasitoare", "IMPLEMENT"),
            Map.entry("hoe", "IMPLEMENT"),
            Map.entry("grapa", "IMPLEMENT"),
            Map.entry("harrow", "IMPLEMENT"),
            Map.entry("semanatoare", "IMPLEMENT"),
            Map.entry("seeder", "IMPLEMENT"),
            Map.entry("montaj", "INSTALLATION_WORKS"),
            Map.entry("proiectare", "INSTALLATION_WORKS"),
            Map.entry("installation", "INSTALLATION_WORKS"),
            Map.entry("commissioning", "INSTALLATION_WORKS"));

    private OfferLineCategories() {
    }

    /** The line's own category, or the one its description names when the model left it as OTHER. */
    static String of(String category, String descriptionRo) {
        if (category != null && !category.isBlank() && !"OTHER".equals(category)) {
            return category;
        }
        return infer(descriptionRo).orElse("OTHER");
    }

    static Optional<String> infer(String descriptionRo) {
        if (descriptionRo == null) {
            return Optional.empty();
        }
        String text = Normalizer.normalize(descriptionRo.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return KEYWORDS.stream().filter(k -> text.contains(k.getKey())).map(Map.Entry::getValue).findFirst();
    }
}
