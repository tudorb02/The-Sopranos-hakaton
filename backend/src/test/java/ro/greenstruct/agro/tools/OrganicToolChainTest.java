package ro.greenstruct.agro.tools;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.orchestration.RunRequest;
import ro.greenstruct.agro.orchestration.RunStatus;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * The organic dossier (DEMO-0006: 120 ha in Mureș entering conversion on 1 Jan 2027, mechanical weeding equipment of
 * 78,000 EUR) through the tools in the order of the agents. Expected values come from the Product team's
 * data/demo/test-documents/farms/DEMO-0006.json (margins, nitrogen, CO2e) and from a separate script that redoes the
 * monthly gap, the green rate and the seasonal schedule with Decimal arithmetic (see the comments), not from the
 * code's output.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class OrganicToolChainTest {

    private static final BigDecimal CENTS = new BigDecimal("0.02");

    private static final String OFFER = """
            {"documentId": "doc_oferta_utilaje_bio", "documentType": "OFFER", "moduleId": "ecologic", "currency": "EUR",
             "supplierName": "Agro Mecanic Demo SRL",
             "documentFields": [{"key": "TOTAL_NET", "rawValue": "78.000 EUR", "unit": "EUR", "page": 1, "confidence": "HIGH"}],
             "lineItems": [
               {"lineId": "ln_1", "category": "IMPLEMENT", "descriptionRo": "Prășitoare 6 rânduri, cu ghidare prin cameră",
                "fields": [{"key": "QUANTITY", "rawValue": "1 buc.", "unit": "PCS", "page": 1, "confidence": "HIGH"},
                           {"key": "LINE_PRICE_NET", "rawValue": "46.000 EUR", "unit": "EUR", "page": 1, "confidence": "HIGH"}]},
               {"lineId": "ln_2", "category": "IMPLEMENT", "descriptionRo": "Grapă cu colți elastici, lățime de lucru 12 m",
                "fields": [{"key": "QUANTITY", "rawValue": "1 buc.", "unit": "PCS", "page": 1, "confidence": "HIGH"},
                           {"key": "LINE_PRICE_NET", "rawValue": "32.000 EUR", "unit": "EUR", "page": 1, "confidence": "HIGH"}]}],
             "missingFields": [], "warnings": []}
            """;

    /** Two invoices of ammonium nitrate 34% N, 26,000 kg and 20,000 kg. */
    private static final String FERTILIZER = """
            {"documentId": "doc_facturi_azot", "documentType": "FERTILIZER_INVOICES", "moduleId": "ecologic",
             "currency": "EUR", "supplierName": "Agro Inputuri Demo SRL", "documentFields": [],
             "lineItems": [
               {"lineId": "ln_1", "category": "OTHER", "descriptionRo": "Azotat de amoniu 34% N, factura AI-26-0277",
                "fields": [{"key": "QUANTITY", "rawValue": "26.000 kg", "unit": "PCS", "page": 1, "confidence": "HIGH"}]},
               {"lineId": "ln_2", "category": "OTHER", "descriptionRo": "Azotat de amoniu 34% N, factura AI-26-0451",
                "fields": [{"key": "QUANTITY", "rawValue": "20.000 kg", "unit": "PCS", "page": 1, "confidence": "HIGH"}]}],
             "missingFields": [], "warnings": []}
            """;

    @TestConfiguration
    static class FixtureExtractor {

        @Bean
        DocumentExtractor organicFixtureExtractor(ObjectMapper mapper) {
            return (document, content, module) -> mapper.readTree(switch (document.documentId()) {
                case "doc_oferta_utilaje_bio" -> OFFER;
                case "doc_facturi_azot" -> FERTILIZER;
                default -> throw new IllegalArgumentException("No fixture for " + document.documentId());
            });
        }
    }

    @Autowired
    private ToolRegistry tools;
    @Autowired
    private RunStore runs;
    @Autowired
    private FarmProfileService farms;
    @Autowired
    private DocumentStore documents;
    @Autowired
    private CalcStore calcs;
    @Autowired
    private ObjectMapper mapper;

    private static final String QUESTIONNAIRE = "{\"crops_main\": \"grâu 6 t/ha; porumb 8 t/ha; soia 3 t/ha\","
            + " \"conversion_ha\": 120, \"conversion_start_year\": 2027, \"nitrogen_kg_ha\": 130,"
            + " \"cashin_months\": [\"OCT\", \"NOV\", \"DEC\"], \"old_equipment_fate\": \"NU_E_CAZUL\"}";

    @Test
    void organicDossierThroughTheAgents() {
        String run = newRun(QUESTIONNAIRE, Map.of("doc_oferta_utilaje_bio", "OFFER",
                "doc_contract_certificare", "CERTIFICATION_CONTRACT", "doc_plan_conversie", "BUSINESS_PLAN",
                "doc_facturi_azot", "FERTILIZER_INVOICES"));

        // Agent 1
        call(run, "extract_document", "{\"documentId\": \"doc_oferta_utilaje_bio\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_azot\"}");
        JsonNode rules = call(run, "get_module_rules", "{}");
        assertThat(rules.path("thresholdKind").asText()).isEqualTo("CERTIFICATION");
        assertValue(run, "rules.maxGraceMonths", "12");

        JsonNode baseline = call(run, "compute_baseline", "{}");
        assertThat(baseline.path("conversionStartYear").asInt()).isEqualTo(2027);
        assertValue(run, "baseline.area", "120");
        // (26,000 + 20,000) kg ammonium nitrate × 34% N = 15,640 kg N; × 4.29 kg CO2e/kg N / 1,000 = 67.0956 t (Product: 67.1)
        assertValue(run, "baseline.nitrogen", "15640");
        assertValue(run, "baseline.co2", "67.0956");
        // conventional farm: revenue 159,800 − costs 120 ha × 950 = 45,800 EUR/year
        assertValue(run, "baseline.revenue_conventional", "159800");
        assertValue(run, "baseline.margin_conventional", "45800");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_utilaje_bio\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.total_cost", "78000");
        assertValue(run, "cfg_initial.indicator", "100");
        assertValue(run, "cfg_initial.certified_area", "120");
        assertValue(run, "cfg_initial.nitrogen_saved", "15640");
        assertValue(run, "cfg_initial.co2_avoided", "67.0956");
        // Product's expected margins against the conventional farm, full conversion (DEMO-0006.json)
        assertValue(run, "cfg_initial.margin_y1", "-27540");
        assertValue(run, "cfg_initial.margin_y2", "-19550");
        assertValue(run, "cfg_initial.margin_y3", "43568");
        assertValue(run, "cfg_initial.margin_y4", "43568");
        assertValue(run, "cfg_initial.margin_y5", "43568");
        // −27,540 − 19,550 + 3 × 43,568
        assertValue(run, "cfg_initial.margin_total", "83614");
        // monthly gap of 2027 without instalments: 36,020.07 in total, 9,038.39 in July (separate script, Decimal)
        assertValue(run, "cfg_initial.gap_y1", "36020.07");
        assertValue(run, "cfg_initial.gap_y1_peak", "9038.39");
        // 80% × (24,000 APIA today + 120 ha × 220 EUR conversion payment)
        assertValue(run, "cfg_initial.prefinancing_capacity", "40320");

        // the guidance moment: full against phased
        JsonNode comparison = call(run, "compare_conversion_plans", "{}");
        assertThat(comparison.path("recommendedPlan").asText()).isEqualTo("FULL");
        assertThat(comparison.path("fullCovered").asBoolean()).isTrue();
        assertValue(run, "plan.full.margin_total", "83614");
        assertValue(run, "plan.phased.margin_y1", "-13770");
        assertValue(run, "plan.phased.margin_y2", "-23545");
        assertValue(run, "plan.phased.margin_y3", "12009");
        assertValue(run, "plan.phased.margin_y4", "43568");
        // −13,770 − 23,545 + 12,009 + 2 × 43,568
        assertValue(run, "plan.phased.margin_total", "61830");
        assertValue(run, "plan.benefit_delayed", "21784");
        assertValue(run, "plan.full.gap_y1", "36020.07");
        assertValue(run, "plan.phased.gap_y1", "18010.04");
        assertValue(run, "plan.phased.gap_peak", "4519.20");
        assertValue(run, "plan.full.coverage", "40320");
        // 80% × (24,000 + 60 ha × 220)
        assertValue(run, "plan.phased.coverage", "29760");
        assertValue(run, "plan.shortfall", "0");

        // the phased plan as a catalog alternative of the generic upgrade search
        JsonNode search = call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).hasSize(1).first().satisfies(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_plan");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("PASS");
        });
        call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_phased\","
                + " \"add\": [\"eco.plan.phased_60_60\"]}");
        assertValue(run, "cfg_phased.total_cost", "78000");
        assertValue(run, "cfg_phased.upgrade_cost", "0");
        assertValue(run, "cfg_phased.ha_year1", "60");
        assertValue(run, "cfg_phased.margin_y1", "-13770");
        assertValue(run, "cfg_phased.margin_total", "61830");
        assertValue(run, "cfg_phased.gap_y1", "18010.04");

        JsonNode dnsh = call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(dnsh.path("certificationDocumentPresent").asBoolean()).isTrue();
        assertThat(dnsh.path("conversionPlanPresent").asBoolean()).isTrue();
        assertThat(dnsh.path("natura2000Parcels")).isEmpty();
        saveTechnicalAssessment(run);

        // Agent 2
        call(run, "list_financing_lines", "{}");
        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.machinery\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.agri.credit_bio\"]}]}");
        assertValue(run, "option_b.loan.amount", "78000");

        JsonNode tier = call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\", \"financedConfigId\": \"cfg_initial\"}");
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE");
        call(run, "price_loan", "{}");
        // EURIBOR 2.618 + funding 1.1 + risk 2.5% × 45% × 30% + capital 22.5% × 12% × 12% + operational 1.35 + profit 1.77
        // − programme 0.4 + tier VERDE 0.2 = 7.2995%
        assertValue(run, "pricing.green.rate", "7.2995");
        assertValue(run, "pricing.classic.rate", "9.518");

        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        // PMT(78,000; 9.518%/12; 60)
        assertValue(run, "option_a.installment", "1638.83");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"SEASONAL\"}");
        // the gap of 2027 and January 2028 keeps the loan in grace for the full 12 months; payments then only in
        // Oct-Nov-Dec (the farm's cash-in months): 12 equal installments whose present value at 7.2995% is 78,000 (periods 21–23, 33–35, 45–47, 57–59 of a loan from February)
        assertValue(run, "option_b.grace_months", "12");
        assertValue(run, "option_b.grace", "20");
        assertValue(run, "option_b.installment", "8257.01");
        assertValue(run, "option_b.total_interest", "21084.07");
        // average margin gain over 5 years: 83,614 / 5
        assertValue(run, "option_b.savings.margin_eur", "16722.80");
        assertValue(run, "option_b.savings_horizon", "83614");

        JsonNode gap = call(run, "compute_liquidity_gap", "{\"optionIds\": [\"B\"]}");
        // 2027: grace, no instalments; 2028: + 3 × 8,257.01 in Oct-Dec; 2029 on: certified, small residual gaps
        assertValue(run, "option_b.gap.y1", "36020.07");
        assertValue(run, "option_b.gap.y2", "46009.79");
        assertValue(run, "option_b.gap.y3", "6646.82");
        assertValue(run, "option_b.gap.peak", "13721.34");
        assertValue(run, "option_b.gap.coverage_y1", "40320");
        assertThat(gap.path("B").path("firstYearCovered").asBoolean()).isTrue();
        // 2028 (second conversion year, first instalments) is 5,259 EUR above the pre-financing capacity
        assertThat(gap.path("B").path("allYearsCovered").asBoolean()).isFalse();

        call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // (39,000 net cash flow + 16,722.80 average margin gain) / 24,771.03 (3 × 8,257.01 per loan year)
        assertValue(run, "option_b.dscr", "2.2495");
        JsonNode affordability = call(run, "check_affordability", "{\"optionIds\": [\"B\"]}");
        assertThat(affordability.path("B").path("result").asText()).isEqualTo("PASS");

        // Agent 3
        call(run, "calculate_impact", "{\"configId\": \"cfg_initial\"}");
        assertValue(run, "label.green_amount", "78000");
        assertValue(run, "label.green_share", "100");
        assertValue(run, "impact.certified_area", "120");
        assertValue(run, "impact.margin_horizon", "83614");
        // 67.0956 t/year × 5 years
        assertValue(run, "impact.co2_horizon", "335.478");
        JsonNode funds = call(run, "select_fund", "{\"optionId\": \"B\"}");
        assertThat(funds.toString()).contains("F3").contains("F5");
    }

    @Test
    void withoutACertificationContractTheOfferIsNotGreen() {
        String run = newRun(QUESTIONNAIRE, Map.of("doc_oferta_utilaje_bio", "OFFER"));
        call(run, "extract_document", "{\"documentId\": \"doc_oferta_utilaje_bio\"}");
        call(run, "compute_baseline", "{}");
        // no fertilizer invoices: the nitrogen is the farmer's answer, 130 kg N/ha × 120 ha
        assertValue(run, "baseline.nitrogen", "15600");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_utilaje_bio\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertValue(run, "cfg_initial.indicator", "0");

        ToolOutput stack = tools.execute(run, "build_funding_stack", mapper.createObjectNode()
                .set("options", mapper.createArrayNode().add(mapper.createObjectNode().put("optionId", "B")
                        .put("configId", "cfg_initial")
                        .set("products", mapper.createArrayNode().add("rbro.agri.credit_bio")))));
        assertThat(stack.ok()).isFalse();
        assertThat(stack.messageRo()).contains("trece pragul");
    }

    @Test
    void conversionHectaresCannotExceedTheSelectedParcels() {
        String run = newRun(QUESTIONNAIRE.replace("\"conversion_ha\": 120", "\"conversion_ha\": 150"), Map.of());

        ToolOutput output = tools.execute(run, "compute_baseline", mapper.createObjectNode());

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("150").contains("120");
    }

    private void saveTechnicalAssessment(String runId) {
        try {
            JsonNode assessment = mapper.readTree("""
                    {"initialConfigId": "cfg_initial", "recommendedConfigId": "cfg_initial",
                     "dnshChecks": [{"objective": "CLIMATE_MITIGATION", "status": "PASS", "evidence": [], "noteRo": "ok"},
                                    {"objective": "BIODIVERSITY", "status": "PASS", "evidence": [], "noteRo": "ok"}]}
                    """);
            runs.save(runs.find(runId).orElseThrow().withAgentOutput(AgentSlot.TECHNICAL_AUDITOR, assessment));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String newRun(String questionnaire, Map<String, String> docs) {
        List<StoredDocument> stored = new ArrayList<>();
        new LinkedHashMap<>(docs).forEach((id, type) -> stored.add(documents.save(id, type, id + ".pdf",
                "application/pdf", new byte[]{1})));
        try {
            RunRequest request = new RunRequest("41629307", "ecologic", List.of("mu_3101", "mu_3102", "mu_3103"),
                    mapper.readTree(questionnaire), stored, null);
            Run run = Run.create(request, List.of(), farms.get("41629307")).withStatus(RunStatus.DATE_FIRMA);
            return runs.save(run).id();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private JsonNode call(String runId, String tool, String input) {
        try {
            ToolOutput output = tools.execute(runId, tool, mapper.readTree(input));
            assertThat(output.ok()).as(tool + ": " + output.messageRo()).isTrue();
            return output.result();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void assertValue(String runId, String key, String expected) {
        Calc calc = calcs.latestByKey(runId, key).orElseThrow(() -> new AssertionError("No calc " + key));
        assertThat(calc.calcId()).matches("^calc_[a-f0-9]{12}$");
        assertThat(calc.value()).as(key).isCloseTo(new BigDecimal(expected), within(CENTS));
    }
}
