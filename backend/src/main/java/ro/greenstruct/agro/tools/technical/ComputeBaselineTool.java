package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.CropArea;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Today's situation on the selected parcels: water and pumping energy (irrigation) or diesel and nitrogen
 * (machinery). Norms from config, confirmed or replaced by the invoices already extracted.
 */
@Component
public class ComputeBaselineTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_baseline";
    }

    @Override
    public String description() {
        return "Computes today's consumption on the selected parcels (water and energy for irrigation, diesel and "
                + "nitrogen for machinery) from norms and the extracted invoices. Extract the invoices first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "currentSystem": {"type": "string", "enum": ["ASPERSIE_VECHE", "ASPERSIE", "PICURARE", "BRAZDE"],
                    "description": "Irrigation only; defaults to the questionnaire answer irrigation_current."},
                  "currentFleet": {"type": "object", "additionalProperties": false,
                    "description": "Machinery only; defaults to the questionnaire (current_tractors, replaced_tractors, replaced_fleet_age).",
                    "properties": {
                      "totalCount": {"type": "integer", "minimum": 0},
                      "replacedCount": {"type": "integer", "minimum": 0},
                      "averageAgeYears": {"type": "integer", "minimum": 0}}}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        return switch (context.module().calculator()) {
            case "irrigation" -> irrigation(input, context);
            case "machinery" -> machinery(input, context);
            default -> throw new IllegalArgumentException("Modulul nu are calculator pentru situația actuală");
        };
    }

    private ToolOutput irrigation(JsonNode input, ToolContext context) {
        String system = input.path("currentSystem").asText(context.questionnaire().path("irrigation_current").asText(""));
        JsonNode efficiencies = context.module().parameters().path("currentEfficiencyPct").path("value");
        if (!efficiencies.has(system)) {
            throw new IllegalArgumentException("Sistem actual necunoscut „" + system + "”; valori: " + efficiencies.fieldNames());
        }
        BigDecimal efficiency = efficiencies.path(system).decimalValue();
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        BigDecimal water = IrrigationCalculator.grossWaterM3(
                List.of(new CropArea("parcele", area, context.param("netNeedM3PerHa"))),
                new IrrigationSystem(system, efficiency, BigDecimal.ZERO));

        Optional<BigDecimal> invoiced = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"));
        BigDecimal energy = invoiced.orElseGet(() -> water.multiply(context.param("pumpingKwhPerM3Fallback"), MC));

        Calc areaCalc = context.calc("baseline.area", "Suprafața parcelelor alese", area, Unit.HA).source("APIA").add();
        Calc effCalc = context.calc("baseline.efficiency", "Eficiența sistemului actual", efficiency, Unit.PCT)
                .source(context.paramSource("currentEfficiencyPct")).add();
        Calc waterCalc = context.calc("baseline.water", "Apă pompată azi", water, Unit.M3_PER_YEAR)
                .formula("ha × necesar net / eficiență actuală").dependsOn(areaCalc, effCalc).add();
        Calc energyCalc = context.calc("baseline.energy", "Energie de pompare azi", energy, Unit.KWH_PER_YEAR)
                .formula(invoiced.isPresent() ? "din facturile de energie pe 12 luni" : "m³ × kWh/m³ (normă)").add();
        BigDecimal kwhPerM3 = energy.divide(water, MC);
        context.calc("baseline.kwh_per_m3", "Energie pe m³ azi", kwhPerM3, Unit.KWH_PER_M3)
                .formula("kWh / m³").dependsOn(energyCalc, waterCalc).add();
        BigDecimal co2 = ImpactCalculator.co2Tonnes(energy, RuleValues.factor(context, "gridKgCo2PerKwh"));
        context.calc("baseline.co2", "CO₂ din pompare azi", co2, Unit.T_CO2_PER_YEAR).formula("kWh × factor rețea")
                .dependsOn(energyCalc).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("water_m3", water);
        baseline.put("energy_kwh", energy);
        baseline.put("kwh_per_m3", kwhPerM3);
        baseline.put("co2_t", co2);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("currentSystem", system);
        if (invoiced.isEmpty()) {
            result.putArray("warnings").add("Fără facturi de energie: consumul e estimat din normă");
        }
        return context.ok(result, "Situația actuală: sistem " + system + ", " + waterCalc.display());
    }

    private ToolOutput machinery(JsonNode input, ToolContext context) {
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        BigDecimal norm = area.multiply(context.param("baselineLitresPerHa"), MC);
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("FUEL_INVOICES")
                .flatMap(doc -> doc.number("FUEL_LITRES"));
        BigDecimal tolerance = context.param("invoiceToleranceRatio");
        BigDecimal deviation = invoiced.map(l -> l.subtract(norm).abs().divide(norm, MC)).orElse(null);
        boolean useInvoices = deviation != null && deviation.compareTo(tolerance) > 0;
        BigDecimal fuel = useInvoices ? invoiced.get() : norm;

        JsonNode nitrogenAnswer = context.questionnaire().path("nitrogen_kg_ha");
        BigDecimal nitrogenPerHa = nitrogenAnswer.isNumber() ? nitrogenAnswer.decimalValue()
                : context.param("nitrogenKgPerHaDefault");
        BigDecimal nitrogen = area.multiply(nitrogenPerHa, MC);
        BigDecimal co2 = ImpactCalculator.co2Tonnes(fuel, RuleValues.factor(context, "dieselKgCo2PerLitre"));

        Calc areaCalc = context.calc("baseline.area", "Suprafața lucrată", area, Unit.HA).source("APIA").add();
        String fuelFormula = invoiced.isEmpty() ? "ha × l/ha (normă, fără facturi)"
                : useInvoices ? "din facturi (abatere față de normă peste toleranță)"
                : "ha × l/ha, confirmat de facturi (abatere sub toleranță)";
        Calc fuelCalc = context.calc("baseline.fuel", "Motorină consumată azi", fuel, Unit.L_PER_YEAR)
                .formula(fuelFormula).dependsOn(areaCalc).add();
        context.calc("baseline.nitrogen", "Azot aplicat azi", nitrogen, Unit.KG_N_PER_YEAR)
                .formula("ha × kg N/ha (chestionar)").dependsOn(areaCalc).add();
        context.calc("baseline.co2", "CO₂ din motorină azi", co2, Unit.T_CO2_PER_YEAR).formula("l × factor motorină")
                .dependsOn(fuelCalc).add();

        List<String> warnings = new ArrayList<>();
        Fleet fleet = fleet(input, context, warnings);
        context.calc("baseline.fleet_total", "Tractoare în fermă azi", BigDecimal.valueOf(fleet.total()), Unit.COUNT)
                .add();
        context.calc("baseline.fleet_replaced", "Tractoare scoase din fermă după investiție",
                BigDecimal.valueOf(fleet.replaced()), Unit.COUNT).add();
        context.calc("baseline.replaced_age", "Vechimea tractoarelor înlocuite", BigDecimal.valueOf(fleet.ageYears()),
                Unit.YEARS).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("fuel_l", fuel);
        baseline.put("nitrogen_kg", nitrogen);
        baseline.put("co2_t", co2);
        baseline.put("fleet_total", BigDecimal.valueOf(fleet.total()));
        baseline.put("fleet_replaced", BigDecimal.valueOf(fleet.replaced()));
        baseline.put("replaced_age_years", BigDecimal.valueOf(fleet.ageYears()));
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("invoicesConfirmNorm", invoiced.isPresent() && !useInvoices);
        result.put("fleetChange", fleet.replaced() == 0 ? "EXPANSION" : fleet.replaced() < fleet.total() ? "PARTIAL_REPLACEMENT"
                : "FULL_REPLACEMENT");
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: " + fuelCalc.display() + " de motorină");
    }

    private record Fleet(int total, int replaced, int ageYears) {
    }

    /**
     * Which tractors leave the farm: from the input, else the questionnaire, else the assumption that the
     * offered tractors replace as many tractors older than 15 years (stated as a warning).
     */
    private Fleet fleet(JsonNode input, ToolContext context, List<String> warnings) {
        JsonNode given = input.path("currentFleet");
        JsonNode answers = context.questionnaire();
        int offered = context.workspace().documentOfType("OFFER").map(offer -> offer.lines().stream()
                .filter(line -> "TRACTOR".equals(line.category()))
                .mapToInt(line -> line.numbers().getOrDefault("QUANTITY", BigDecimal.ONE).intValue()).sum())
                .orElse(0);

        int replaced = given.has("replacedCount") ? given.path("replacedCount").asInt()
                : answers.has("replaced_tractors") ? answers.path("replaced_tractors").asInt() : -1;
        if (replaced < 0) {
            replaced = offered;
            warnings.add("Nu știm câte tractoare scoateți: presupunem că cele " + offered + " din ofertă înlocuiesc tot atâtea");
        }
        int total = given.has("totalCount") ? given.path("totalCount").asInt()
                : answers.has("current_tractors") ? answers.path("current_tractors").asInt() : Math.max(replaced, 1);
        if (replaced > total) {
            throw new IllegalArgumentException("Nu se pot scoate " + replaced + " tractoare dintr-o flotă de " + total);
        }
        int age;
        if (given.has("averageAgeYears")) {
            age = given.path("averageAgeYears").asInt();
        } else if (answers.has("replaced_fleet_age")) {
            JsonNode ages = context.module().parameters().path("fleetAgeYears").path("value");
            String band = answers.path("replaced_fleet_age").asText();
            if (!ages.has(band)) {
                throw new IllegalArgumentException("Vechime necunoscută a flotei: " + band);
            }
            age = ages.path(band).asInt();
        } else {
            age = context.module().parameters().path("fleetAgeYears").path("value").path("PESTE_15_ANI").asInt();
            warnings.add("Nu știm vechimea tractoarelor înlocuite: presupunem peste 15 ani");
        }
        if (replaced == 0) {
            warnings.add("Investiția extinde flota fără să scoată tractoare: economia de motorină a tractoarelor e zero");
        }
        return new Fleet(total, replaced, age);
    }
}
