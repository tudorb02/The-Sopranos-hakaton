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
import ro.greenstruct.agro.engine.irrigation.CropArea;
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

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal efficiency = components.stream()
                .filter(c -> c.category().startsWith("IRRIGATION_") && c.attribute("efficiencyPct") != null)
                .map(c -> c.attribute("efficiencyPct"))
                .reduce(BigDecimal::max)
                .orElseThrow(() -> new IllegalArgumentException("Configurația nu are un sistem de irigații cu eficiență"));
        BigDecimal demandReduction = sumAttribute(components, "demandReductionPct");

        IrrigationSystem system = new IrrigationSystem("config", efficiency, demandReduction);
        BigDecimal water = IrrigationCalculator.grossWaterM3(
                List.of(new CropArea("parcele", baseline.get("area_ha"), context.param("netNeedM3PerHa"))), system);
        BigDecimal baselineWater = baseline.get("water_m3");
        BigDecimal kwhPerM3 = components.stream().map(c -> c.attribute("pumpingKwhPerM3"))
                .filter(v -> v != null).findFirst().orElse(baseline.get("kwh_per_m3"));
        BigDecimal pumping = IrrigationCalculator.pumpingKwh(water, kwhPerM3);
        BigDecimal pvKwp = sumAttribute(components, "pvKwp");
        BigDecimal pv = IrrigationCalculator.solarCoveredKwh(pumping, pvKwp, context.param("pvYieldKwhPerKwp"));
        BigDecimal grid = pumping.subtract(pv);
        BigDecimal energySaved = baseline.get("energy_kwh").subtract(grid);

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("water_m3", water);
        m.put("indicator_pct", toPct(BigDecimal.ONE.subtract(water.divide(baselineWater, MC))));
        m.put("water_saved_m3", baselineWater.subtract(water));
        m.put("kwh_per_m3", kwhPerM3);
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
                    .formula("ha × necesar net × (1 − reducere senzori) / eficiență").add());
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
            context.calc("rules.need_net", "Necesarul net de apă", context.param("netNeedM3PerHa"), Unit.M3_PER_HA)
                    .source(context.paramSource("netNeedM3PerHa")).add();
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
