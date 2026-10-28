package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;
import ro.greenstruct.agro.engine.Decimals;
import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.CropNeed;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.engine.machinery.FuelComparison;
import ro.greenstruct.agro.engine.machinery.MachineryCalculator;
import ro.greenstruct.agro.engine.machinery.PowerCheck;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/** Irrigation: water saving against today's system (README §6, category 1). */
@Component
public class IrrigationModule implements ModuleCalculator {

    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    @Override
    public String id() {
        return "irrigation";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        String system = input.path("currentSystem").asText(context.questionnaire().path("irrigation_current").asText(""));
        JsonNode efficiencies = context.module().parameters().path("currentEfficiencyPct").path("value");
        if (!efficiencies.has(system)) {
            throw new IllegalArgumentException("Sistem actual necunoscut „" + system + "”; valori: " + efficiencies.fieldNames());
        }
        BigDecimal efficiency = efficiencies.path(system).decimalValue();
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        BigDecimal netNeed = IrrigationCalculator.netNeedM3(cropNeeds(context));
        BigDecimal water = IrrigationCalculator.grossWaterM3(netNeed, new IrrigationSystem(system, efficiency, BigDecimal.ZERO));
        BigDecimal lift = liftM(context);
        BigDecimal estimated = pumpingKwh(context, water, lift, pressureHeadM(context, system));

        Optional<BigDecimal> invoiced = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"));
        BigDecimal energy = invoiced.orElse(estimated);

        Calc areaCalc = context.calc("baseline.area", "Suprafața parcelelor alese", area, Unit.HA).source("APIA").add();
        Calc needCalc = context.calc("baseline.net_need", "Necesarul net de apă al culturilor", netNeed, Unit.M3_PER_YEAR)
                .formula("Σ max(0, Kc × ET₀ − ploaie efectivă) × 10 × ha")
                .source("Kc din config; ET₀ și ploaia efectivă din datele climatice ale parcelelor").dependsOn(areaCalc).add();
        Calc effCalc = context.calc("baseline.efficiency", "Eficiența sistemului actual", efficiency, Unit.PCT)
                .source(context.paramSource("currentEfficiencyPct")).add();
        Calc waterCalc = context.calc("baseline.water", "Apă pompată azi", water, Unit.M3_PER_YEAR)
                .formula("necesar net / eficiență actuală").dependsOn(needCalc, effCalc).add();
        context.calc("baseline.lift", "Înălțimea de pompare", lift, Unit.COUNT).formula("din chestionar (metri)").add();
        Calc energyCalc = context.calc("baseline.energy", "Energie de pompare azi", energy, Unit.KWH_PER_YEAR)
                .formula(invoiced.isPresent() ? "din facturile de energie pentru pompare"
                        : "m³ × (înălțime de ridicare + înălțime de presiune) × 0,002725 / randamentul pompei")
                .dependsOn(waterCalc).add();
        BigDecimal co2 = ImpactCalculator.co2Tonnes(energy, RuleValues.factor(context, "gridKgCo2PerKwh"));
        context.calc("baseline.co2", "CO₂ din pompare azi", co2, Unit.T_CO2_PER_YEAR).formula("kWh × factor rețea")
                .dependsOn(energyCalc).add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("net_need_m3", netNeed);
        baseline.put("water_m3", water);
        baseline.put("energy_kwh", energy);
        baseline.put("lift_m", lift);
        baseline.put("co2_t", co2);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("currentSystem", system);
        if (invoiced.isEmpty()) {
            result.putArray("warnings").add("Fără facturi de energie: consumul e estimat din înălțimea de pompare");
        }
        return context.ok(result, "Situația actuală: sistem " + system + ", " + waterCalc.display());
    }

    /** Kc per crop from config; ET0 and effective rain per parcel from the climate data of the farm profile. */
    private static List<CropNeed> cropNeeds(ToolContext context) {
        JsonNode kcByCrop = context.module().parameters().path("kcByCrop").path("value");
        List<CropNeed> needs = new ArrayList<>();
        for (JsonNode parcel : FarmFacts.selectedParcels(context)) {
            String crop = parcel.path("crop").asText();
            if (!kcByCrop.has(crop)) {
                throw new IllegalArgumentException("Cultura „" + crop + "” nu are coeficient Kc în config; culturi: "
                        + kcByCrop.fieldNames());
            }
            if (!parcel.has("et0SeasonMm") || !parcel.has("effectiveRainSeasonMm")) {
                throw new IllegalArgumentException("Parcela " + parcel.path("parcelId").asText()
                        + " nu are date climatice (ET₀, ploaie efectivă)");
            }
            needs.add(new CropNeed(crop, parcel.path("areaHa").decimalValue(), kcByCrop.path(crop).decimalValue(),
                    parcel.path("et0SeasonMm").decimalValue(), parcel.path("effectiveRainSeasonMm").decimalValue()));
        }
        return needs;
    }

