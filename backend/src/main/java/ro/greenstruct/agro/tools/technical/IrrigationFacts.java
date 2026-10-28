package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.irrigation.CropDemand;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * The irrigation parameters of config/modules/irigatii.json read the same way by compute_baseline and the
 * configurations: systems (efficiency, working pressure), Kc per crop, the climate zone of the farm, the pumping lift
 * and the price of water from the farm's source.
 */
final class IrrigationFacts {

    private static final String DEFAULT = "IMPLICIT";

    private IrrigationFacts() {
    }

    /** An irrigation system of the config, with the sensors' reduction when the configuration has sensors. */
    static IrrigationSystem system(ToolContext context, String systemId, boolean sensors) {
        JsonNode systems = context.module().parameters().path("systems").path("value");
        JsonNode spec = systems.path(systemId);
        if (spec.isMissingNode()) {
            throw new IllegalArgumentException("Sistem de irigare necunoscut „" + systemId + "”; valori: "
                    + String.join(", ", iterable(systems.fieldNames())));
        }
        BigDecimal reduction = sensors ? context.param("sensorDemandReductionPct") : BigDecimal.ZERO;
        return new IrrigationSystem(systemId, spec.path("efficiencyPct").decimalValue(), reduction,
                spec.path("pressureHeadM").decimalValue());
    }

    /** The system a configuration irrigates with: the most efficient one among its irrigation components. */
    static String systemOf(ToolContext context, List<InvestmentComponent> components) {
        JsonNode mapping = context.module().parameters().path("componentSystems").path("value");
        JsonNode systems = context.module().parameters().path("systems").path("value");
        Optional<String> best = components.stream()
                .map(c -> mapping.path(c.category()).asText(null))
                .filter(id -> id != null)
                .max((a, b) -> systems.path(a).path("efficiencyPct").decimalValue()
                        .compareTo(systems.path(b).path("efficiencyPct").decimalValue()));
        return best.orElseThrow(() -> new IllegalArgumentException("Configurația nu are un sistem de irigare"));
    }

    static boolean hasSensors(List<InvestmentComponent> components) {
        return components.stream().anyMatch(c -> "SOIL_MOISTURE_SENSORS".equals(c.category()));
    }

    /** The selected APIA parcels as crops: Kc of the crop, ET₀ and effective rain of the farm's climate zone. */
    static List<CropDemand> crops(ToolContext context, List<String> warnings) {
        JsonNode coefficients = context.module().parameters().path("cropCoefficients").path("value");
        JsonNode zone = climateZone(context, warnings);
        List<CropDemand> crops = new ArrayList<>();
        for (JsonNode parcel : FarmFacts.selectedParcels(context)) {
            String crop = parcel.path("crop").asText();
            JsonNode kc = coefficients.path(crop);
            if (kc.isMissingNode()) {
                kc = coefficients.path(DEFAULT);
                warnings.add("Nu avem Kc pentru cultura „" + crop + "”: folosim valoarea implicită");
            }
            crops.add(new CropDemand(crop, parcel.path("areaHa").decimalValue(), kc.decimalValue(),
                    zone.path("et0SeasonMm").decimalValue(), zone.path("effectiveRainSeasonMm").decimalValue()));
        }
        return crops;
    }

    /** The zone whose counties include the farm's county; the default zone, with a warning, otherwise. */
    static JsonNode climateZone(ToolContext context, List<String> warnings) {
        String zoneId = climateZoneId(context);
        if (DEFAULT.equals(zoneId)) {
            warnings.add("Nu avem date climatice pentru județul „" + county(context) + "”: folosim valorile implicite");
        }
        return context.module().parameters().path("climateZones").path("value").path(zoneId);
    }

    static String climateZoneId(ToolContext context) {
        String county = county(context);
        for (var entry : iterable(context.module().parameters().path("climateZones").path("value").fields())) {
            for (JsonNode listed : entry.getValue().path("counties")) {
                if (listed.asText().equals(county)) {
                    return entry.getKey();
                }
            }
        }
        return DEFAULT;
    }

    private static String county(ToolContext context) {
        return context.farm().company() == null ? "" : String.valueOf(context.farm().company().county());
    }

    /** Metres from the water level to the pump: the tool input, else the questionnaire answer pumping_head_m. */
    static BigDecimal liftM(ToolContext context, JsonNode input) {
        JsonNode value = input.has("pumpingHeadM") ? input.path("pumpingHeadM")
                : context.questionnaire().path("pumping_head_m");
        if (!value.isNumber() || value.decimalValue().signum() < 0) {
            throw new IllegalArgumentException("Lipsește adâncimea sau înălțimea de pompare (pumping_head_m, în metri)");
        }
        return value.decimalValue();
    }

    /** EUR per m³ for the farm's water source (questionnaire water_source). */
    static BigDecimal waterPrice(ToolContext context) {
        String source = context.questionnaire().path("water_source").asText("");
        JsonNode prices = context.module().parameters().path("waterPriceEurPerM3").path("value");
        if (!prices.path(source).isNumber()) {
            throw new IllegalArgumentException("Sursă de apă necunoscută „" + source + "”; valori: "
                    + String.join(", ", iterable(prices.fieldNames())));
        }
        return prices.path(source).decimalValue();
    }

    private static <T> List<T> iterable(Iterator<T> iterator) {
        List<T> items = new ArrayList<>();
        iterator.forEachRemaining(items::add);
        return items;
    }
}
