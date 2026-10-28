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
            throw new IllegalArgumentException("Hectarele în conversie (" + conversionHa.toPlainString()
                    + ") trebuie să fie între 1 și suprafața parcelelor alese (" + area.toPlainString() + " ha)");
        }
        int startYear = questionnaire.path("conversion_start_year").asInt(0);
        if (startYear < 2000) {
            throw new IllegalArgumentException("Lipsește anul de început al conversiei (conversion_start_year)");
        }

        BigDecimal nitrogen;
        String nitrogenSource;
        var invoices = context.workspace().documentOfType("FERTILIZER_INVOICES");
        if (invoices.isPresent() && !invoices.get().lines().isEmpty()) {
            BigDecimal productKg = invoices.get().lines().stream().map(l -> l.numbers().get("QUANTITY"))
                    .filter(v -> v != null).reduce(BigDecimal.ZERO, BigDecimal::add);
            nitrogen = OrganicCalculator.nitrogenInFertilizerKg(productKg, context.param("fertilizerNContentPct"));
            nitrogenSource = "din facturile de îngrășăminte × conținutul de azot";
        } else if (questionnaire.has("nitrogen_kg_ha")) {
            nitrogen = OrganicCalculator.nitrogenAvoidedKg(questionnaire.path("nitrogen_kg_ha").decimalValue(), conversionHa);
            nitrogenSource = "kg N/ha declarat × hectare în conversie";
        } else {
            throw new IllegalArgumentException("Lipsesc facturile de îngrășăminte sau răspunsul nitrogen_kg_ha");
        }
        BigDecimal co2 = OrganicCalculator.co2eAvoidedTonnes(nitrogen, RuleValues.factor(context, "nitrogenKgCo2ePerKgN"));

        List<CropPlan> crops = OrganicPlans.crops(context);
        var parameters = OrganicPlans.parameters(context);
        YearResult conventional = OrganicCalculator.conventional(crops, startYear, parameters);

        Calc areaCalc = context.calc("baseline.area", "Suprafața parcelelor alese", area, Unit.HA).source("APIA").add();
        context.calc("baseline.conversion_ha", "Hectare care trec la bio", conversionHa, Unit.HA)
                .source("răspunsul fermierului + contractul de certificare").add();
        Calc nitrogenCalc = context.calc("baseline.nitrogen", "Azot mineral aplicat azi", nitrogen, Unit.KG_N_PER_YEAR)
                .formula(nitrogenSource).dependsOn(areaCalc).add();
        context.calc("baseline.co2", "CO₂e din azotul mineral azi", co2, Unit.T_CO2_PER_YEAR)
                .formula("kg N × 4,29 kg CO₂e/kg N / 1.000").source(RuleValues.factorSource(context, "nitrogenKgCo2ePerKgN"))
                .dependsOn(nitrogenCalc).add();
        context.calc("baseline.revenue_conventional", "Venitul din culturi azi", conventional.revenueEur(),
                Unit.EUR_PER_YEAR).formula("Σ ha × producție/ha × preț convențional").source("APIA + config").add();
        context.calc("baseline.margin_conventional", "Marja fermei convenționale", conventional.marginEur(),
                Unit.EUR_PER_YEAR).formula("venit − ha × cost convențional/ha").source("config/modules/ecologic.json").add();

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
            result.putArray("warnings").add("Fără facturi de îngrășăminte: azotul e cel declarat de fermier");
        }
        return context.ok(result, "Situația actuală: " + conversionHa.stripTrailingZeros().toPlainString()
                + " ha trec la bio din " + startYear + ", marja convențională " + conventional.marginEur().setScale(0,
                java.math.RoundingMode.HALF_EVEN).toPlainString() + " EUR/an");
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
        calcs.add(context.calc(p + "certified_area", "Hectare certificate sau în conversie", cfg.metric("certified_area_ha"),
                Unit.HA).formula("hectarele din contractul de certificare (0 fără contract sau certificat)").add());
        calcs.add(context.calc(p + "ha_year1", "Hectare care intră în conversie în primul an", cfg.metric("ha_year1"),
                Unit.HA).formula(cfg.metric("phased").signum() > 0 ? "prima tranșă a planului etapizat" : "toate hectarele")
                .add());
        calcs.add(context.calc(p + "nitrogen_saved", "Azot mineral evitat pe an", cfg.metric("nitrogen_saved_kg"),
                Unit.KG_N_PER_YEAR).formula("kg N/ha × ha (sau kg N din facturi)").add());
        int years = (int) cfg.metrics().keySet().stream().filter(k -> k.startsWith("margin_y")).count();
        for (int i = 1; i <= years; i++) {
            calcs.add(context.calc(p + "margin_y" + i, "Marja față de convențional, anul " + (startYear + i - 1),
                    cfg.metric("margin_y" + i), Unit.EUR_PER_YEAR)
                    .formula("(venit − cheltuieli + plăți bio) − marja convențională").add());
        }
        calcs.add(context.calc(p + "margin_total", "Marja cumulată față de convențional pe " + years + " ani",
                cfg.metric("margin_total_eur"), Unit.EUR).add());
        calcs.add(context.calc(p + "gap_y1", "Golul de lichiditate în primul an (fără rate)", cfg.metric("gap_y1_total_eur"),
                Unit.EUR).formula("Σ lunar max(0, cheltuieli + rate − venituri − subvenții), față de ferma convențională")
                .add());
        calcs.add(context.calc(p + "gap_y1_peak", "Cel mai mare gol lunar din primul an", cfg.metric("gap_y1_peak_eur"),
                Unit.EUR_PER_MONTH).add());
        calcs.add(context.calc(p + "prefinancing_capacity", "Capacitatea de prefinanțare APIA în primul an",
                cfg.metric("coverage_y1_eur"), Unit.EUR)
                .formula("procent de avans × (subvenții APIA azi + plăți bio din primul an)")
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
        rule(context, "yieldPctConversionYear1", "Producția în anul 1 de conversie, din cea convențională", Unit.PCT);
        rule(context, "yieldPctConversionYear2", "Producția în anul 2 de conversie, din cea convențională", Unit.PCT);
        rule(context, "yieldPctCertified", "Producția după certificare, din cea convențională", Unit.PCT);
        rule(context, "organicPricePremiumPct", "Prima de preț bio după certificare", Unit.PCT);
        rule(context, "costEurPerHaConventional", "Cheltuieli pe hectar, agricultura convențională", Unit.EUR_PER_HA);
        rule(context, "costEurPerHaOrganic", "Cheltuieli pe hectar, agricultura ecologică", Unit.EUR_PER_HA);
        rule(context, "conversionPaymentEurPerHa", "Plata pentru conversie (anii de conversie)", Unit.EUR_PER_HA);
        rule(context, "maintenancePaymentEurPerHa", "Plata pentru menținere (după certificare)", Unit.EUR_PER_HA);
        rule(context, "apiaPrefinancingAdvancePct", "Avansul prefinanțării subvențiilor APIA (F5)", Unit.PCT);
        rule(context, "maxGraceMonths", "Perioada maximă de grație", Unit.MONTHS);
        context.calc("rules.factor.nitrogen", "Factor de emisie al azotului mineral (kg CO₂e/kg N)",
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
        context.calc("impact.certified_area", "Hectare bio certificate sau în conversie", cfg.metric("certified_area_ha"),
                Unit.HA).add();
        context.calc("impact.margin_horizon", "Marja cumulată față de convențional pe orizont",
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