    private static BigDecimal liftM(ToolContext context) {
        JsonNode answer = context.questionnaire().path("pump_lift_m");
        if (!answer.isNumber()) {
            throw new IllegalArgumentException("Lipsește înălțimea de pompare (pump_lift_m) din chestionar");
        }
        return answer.decimalValue();
    }

    /** Pressure head of an irrigation system (m of water column), from config. */
    private static BigDecimal pressureHeadM(ToolContext context, String system) {
        JsonNode heads = context.module().parameters().path("pressureHeadM").path("value");
        if (!heads.has(system)) {
            throw new IllegalArgumentException("Sistemul „" + system + "” nu are înălțime de presiune în config");
        }
        return heads.path(system).decimalValue();
    }

    private static BigDecimal pumpingKwh(ToolContext context, BigDecimal waterM3, BigDecimal liftM, BigDecimal pressureM) {
        return IrrigationCalculator.pumpingKwhByHead(waterM3, liftM, pressureM,
                RuleValues.factor(context, "pumpingKwhPerM3PerM"), context.param("pumpEfficiencyPct"));
    }

    /** The irrigation component category decides the pressure head of the configuration. */
    private static String systemOf(List<InvestmentComponent> components) {
        return components.stream().filter(c -> c.category().startsWith("IRRIGATION_") && c.attribute("efficiencyPct") != null)
                .max((a, b) -> a.attribute("efficiencyPct").compareTo(b.attribute("efficiencyPct")))
                .map(c -> "IRRIGATION_DRIP".equals(c.category()) ? "PICURARE" : "ASPERSIE")
                .orElseThrow(() -> new IllegalArgumentException("Configurația nu are un sistem de irigații cu eficiență"));
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal efficiency = components.stream()
                .filter(c -> c.category().startsWith("IRRIGATION_") && c.attribute("efficiencyPct") != null)
                .map(c -> c.attribute("efficiencyPct"))
                .reduce(BigDecimal::max)
                .orElseThrow(() -> new IllegalArgumentException("Configurația nu are un sistem de irigații cu eficiență"));
        BigDecimal demandReduction = sumAttribute(components, "demandReductionPct");

        BigDecimal water = IrrigationCalculator.grossWaterM3(baseline.get("net_need_m3"),
                new IrrigationSystem("config", efficiency, demandReduction));
        BigDecimal baselineWater = baseline.get("water_m3");
        BigDecimal pumping = pumpingKwh(context, water, baseline.get("lift_m"), pressureHeadM(context, systemOf(components)));
        BigDecimal pvKwp = sumAttribute(components, "pvKwp");
        BigDecimal pv = IrrigationCalculator.solarCoveredKwh(pumping, pvKwp, context.param("pvYieldKwhPerKwp"));
        BigDecimal grid = pumping.subtract(pv);
        BigDecimal energySaved = baseline.get("energy_kwh").subtract(grid);

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("water_m3", water);
        m.put("indicator_pct", toPct(BigDecimal.ONE.subtract(water.divide(baselineWater, MC))));
        m.put("water_saved_m3", baselineWater.subtract(water));
        m.put("pumping_kwh", pumping);
        m.put("pv_kwh", pv);
        m.put("grid_kwh", grid);
        m.put("energy_saved_kwh", energySaved);
        m.put("co2_avoided_t", ImpactCalculator.co2Tonnes(energySaved.max(BigDecimal.ZERO),
                RuleValues.factor(context, "gridKgCo2PerKwh")));
        m.put("savings_water_eur", m.get("water_saved_m3").multiply(context.param("waterPriceEurPerM3"), MC));
        m.put("savings_energy_eur", energySaved.multiply(RuleValues.price(context, "electricityEurPerKwh"), MC));
        m.put("has_water_meter", components.stream().anyMatch(c -> "WATER_METER".equals(c.category()))
                ? BigDecimal.ONE : BigDecimal.ZERO);
        return m;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
            calcs.add(context.calc(p + "water", "Apă pompată pe an", cfg.metric("water_m3"), Unit.M3_PER_YEAR)
                    .formula("necesar net × (1 − reducere senzori) / eficiență").add());
            calcs.add(context.calc(p + "water_saving_pct", "Economie de apă", cfg.metric("indicator_pct"), Unit.PCT)
                    .formula("1 − apă nouă / apă actuală").add());
            calcs.add(context.calc(p + "water_saved", "Apă economisită pe an", cfg.metric("water_saved_m3"),
                    Unit.M3_PER_YEAR).add());
            if (cfg.metricOrZero("pv_kwh").signum() > 0) {
                calcs.add(context.calc(p + "pumping_energy", "Energie de pompare", cfg.metric("pumping_kwh"),
                        Unit.KWH_PER_YEAR).formula("m³ × kWh/m³").add());
                calcs.add(context.calc(p + "pv_kwh", "Energie produsă de pompa solară", cfg.metric("pv_kwh"),
                        Unit.KWH_PER_YEAR).formula("min(kWp × kWh/kWp, consum de pompare)").add());
                calcs.add(context.calc(p + "grid_kwh", "Energie rămasă din rețea", cfg.metric("grid_kwh"),
                        Unit.KWH_PER_YEAR).add());
            }
            calcs.add(context.calc(p + "energy_saved", "Energie economisită pe an", cfg.metric("energy_saved_kwh"),
                    Unit.KWH_PER_YEAR).formula("kWh azi − kWh din rețea după investiție").add());
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("water", "WATER_USE_M3", "water_saved", "WATER_SAVED_M3", "pumping_energy", "PUMPING_ENERGY_KWH",
                "energy_saved", "ENERGY_SAVED_KWH", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.area", "AREA_HA", "baseline.water", "WATER_USE_M3", "baseline.energy",
                "PUMPING_ENERGY_KWH", "baseline.co2", "CO2_EMITTED_T");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_water_eur", "water_eur", "savings_energy_eur", "energy_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
            context.calc("rules.threshold.water_saving", "Pragul verde: economie de apă",
                    RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
            context.calc("rules.pump_efficiency", "Randamentul pompei", context.param("pumpEfficiencyPct"), Unit.PCT)
                    .source(context.paramSource("pumpEfficiencyPct")).add();
            context.calc("rules.factor.pumping", "Energia de pompare pe m³ și metru",
                    RuleValues.factor(context, "pumpingKwhPerM3PerM"), Unit.KWH_PER_M3)
                    .formula("ρ × g / 3.600.000").source(RuleValues.factorSource(context, "pumpingKwhPerM3PerM")).add();
            context.calc("rules.price.water", "Prețul apei", context.param("waterPriceEurPerM3"), Unit.EUR_PER_M3)
                    .source(context.paramSource("waterPriceEurPerM3")).add();
            context.calc("rules.price.electricity", "Prețul energiei electrice",
                    RuleValues.price(context, "electricityEurPerKwh"), Unit.EUR_PER_KWH)
                    .source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
            context.calc("rules.factor.grid", "Factor de emisie al rețelei",
                    RuleValues.factor(context, "gridKgCo2PerKwh"), Unit.KG_CO2_PER_KWH)
                    .source(RuleValues.factorSource(context, "gridKgCo2PerKwh")).add();
            context.calc("rules.pv_yield", "Producția specifică a panourilor", context.param("pvYieldKwhPerKwp"),
                    Unit.KWH_PER_KWP).source(context.paramSource("pvYieldKwhPerKwp")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
            result.put("waterMeterInConfig", cfg.components().stream().anyMatch(c -> "WATER_METER".equals(c.category())));
            context.workspace().documentOfType("WATER_PERMIT_ANAR").ifPresentOrElse(permit -> {
                String validUntil = permit.texts().get("PERMIT_VALID_UNTIL");
                result.put("permitPresent", true);
                result.put("permitValid", validUntil != null && !parseDate(validUntil).isBefore(context.today()));
            }, () -> result.put("permitPresent", false));
            result.put("waterSource", context.questionnaire().path("water_source").asText("NECUNOSCUT"));
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
            context.calc("impact.water_horizon", "Apă economisită pe orizont",
                    cfg.metric("water_saved_m3").multiply(years, MC), Unit.M3).add();
            context.calc("impact.energy_horizon", "Energie economisită pe orizont",
                    cfg.metric("energy_saved_kwh").multiply(years, MC), Unit.KWH).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        switch (line.category()) {
                case "IRRIGATION_SPRINKLER", "IRRIGATION_DRIP" -> {
                    BigDecimal efficiency = line.numbers().getOrDefault("APPLICATION_EFFICIENCY_PCT",
                            offer.numbers().get("APPLICATION_EFFICIENCY_PCT"));
                    if (efficiency != null) {
                        attributes.put("efficiencyPct", efficiency);
                    }
                }
                case "PUMP" -> {
                    BigDecimal power = line.numbers().getOrDefault("PUMP_POWER_KW", offer.numbers().get("PUMP_POWER_KW"));
                    if (power != null) {
                        attributes.put("powerKw", power);
                    }
                }
            default -> {
            }
        }
    }

    private static BigDecimal sumAttribute(List<InvestmentComponent> components, String attribute) {
        return components.stream().map(c -> c.attribute(attribute)).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static LocalDate parseDate(String raw) {
        try {
            return LocalDate.parse(raw.trim(), RO_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data „" + raw + "” din aviz nu are formatul zz.ll.aaaa");
        }
    }
}
