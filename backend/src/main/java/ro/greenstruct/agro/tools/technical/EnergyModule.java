package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.energy.EnergyCalculator;
import ro.greenstruct.agro.engine.energy.PvBalance;
import ro.greenstruct.agro.engine.energy.SolarPumpSaving;
import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Energy on the farm: photovoltaic panels and solar pumps (README §6, category 2). The module is eligible by
 * nature (threshold kind BY_NATURE), so a configuration "passes" when its site is eligible and it is sized
 * to the farm: the energy sold to the grid stays within the configured share of the production and the panels
 * fit the available area. {@code indicator_pct} is the share of the production kept on the farm
 * (self-consumed / produced); the README's coverage degree (self-consumed / annual consumption) is its own metric.
 * Resizing the installation is the guidance (README §13): a smaller catalog size replaces the offered one.
 */
@Component
public class EnergyModule implements ModuleCalculator {

    private static final String PV_SYSTEM = "PV_SYSTEM";
    private static final String SOLAR_PUMP = "SOLAR_PUMP";

    @Override
    public String id() {
        return "energy";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        DocumentFacts invoices = context.workspace().documentOfType("ENERGY_INVOICES").orElseThrow(() ->
                new IllegalArgumentException("Extrage întâi facturile de energie pe 12 luni (ENERGY_INVOICES)"));
        List<String> warnings = new ArrayList<>();

        Map<Integer, BigDecimal> byMonth = new TreeMap<>();
        BigDecimal lineCost = BigDecimal.ZERO;
        for (DocumentFacts.LineFacts line : invoices.lines()) {
            BigDecimal kwh = line.numbers().get("ENERGY_KWH");
            if (kwh == null) {
                continue;
            }
            int month = InvoiceMonths.parse(line.texts().get("PERIOD_FROM"))
                    .or(() -> InvoiceMonths.parse(line.texts().get("PERIOD_TO")))
                    .orElseThrow(() -> new IllegalArgumentException("Factura " + line.lineId()
                            + " nu are perioada de facturare (PERIOD_FROM)"));
            byMonth.merge(month, kwh, BigDecimal::add);
            lineCost = lineCost.add(line.numbers().getOrDefault("ENERGY_COST", BigDecimal.ZERO));
        }
        BigDecimal invoicedKwh;
        List<BigDecimal> months;
        if (byMonth.isEmpty()) {
            invoicedKwh = invoices.number("ENERGY_KWH").orElseThrow(() ->
                    new IllegalArgumentException("Facturile nu conțin consumul în kWh"));
            BigDecimal monthly = invoicedKwh.divide(BigDecimal.valueOf(12), MC);
            months = java.util.Collections.nCopies(12, monthly);
            warnings.add("Facturile nu au defalcare lunară: consumul e împărțit egal pe 12 luni");
        } else {
            invoicedKwh = byMonth.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            months = EnergyCalculator.completeMonths(byMonth);
            if (byMonth.size() < 12) {
                warnings.add("Facturile acoperă " + byMonth.size() + " luni; lunile lipsă iau media lunilor cunoscute");
            }
        }
        BigDecimal annual = months.stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cost = invoices.number("ENERGY_COST").orElse(lineCost);
        boolean paidPrice = cost.signum() > 0 && invoicedKwh.signum() > 0;
        BigDecimal price = paidPrice ? cost.divide(invoicedKwh, MC) : RuleValues.price(context, "electricityEurPerKwh");
        if (!paidPrice) {
            warnings.add("Facturile nu arată costul: folosim prețul energiei din configurație");
        }

        JsonNode dayAnswer = context.questionnaire().path("daytime_share_pct");
        BigDecimal daytime = dayAnswer.isNumber() ? dayAnswer.decimalValue() : context.param("daytimeShareDefaultPct");
        if (!dayAnswer.isNumber()) {
            warnings.add("Nu știm ce parte din consum e ziua: presupunem " + daytime.toPlainString() + "%");
        }
        JsonNode dieselAnswer = context.questionnaire().path("diesel_pump_litres_year");
        BigDecimal dieselLitres = dieselAnswer.isNumber() ? dieselAnswer.decimalValue() : BigDecimal.ZERO;

        BigDecimal co2 = ImpactCalculator.co2Tonnes(annual, RuleValues.factor(context, "gridKgCo2PerKwh"));
        Calc consumption = context.calc("baseline.consumption", "Consum de energie electrică azi", annual,
                Unit.KWH_PER_YEAR).formula(byMonth.isEmpty() ? "total facturat" : "suma facturilor lunare").add();
        Calc priceCalc = context.calc("baseline.price", "Prețul plătit pentru energie", price, Unit.EUR_PER_KWH)
                .formula(paidPrice ? "cost facturat fără TVA / kWh facturați" : "preț din configurație")
                .source(paidPrice ? "Facturi de energie" : RuleValues.priceSource(context, "electricityEurPerKwh")).add();
        context.calc("baseline.cost", "Costul energiei electrice azi", annual.multiply(price, MC), Unit.EUR_PER_YEAR)
                .formula("kWh × preț plătit").dependsOn(consumption, priceCalc).add();
        context.calc("baseline.daytime_share", "Ponderea consumului de zi", daytime, Unit.PCT)
                .source(dayAnswer.isNumber() ? "Chestionar" : context.paramSource("daytimeShareDefaultPct")).add();
        context.calc("baseline.co2", "CO₂ din energia electrică azi", co2, Unit.T_CO2_PER_YEAR)
                .formula("kWh × factor rețea").dependsOn(consumption).add();
        context.calc("baseline.diesel", "Motorină consumată de pompa actuală", dieselLitres, Unit.L_PER_YEAR)
                .source("Chestionar").add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("consumption_kwh", annual);
        baseline.put("buy_price", price);
        baseline.put("daytime_share_pct", daytime);
        baseline.put("diesel_l", dieselLitres);
        baseline.put("co2_t", co2);
        for (int i = 0; i < 12; i++) {
            baseline.put(monthKey(i + 1), months.get(i));
        }
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", "INVOICES");
        result.put("monthsCovered", byMonth.isEmpty() ? 0 : byMonth.size());
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: " + consumption.display() + " de energie electrică");
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal kwp = components.stream().map(c -> c.attribute("pvKwp")).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean solarPump = components.stream().anyMatch(c -> SOLAR_PUMP.equals(c.category()));
        if (kwp.signum() == 0 && !solarPump) {
            throw new IllegalArgumentException("Configurația nu are o instalație fotovoltaică cu puterea în kWp");
        }

        PvBalance balance = EnergyCalculator.balance(kwp, context.param("pvYieldKwhPerKwp"), monthlyShares(context),
                monthlyConsumption(baseline), baseline.get("daytime_share_pct"));
        BigDecimal electricitySaving = EnergyCalculator.savingsEur(balance.selfConsumedKwh(), balance.exportedKwh(),
                baseline.get("buy_price"), context.param("sellPriceEurPerKwh"));
        SolarPumpSaving pump = EnergyCalculator.solarPump(solarPump ? baseline.get("diesel_l") : BigDecimal.ZERO,
                RuleValues.dieselNetEurPerLitre(context), RuleValues.factor(context, "dieselKgCo2PerLitre"));
        BigDecimal totalSaving = electricitySaving.add(pump.savingEur());
        BigDecimal investment = components.stream().map(InvestmentComponent::costEur)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal roofArea = EnergyCalculator.areaNeededM2(kwp, context.param("areaM2PerKwp"));
        JsonNode available = context.questionnaire().path("available_area_m2");
        boolean areaOk = !available.isNumber() || roofArea.compareTo(available.decimalValue()) <= 0;
        boolean exportOk = EnergyCalculator.exportWithinLimit(balance.exportSharePct(), context.param("maxExportSharePct"));

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("pv_kwp", kwp);
        m.put("production_kwh", balance.productionKwh());
        m.put("self_consumed_kwh", balance.selfConsumedKwh());
        m.put("exported_kwh", balance.exportedKwh());
        m.put("export_share_pct", balance.exportSharePct());
        m.put("coverage_pct", balance.coveragePct());
        m.put("indicator_pct", balance.selfShareOfProductionPct());
        m.put("roof_area_m2", roofArea);
        m.put("diesel_saved_l", pump.litres());
        m.put("co2_avoided_t", EnergyCalculator.co2AvoidedTonnes(balance.productionKwh(),
                RuleValues.factor(context, "gridKgCo2PerKwh")).add(pump.co2Tonnes()));
        m.put("savings_electricity_eur", electricitySaving);
        m.put("savings_diesel_eur", pump.savingEur());
        EnergyCalculator.paybackYears(investment, totalSaving).ifPresent(years -> m.put("payback_years", years));
        EnergyCalculator.paybackMonths(investment, totalSaving).ifPresent(months -> m.put("payback_months", months));
        m.put("sizing_export_ok", flag(exportOk));
        m.put("sizing_area_ok", flag(areaOk));
        m.put("site_ok", flag(eligibleMounting(context)));
        return m;
    }

