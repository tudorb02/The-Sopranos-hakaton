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
import ro.greenstruct.agro.engine.irrigation.CropDemand;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.engine.machinery.MachineryCalculator;
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
 * Today's situation on the selected parcels: water and pumping energy (irrigation, from the crops, the climate and
 * the pumping head; the energy invoices only verify the estimate) or diesel and nitrogen (machinery, from the fuel
 * invoices, the norm only without them).
 */
@Component
public class ComputeBaselineTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_baseline";
    }

    @Override
    public String description() {
        return "Computes today's consumption on the selected parcels: for irrigation the crops' net water need, the "
                + "water extracted with the current system and the pumping energy; for machinery diesel per hectare "
                + "from the fuel invoices and nitrogen. Extract the invoices first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "currentSystem": {"type": "string", "enum": ["ASPERSIE_VECHE", "ASPERSIE", "PICURARE", "BRAZDE"],
                    "description": "Irrigation only; defaults to the questionnaire answer irrigation_current."},
                  "pumpingHeadM": {"type": "number", "minimum": 0,
                    "description": "Irrigation only; defaults to the questionnaire answer pumping_head_m."},
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

    /** README §6.1: water from the crops' need and today's system, energy from the lift and the system's pressure. */
    private ToolOutput irrigation(JsonNode input, ToolContext context) {
        String system = input.path("currentSystem").asText(context.questionnaire().path("irrigation_current").asText(""));
        if ("NU".equals(system)) {
            throw new IllegalArgumentException("Ferma nu irigă încă: criteriul pentru fermele care încep să irige "
                    + "(sistem cu η ≥ 0,85, autorizație ANAR, fără stres hidric sever) nu e încă disponibil");
        }
        IrrigationSystem current = IrrigationFacts.system(context, system, false);
        List<String> warnings = new ArrayList<>();
        List<CropDemand> crops = IrrigationFacts.crops(context, warnings);
        String zoneId = IrrigationFacts.climateZoneId(context);
        JsonNode zone = context.module().parameters().path("climateZones").path("value").path(zoneId);
        BigDecimal area = crops.stream().map(CropDemand::hectares).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal need = IrrigationCalculator.netNeedM3(crops);
        BigDecimal water = IrrigationCalculator.withdrawalM3(need, current);
        BigDecimal lift = IrrigationFacts.liftM(context, input);
        BigDecimal energy = IrrigationCalculator.pumpingKwh(water, lift, current.pressureHeadM(),
                RuleValues.factor(context, "pumpingKwhPerM3PerM"), context.param("pumpEfficiencyPct"));

        Calc areaCalc = context.calc("baseline.area", "Suprafața parcelelor alese", area, Unit.HA).source("APIA").add();
        Calc needCalc = context.calc("baseline.net_need", "Nevoia netă de apă a culturilor", need, Unit.M3_PER_YEAR)
                .formula("Σ max(0, Kc × ET₀ − P_ef) × 10 × ha")
                .source("Kc pe cultură (APIA); ET₀ " + zone.path("et0SeasonMm").asText() + " mm și ploaie efectivă "
                        + zone.path("effectiveRainSeasonMm").asText() + " mm pe sezon, zona " + zoneId)
                .dependsOn(areaCalc).add();
        Calc effCalc = context.calc("baseline.efficiency", "Eficiența sistemului actual", current.efficiencyPct(), Unit.PCT)
                .source(context.paramSource("systems")).add();
        Calc waterCalc = context.calc("baseline.water", "Apă extrasă azi", water, Unit.M3_PER_YEAR)
                .formula("NIR / η actual").dependsOn(needCalc, effCalc).add();
        Calc liftCalc = context.calc("baseline.lift", "Înălțimea de pompare", lift, Unit.M).source("chestionar").add();
        Calc energyCalc = context.calc("baseline.energy", "Energie de pompare azi", energy, Unit.KWH_PER_YEAR)
                .formula("m³ × (H ridicare + H presiune) × 0,002725 / η pompă").dependsOn(waterCalc, liftCalc).add();
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"));
        invoiced.ifPresent(kwh -> {
            Calc invoiceCalc = context.calc("baseline.energy_invoiced", "Energie din facturi (12 luni)", kwh,
                    Unit.KWH_PER_YEAR).source("facturile de energie").add();
            if (kwh.subtract(energy).abs().divide(energy, MC).compareTo(context.param("energyInvoiceToleranceRatio")) > 0) {
                warnings.add("Facturile (" + invoiceCalc.display() + ") diferă de estimare (" + energyCalc.display()
                        + ") cu peste 20%: diferența se verifică la monitorizare");
            }
        });
        BigDecimal co2 = ImpactCalculator.co2Tonnes(energy, RuleValues.factor(context, "gridKgCo2PerKwh"));
        context.calc("baseline.co2", "CO₂ din pompare azi", co2, Unit.T_CO2_PER_YEAR).formula("kWh × factor rețea")
                .dependsOn(energyCalc).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("net_need_m3", need);
        baseline.put("water_m3", water);
        baseline.put("lift_m", lift);
        baseline.put("energy_kwh", energy);
        baseline.put("water_price_eur_m3", IrrigationFacts.waterPrice(context));
        baseline.put("co2_t", co2);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("currentSystem", system);
        result.put("climateZone", zoneId);
        if (invoiced.isEmpty()) {
            warnings.add("Fără facturi de energie: energia de pompare e doar estimată");
        }
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: sistem " + system + ", " + waterCalc.display());
    }

    /** README §6.3: today's litres per hectare from the 12 months of fuel invoices, the norm only without invoices. */
    private ToolOutput machinery(JsonNode input, ToolContext context) {
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("FUEL_INVOICES")
                .flatMap(doc -> doc.number("FUEL_LITRES"));
        BigDecimal perHa = invoiced.map(litres -> MachineryCalculator.litresPerHa(litres, area))
                .orElseGet(() -> context.param("baselineLitresPerHa"));
        BigDecimal fuel = area.multiply(perHa, MC);

        JsonNode nitrogenAnswer = context.questionnaire().path("nitrogen_kg_ha");
        BigDecimal nitrogenPerHa = nitrogenAnswer.isNumber() ? nitrogenAnswer.decimalValue()
                : context.param("nitrogenKgPerHaDefault");
        BigDecimal nitrogen = area.multiply(nitrogenPerHa, MC);
        BigDecimal co2 = ImpactCalculator.co2Tonnes(fuel, RuleValues.factor(context, "dieselKgCo2PerLitre"));

        Calc areaCalc = context.calc("baseline.area", "Suprafața lucrată", area, Unit.HA).source("APIA").add();
        Calc perHaCalc = context.calc("baseline.fuel_per_ha", "Motorină pe hectar azi", perHa, Unit.L_PER_HA)
                .formula(invoiced.isPresent() ? "litri din facturile pe 12 luni / ha lucrate" : "normă (fără facturi)")
                .source(invoiced.isPresent() ? "facturile de motorină" : context.paramSource("baselineLitresPerHa"))
                .dependsOn(areaCalc).add();
        Calc fuelCalc = context.calc("baseline.fuel", "Motorină consumată azi", fuel, Unit.L_PER_YEAR)
                .formula("l/ha × ha").dependsOn(perHaCalc, areaCalc).add();
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
        baseline.put("fuel_per_ha", perHa);
        baseline.put("fuel_l", fuel);
        baseline.put("nitrogen_kg", nitrogen);
        baseline.put("co2_t", co2);
        baseline.put("fleet_total", BigDecimal.valueOf(fleet.total()));
        baseline.put("fleet_replaced", BigDecimal.valueOf(fleet.replaced()));
        baseline.put("replaced_age_years", BigDecimal.valueOf(fleet.ageYears()));
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "INVOICES" : "NORMS");
        if (invoiced.isEmpty()) {
            warnings.add("Fără facturi de motorină: consumul pe hectar e norma din config");
        }
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
