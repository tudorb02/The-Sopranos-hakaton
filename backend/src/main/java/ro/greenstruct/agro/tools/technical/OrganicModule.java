package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.organic.CropPlan;
import ro.greenstruct.agro.engine.organic.OrganicCalculator;
import ro.greenstruct.agro.engine.organic.Tranche;
import ro.greenstruct.agro.engine.organic.YearResult;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/**
 * Organic conversion (README §6, category 6). There is no energy saving: the module models the margin against the
 * conventional farm in the conversion years, the monthly liquidity gap that sizes the grace period, and the nitrogen
 * and CO₂e no longer emitted. The configuration is the plan: the farmer's offer (the equipment the loan finances)
 * is the full conversion; the catalog alternative eco.plan.phased_60_60 turns it into a phased one.
 */
@Component
public class OrganicModule implements ModuleCalculator {

    @Override
    public String id() {
        return "organic";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        JsonNode questionnaire = context.questionnaire();
        BigDecimal area = FarmFacts.selectedAreaHa(context);
        BigDecimal conversionHa = questionnaire.has("conversion_ha")
                ? questionnaire.path("conversion_ha").decimalValue() : area;
        if (conversionHa.signum() <= 0 || conversionHa.compareTo(area) > 0) {
            throw new IllegalArgumentException("Hectares in conversion (" + conversionHa.toPlainString()
                    + ") must be between 1 and the area of the selected parcels (" + area.toPlainString() + " ha)");
        }
        int startYear = questionnaire.path("conversion_start_year").asInt(0);
        if (startYear < 2000) {
            throw new IllegalArgumentException("Conversion start year missing (conversion_start_year)");
        }

        BigDecimal nitrogen;
        String nitrogenSource;
        var invoices = context.workspace().documentOfType("FERTILIZER_INVOICES");
        if (invoices.isPresent() && !invoices.get().lines().isEmpty()) {
            BigDecimal productKg = invoices.get().lines().stream().map(l -> l.numbers().get("QUANTITY"))
                    .filter(v -> v != null).reduce(BigDecimal.ZERO, BigDecimal::add);
            nitrogen = OrganicCalculator.nitrogenInFertilizerKg(productKg, context.param("fertilizerNContentPct"));
            nitrogenSource = "from the fertiliser invoices × nitrogen content";
        } else if (questionnaire.has("nitrogen_kg_ha")) {
            nitrogen = OrganicCalculator.nitrogenAvoidedKg(questionnaire.path("nitrogen_kg_ha").decimalValue(), conversionHa);
            nitrogenSource = "declared kg N/ha × hectares in conversion";
        } else {
            throw new IllegalArgumentException("Fertiliser invoices or the nitrogen_kg_ha answer missing");
        }
        BigDecimal co2 = OrganicCalculator.co2eAvoidedTonnes(nitrogen, RuleValues.factor(context, "nitrogenKgCo2ePerKgN"));

        List<CropPlan> crops = OrganicPlans.crops(context);
        var parameters = OrganicPlans.parameters(context);
        YearResult conventional = OrganicCalculator.conventional(crops, startYear, parameters);

        Calc areaCalc = context.calc("baseline.area", "Area of the selected parcels", area, Unit.HA).source("APIA").add();
        context.calc("baseline.conversion_ha", "Hectares converting to organic", conversionHa, Unit.HA)
                .source("farmer's answer + certification contract").add();
        Calc nitrogenCalc = context.calc("baseline.nitrogen", "Mineral nitrogen applied today", nitrogen, Unit.KG_N_PER_YEAR)
                .formula(nitrogenSource).dependsOn(areaCalc).add();
        context.calc("baseline.co2", "CO₂e from mineral nitrogen today", co2, Unit.T_CO2_PER_YEAR)
                .formula("kg N × 4.29 kg CO₂e/kg N / 1,000").source(RuleValues.factorSource(context, "nitrogenKgCo2ePerKgN"))
                .dependsOn(nitrogenCalc).add();
        context.calc("baseline.revenue_conventional", "Crop revenue today", conventional.revenueEur(),
                Unit.EUR_PER_YEAR).formula("Σ ha × yield/ha × conventional price").source("APIA + config").add();
        context.calc("baseline.margin_conventional", "Margin of the conventional farm", conventional.marginEur(),
                Unit.EUR_PER_YEAR).formula("revenue − ha × conventional cost/ha").source("config/modules/ecologic.json").add();

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("area_ha", area);
        baseline.put("conversion_ha", conversionHa);
        baseline.put("start_year", BigDecimal.valueOf(startYear));
        baseline.put("nitrogen_kg", nitrogen);
        baseline.put("co2_t", co2);
        baseline.put("margin_conventional_eur", conventional.marginEur());
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoices.isPresent() ? "MIXED" : "NORMS");
        result.put("conversionStartYear", startYear);
        if (invoices.isEmpty()) {
            result.putArray("warnings").add("No fertiliser invoices: nitrogen is as declared by the farmer");
        }
        return context.ok(result, "Current situation: " + conversionHa.stripTrailingZeros().toPlainString()
                + " ha convert to organic from " + startYear + ", conventional margin " + conventional.marginEur().setScale(0,
                java.math.RoundingMode.HALF_EVEN).toPlainString() + " EUR/yr");
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        OrganicPlans.Setup setup = OrganicPlans.setup(context);
        OrganicPlans.Phasing phasing = OrganicPlans.phasing(components);
        OrganicPlans.PlanFigures figures = OrganicPlans.figures(setup, phasing);
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        boolean certified = hasCertification(context);

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("indicator_pct", certified ? toPct(setup.conversionHa().divide(setup.farmHa(), MC)) : BigDecimal.ZERO);
        m.put("certified_area_ha", certified ? setup.conversionHa() : BigDecimal.ZERO);
        m.put("ha_year1", figures.tranches().get(0).share().multiply(setup.farmHa(), MC));
        m.put("phased", phasing.phased() ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("nitrogen_saved_kg", baseline.get("nitrogen_kg"));
        m.put("co2_avoided_t", baseline.get("co2_t"));
        for (int i = 0; i < figures.years().size(); i++) {
            m.put("margin_y" + (i + 1), figures.marginVsConventional(i));
        }
        m.put("margin_total_eur", figures.marginTotalEur());
        // Yearly figure for build_scenario / DSCR: the average margin gain over the horizon, never negative.
        m.put("savings_margin_eur", figures.marginTotalEur().divide(BigDecimal.valueOf(setup.horizonYears()), MC)
                .max(BigDecimal.ZERO));

        List<BigDecimal> gap = OrganicPlans.monthlyGap(setup, figures.tranches(), setup.startYear(),
                OrganicPlans.noInstalments());
        m.put("gap_y1_total_eur", OrganicCalculator.total(gap));
        m.put("gap_y1_peak_eur", OrganicCalculator.peak(gap));
        m.put("coverage_y1_eur", OrganicPlans.coverage(context, setup, figures.tranches(), setup.startYear()));
        return m;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        int startYear = context.workspace().baseline().get("start_year").intValueExact();
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "certified_area", "Hectares certified or in conversion", cfg.metric("certified_area_ha"),
                Unit.HA).formula("hectares in the certification contract (0 without a contract or certificate)").add());
        calcs.add(context.calc(p + "ha_year1", "Hectares entering conversion in the first year", cfg.metric("ha_year1"),
                Unit.HA).formula(cfg.metric("phased").signum() > 0 ? "first tranche of the phased plan" : "all hectares")
                .add());
        calcs.add(context.calc(p + "nitrogen_saved", "Mineral nitrogen avoided per year", cfg.metric("nitrogen_saved_kg"),
                Unit.KG_N_PER_YEAR).formula("kg N/ha × ha (or kg N from invoices)").add());
        int years = (int) cfg.metrics().keySet().stream().filter(k -> k.startsWith("margin_y")).count();
        for (int i = 1; i <= years; i++) {
            calcs.add(context.calc(p + "margin_y" + i, "Margin vs conventional, year " + (startYear + i - 1),
                    cfg.metric("margin_y" + i), Unit.EUR_PER_YEAR)
                    .formula("(revenue − expenses + organic payments) − conventional margin").add());
        }
        calcs.add(context.calc(p + "margin_total", "Cumulative margin vs conventional over " + years + " years",
                cfg.metric("margin_total_eur"), Unit.EUR).add());
        calcs.add(context.calc(p + "gap_y1", "Liquidity gap in the first year (no instalments)", cfg.metric("gap_y1_total_eur"),
                Unit.EUR).formula("Σ monthly max(0, expenses + instalments − revenue − subsidies), vs the conventional farm")
                .add());
        calcs.add(context.calc(p + "gap_y1_peak", "Largest monthly gap in the first year", cfg.metric("gap_y1_peak_eur"),
                Unit.EUR_PER_MONTH).add());
        calcs.add(context.calc(p + "prefinancing_capacity", "APIA pre-financing capacity in the first year",
                cfg.metric("coverage_y1_eur"), Unit.EUR)
                .formula("advance percentage × (APIA subsidies today + first-year organic payments)")
                .source(context.paramSource("apiaPrefinancingAdvancePct")).add());
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("certified_area", "CERTIFIED_AREA_HA", "nitrogen_saved", "NITROGEN_SAVED_KG",
                "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.area", "AREA_HA", "baseline.nitrogen", "NITROGEN_USE_KG", "baseline.co2", "CO2_EMITTED_T");
    }

    /** Not energy: the average yearly margin gain over the conventional farm across the horizon. */
    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_margin_eur", "margin_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        // CERTIFICATION has no numeric threshold: one certificate or conversion contract must exist
        context.calc("rules.threshold.certification", "Green threshold: EU organic certificate or conversion contract",
                BigDecimal.ONE, Unit.COUNT).formula("at least one certificate or contract with a certification body")
                .source(context.module().threshold().sourceRo()).add();
        rule(context, "yieldPctConversionYear1", "Yield in conversion year 1, as share of conventional", Unit.PCT);
        rule(context, "yieldPctConversionYear2", "Yield in conversion year 2, as share of conventional", Unit.PCT);
        rule(context, "yieldPctCertified", "Yield after certification, as share of conventional", Unit.PCT);
        rule(context, "organicPricePremiumPct", "Organic price premium after certification", Unit.PCT);
        rule(context, "costEurPerHaConventional", "Expenses per hectare, conventional farming", Unit.EUR_PER_HA);
        rule(context, "costEurPerHaOrganic", "Expenses per hectare, organic farming", Unit.EUR_PER_HA);
        rule(context, "conversionPaymentEurPerHa", "Conversion payment (conversion years)", Unit.EUR_PER_HA);
        rule(context, "maintenancePaymentEurPerHa", "Maintenance payment (after certification)", Unit.EUR_PER_HA);
        rule(context, "apiaPrefinancingAdvancePct", "Advance of the APIA subsidy pre-financing (F5)", Unit.PCT);
        rule(context, "maxGraceMonths", "Maximum grace period", Unit.MONTHS);
        context.calc("rules.factor.nitrogen", "Mineral nitrogen emission factor (kg CO₂e/kg N)",
                RuleValues.factor(context, "nitrogenKgCo2ePerKgN"), Unit.RATIO)
                .source(RuleValues.factorSource(context, "nitrogenKgCo2ePerKgN")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
        result.put("certificationDocumentPresent", hasCertification(context));
        result.put("conversionPlanPresent", context.workspace().documentOfType("BUSINESS_PLAN").isPresent()
                || context.run().request().documents().stream().anyMatch(d -> "BUSINESS_PLAN".equals(d.docType())));
        result.put("nitrogenKgPerHa", context.questionnaire().path("nitrogen_kg_ha").asDouble(0));
        result.put("tillage", context.questionnaire().path("tillage").asText("NECUNOSCUT"));
        result.put("coverCrops", context.questionnaire().path("cover_crops").asText("NECUNOSCUT"));
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
        context.calc("impact.certified_area", "Organic hectares certified or in conversion", cfg.metric("certified_area_ha"),
                Unit.HA).add();
        context.calc("impact.margin_horizon", "Cumulative margin vs conventional over the horizon",
                cfg.metric("margin_total_eur"), Unit.EUR).add();
    }

    /**
     * Grace sized by the liquidity gap: no installment until the last month of the first {@code maxGraceMonths} months of
     * the loan in which the conversion still leaves a gap (README §13: until the first harvest, at most 12 months).
     */
    @Override
    public int graceMonths(ToolContext context, Configuration cfg) {
        OrganicPlans.Setup setup = OrganicPlans.setup(context);
        List<Tranche> tranches = OrganicPlans.tranches(setup, OrganicPlans.phasing(cfg.components()));
        int max = context.param("maxGraceMonths").intValueExact();
        YearMonth first = YearMonth.from(context.today())
                .plusMonths(RuleValues.financingDefault(context, "firstInstallmentOffsetMonths").longValue());
        Map<Integer, List<BigDecimal>> gapByYear = new HashMap<>();
        List<BigDecimal> series = new ArrayList<>();
        for (int k = 0; k < max; k++) {
            YearMonth month = first.plusMonths(k);
            List<BigDecimal> gap = gapByYear.computeIfAbsent(month.getYear(),
                    year -> OrganicPlans.monthlyGap(setup, tranches, year, OrganicPlans.noInstalments()));
            series.add(gap.get(month.getMonthValue() - 1));
        }
        return OrganicCalculator.graceMonths(series, max);
    }

    static boolean hasCertification(ToolContext context) {
        return context.run().request().documents().stream().anyMatch(d -> "CERTIFICATION_CONTRACT".equals(d.docType()));
    }

    private static void rule(ToolContext context, String param, String labelRo, Unit unit) {
        context.calc("rules." + param, labelRo, context.param(param), unit).source(context.paramSource(param)).add();
    }
}