    /** Sizing and site checks that, with eligibility by nature, make a configuration pass. */
    @Override
    public boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        return metrics.get("sizing_export_ok").signum() > 0 && metrics.get("sizing_area_ok").signum() > 0
                && metrics.get("site_ok").signum() > 0;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "pv_kwp", "Puterea instalației", cfg.metric("pv_kwp"), Unit.KWP).add());
        calcs.add(context.calc(p + "production", "Producția anuală", cfg.metric("production_kwh"),
                Unit.KWH_PER_YEAR).formula("kWp × producția specifică").add());
        calcs.add(context.calc(p + "self_consumed", "Energie consumată direct la fermă", cfg.metric("self_consumed_kwh"),
                Unit.KWH_PER_YEAR).formula("Σ lună min(producție lunară, consum lunar × pondere de zi)").add());
        calcs.add(context.calc(p + "exported", "Energie vândută în rețea", cfg.metric("exported_kwh"),
                Unit.KWH_PER_YEAR).formula("producție − energie consumată direct").add());
        calcs.add(context.calc(p + "export_share", "Ponderea vândută în rețea", cfg.metric("export_share_pct"),
                Unit.PCT).formula("energie vândută / producție")
                .source(context.paramSource("maxExportSharePct")).add());
        calcs.add(context.calc(p + "coverage", "Gradul de acoperire a consumului", cfg.metric("coverage_pct"),
                Unit.PCT).formula("energie consumată direct / consum anual").add());
        calcs.add(context.calc(p + "roof_area", "Suprafața necesară", cfg.metric("roof_area_m2"), Unit.M2)
                .formula("kWp × m² pe kWp").source(context.paramSource("areaM2PerKwp")).add());
        calcs.add(context.calc(p + "savings", "Economie din energie pe an", cfg.metric("savings_electricity_eur"),
                Unit.EUR_PER_YEAR).formula("consumat direct × preț cumpărare + vândut × preț vânzare").add());
        calcs.add(context.calc(p + "diesel_saved", "Motorină evitată de pompa solară", cfg.metric("diesel_saved_l"),
                Unit.L_PER_YEAR).formula("litri consumați azi de pompa pe motorină").add());
        if (cfg.metricOrZero("savings_diesel_eur").signum() > 0) {
            calcs.add(context.calc(p + "diesel_saving", "Economie din motorină pe an", cfg.metric("savings_diesel_eur"),
                    Unit.EUR_PER_YEAR).formula("litri evitați × preț net motorină").add());
        }
        if (cfg.metrics().containsKey("payback_years")) {
            calcs.add(context.calc(p + "payback", "Recuperarea investiției", cfg.metric("payback_years"), Unit.YEARS)
                    .formula("cost total / economie anuală").add());
            calcs.add(context.calc(p + "payback_months", "Recuperarea investiției (luni)", cfg.metric("payback_months"),
                    Unit.MONTHS).formula("cost total / economie anuală × 12").add());
        }
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("production", "RENEWABLE_KWH", "self_consumed", "GRID_ENERGY_REPLACED_KWH",
                "savings", "ENERGY_COST_SAVED_EUR", "diesel_saved", "FUEL_SAVED_L", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.co2", "CO2_EMITTED_T", "baseline.diesel", "FUEL_USE_L");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_electricity_eur", "electricity_eur", "savings_diesel_eur", "diesel_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        context.calc("rules.sizing.max_export", "Cel mult din producție vândut în rețea",
                context.param("maxExportSharePct"), Unit.PCT).source(context.paramSource("maxExportSharePct")).add();
        context.calc("rules.pv_yield", "Producția specifică a panourilor", context.param("pvYieldKwhPerKwp"),
                Unit.KWH_PER_KWP).source(context.paramSource("pvYieldKwhPerKwp")).add();
        context.calc("rules.daytime_default", "Ponderea consumului de zi (implicită)",
                context.param("daytimeShareDefaultPct"), Unit.PCT).source(context.paramSource("daytimeShareDefaultPct")).add();
        context.calc("rules.price.sell", "Prețul de vânzare a surplusului", context.param("sellPriceEurPerKwh"),
                Unit.EUR_PER_KWH).source(context.paramSource("sellPriceEurPerKwh")).add();
        context.calc("rules.price.electricity", "Prețul energiei electrice (fără facturi)",
                RuleValues.price(context, "electricityEurPerKwh"), Unit.EUR_PER_KWH)
                .source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
        context.calc("rules.price.diesel_net", "Costul net al motorinei", RuleValues.dieselNetEurPerLitre(context),
                Unit.EUR_PER_L).formula("(preț la pompă / (1 + TVA) − acciză rambursată) / curs EUR")
                .source(RuleValues.priceSource(context, "dieselExciseRefundLeiPerLitre")).add();
        context.calc("rules.factor.grid", "Factor de emisie al rețelei", RuleValues.factor(context, "gridKgCo2PerKwh"),
                Unit.KG_CO2_PER_KWH).source(RuleValues.factorSource(context, "gridKgCo2PerKwh")).add();
        context.calc("rules.factor.diesel", "Factor de emisie motorină", RuleValues.factor(context, "dieselKgCo2PerLitre"),
                Unit.KG_CO2_PER_L).source(RuleValues.factorSource(context, "dieselKgCo2PerLitre")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
        JsonNode answers = context.questionnaire();
        result.put("mounting", answers.path("mounting").asText("NECUNOSCUT"));
        result.put("mountingEligible", eligibleMounting(context));
        result.put("areaSufficient", cfg.metric("sizing_area_ok").signum() > 0);
        result.put("exportWithinLimit", cfg.metric("sizing_export_ok").signum() > 0);
        result.put("sellsToGrid", cfg.metric("exported_kwh").signum() > 0);
        if (answers.path("has_grid_notice").isBoolean()) {
            result.put("gridNoticePresent", answers.path("has_grid_notice").asBoolean());
        }
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
        context.calc("impact.renewable_horizon", "Energie regenerabilă produsă pe orizont",
                cfg.metric("production_kwh").multiply(years, MC), Unit.KWH).add();
        if (cfg.metricOrZero("diesel_saved_l").signum() > 0) {
            context.calc("impact.diesel_horizon", "Motorină evitată pe orizont",
                    cfg.metric("diesel_saved_l").multiply(years, MC), Unit.L).add();
        }
    }

    /**
     * The installed power of a PV_SYSTEM line (PV_POWER_KWP, or ENGINE_POWER_KW while the contract has no key for
     * kWp); stated once for the whole offer, it goes to the first PV_SYSTEM line so that it is counted once.
     */
    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        if (!PV_SYSTEM.equals(line.category())) {
            return;
        }
        BigDecimal kwp = power(line.numbers());
        if (kwp == null && isFirstOfCategory(line, offer)) {
            kwp = power(offer.numbers());
        }
        if (kwp != null) {
            attributes.put("pvKwp", kwp);
        }
    }

    private static BigDecimal power(Map<String, BigDecimal> numbers) {
        BigDecimal kwp = numbers.get("PV_POWER_KWP");
        return kwp != null ? kwp : numbers.get("ENGINE_POWER_KW");
    }

    private static boolean isFirstOfCategory(DocumentFacts.LineFacts line, DocumentFacts offer) {
        Optional<DocumentFacts.LineFacts> first = offer.lines().stream()
                .filter(l -> PV_SYSTEM.equals(l.category())).findFirst();
        return first.isPresent() && first.get().lineId().equals(line.lineId());
    }

    /** An unanswered mounting question does not block: it becomes a condition for the officer. */
    private static boolean eligibleMounting(ToolContext context) {
        String mounting = context.questionnaire().path("mounting").asText("");
        if (mounting.isBlank()) {
            return true;
        }
        for (JsonNode allowed : context.module().parameters().path("eligibleMountings").path("value")) {
            if (allowed.asText().equals(mounting)) {
                return true;
            }
        }
        return false;
    }

    private static List<BigDecimal> monthlyShares(ToolContext context) {
        List<BigDecimal> shares = new ArrayList<>();
        context.module().parameters().path("monthlyProductionShare").path("value")
                .forEach(share -> shares.add(share.decimalValue()));
        return shares;
    }

    private static List<BigDecimal> monthlyConsumption(Map<String, BigDecimal> baseline) {
        List<BigDecimal> months = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            months.add(baseline.get(monthKey(month)));
        }
        return months;
    }

    private static String monthKey(int month) {
        return String.format("cons_%02d", month);
    }

    private static BigDecimal flag(boolean value) {
        return value ? BigDecimal.ONE : BigDecimal.ZERO;
    }
}
