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

import ro.greenstruct.agro.demo.DemoScenarioService;
import ro.greenstruct.agro.farm.FarmProfileService;
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
 * The energy dossier of the demo farm (DEMO-0002 of the Product team: a poultry farm in Prahova, 215,000 kWh/year,
 * 300 kWp requested, 100 kWp recommended) through the tools in the agents' order, with the documents' extraction
 * in place of Bedrock. Every expected figure was worked out by hand from the monthly invoices and the production
 * profile (see EnergyCalculatorTest), and the loan figures with a separate annuity calculation, not from the code.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class EnergyToolChainTest {

    private static final BigDecimal CENTS = new BigDecimal("0.02");

    /** The 12 invoices, October 2025 to September 2026: [period start, kWh, net EUR at 0.19 EUR/kWh]. */
    private static final String[][] INVOICES = {
            {"01.10.2025", "15.000", "2.850,00"}, {"01.11.2025", "15.500", "2.945,00"},
            {"01.12.2025", "18.500", "3.515,00"}, {"01.01.2026", "19.000", "3.610,00"},
            {"01.02.2026", "17.000", "3.230,00"}, {"01.03.2026", "16.000", "3.040,00"},
            {"01.04.2026", "15.000", "2.850,00"}, {"01.05.2026", "17.000", "3.230,00"},
            {"01.06.2026", "20.000", "3.800,00"}, {"01.07.2026", "23.000", "4.370,00"},
            {"01.08.2026", "22.000", "4.180,00"}, {"01.09.2026", "17.000", "3.230,00"}};

    private static String field(String key, String raw, String unit) {
        return "{\"key\": \"%s\", \"rawValue\": \"%s\", \"unit\": \"%s\", \"page\": 1, \"confidence\": \"HIGH\"}"
                .formatted(key, raw, unit);
    }

    private static String line(int n, String category, String description, String price, String... extraFields) {
        List<String> fields = new ArrayList<>(List.of(field("LINE_PRICE_NET", price + " EUR", "EUR")));
        fields.addAll(List.of(extraFields));
        return "{\"lineId\": \"ln_%d\", \"category\": \"%s\", \"descriptionRo\": \"%s\", \"fields\": [%s]}"
                .formatted(n, category, description, String.join(",", fields));
    }

    private static String offer(String documentId, String kwpRaw, String total, List<String> lines) {
        // The installed power is stated once for the whole offer, in the technical parameters table.
        return """
                {"documentId": "%s", "documentType": "OFFER", "moduleId": "energie", "currency": "EUR",
                 "documentFields": [%s, %s],
                 "lineItems": [%s], "missingFields": [], "warnings": []}
                """.formatted(documentId, field("TOTAL_NET", total + " EUR", "EUR"),
                field("ENGINE_POWER_KW", kwpRaw, "KW"), String.join(",", lines));
    }

    private static String invoices(String documentId) {
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < INVOICES.length; i++) {
            lines.add("{\"lineId\": \"ln_%d\", \"category\": \"OTHER\", \"descriptionRo\": \"Factură energie\", \"fields\": [%s, %s, %s]}"
                    .formatted(i + 1, field("PERIOD_FROM", INVOICES[i][0], "DATE"),
                            field("ENERGY_KWH", INVOICES[i][1] + " kWh", "KWH"),
                            field("ENERGY_COST", INVOICES[i][2] + " EUR", "EUR")));
        }
        return """
                {"documentId": "%s", "documentType": "ENERGY_INVOICES", "moduleId": "energie", "currency": "EUR",
                 "documentFields": [%s, %s], "lineItems": [%s], "missingFields": [], "warnings": []}
                """.formatted(documentId, field("ENERGY_KWH", "215.000 kWh", "KWH"),
                field("ENERGY_COST", "40.850,00 EUR", "EUR"), String.join(",", lines));
    }

    private static final Map<String, String> EXTRACTIONS = Map.of(
            "doc_oferta_fotovoltaice", offer("doc_oferta_fotovoltaice", "300 kWp", "210.000,00", List.of(
                    line(1, "PV_SYSTEM", "Panouri fotovoltaice monocristaline 550 Wp", "98.000,00",
                            field("QUANTITY", "546 buc.", "PCS")),
                    line(2, "PV_SYSTEM", "Invertoare trifazate 100 kW", "42.000,00", field("QUANTITY", "3 buc.", "PCS")),
                    line(3, "PV_SYSTEM", "Structură de montaj pe acoperiș, cabluri, protecții", "48.000,00"),
                    line(4, "INSTALLATION_WORKS", "Proiectare, montaj, punere în funcțiune", "22.000,00"))),
            "doc_facturi_energie_avicola", invoices("doc_facturi_energie_avicola"),
            // 100 kWp with a solar pump that replaces a diesel one: 62,000 + 10,000 + 30,000 = 102,000 EUR.
            "doc_oferta_pv_pompa", offer("doc_oferta_pv_pompa", "100 kWp", "102.000,00", List.of(
                    line(1, "PV_SYSTEM", "Instalație fotovoltaică 100 kWp", "62.000,00"),
                    line(2, "INSTALLATION_WORKS", "Montaj și punere în funcțiune", "10.000,00"),
                    line(3, "SOLAR_PUMP", "Pompă solară pentru adăpare", "30.000,00"))));

    @TestConfiguration
    static class ExtractionFixtures {

        @Bean
        DocumentExtractor energyFixtureExtractor(ObjectMapper mapper) {
            return (document, content, module) -> mapper.readTree(EXTRACTIONS.get(document.documentId()));
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
    @Autowired
    private DemoScenarioService demo;

    private static final String ANSWERS = "{\"mounting\": \"ACOPERIS\", \"available_area_m2\": 2600,"
            + " \"daytime_share_pct\": 55, \"diesel_pump_litres_year\": 0, \"has_grid_notice\": false,"
            + " \"cashin_months\": [\"JAN\", \"MAY\", \"JUL\", \"AUG\"], \"old_equipment_fate\": \"NU_E_CAZUL\"}";

    @Test
    void oversizedOfferIsResizedAndFinancedGreen() {
        String run = newRun(ANSWERS, Map.of("doc_oferta_fotovoltaice", "OFFER",
                "doc_facturi_energie_avicola", "ENERGY_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_fotovoltaice\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_avicola\"}");
        JsonNode rules = call(run, "get_module_rules", "{}");
        assertThat(rules.path("thresholdKind").asText()).isEqualTo("BY_NATURE");
        assertThat(rules.path("catalog")).extracting(c -> c.path("catalogId").asText())
                .containsExactly("nrg.pv100", "nrg.pv150", "nrg.pv200", "nrg.pv300");
        assertValue(run, "rules.sizing.max_export", "30");
        assertValue(run, "rules.pv_yield", "1250");

        // The 12 invoices add up to 215,000 kWh at 0.19 EUR/kWh: 40,850 EUR; 215 MWh × 0.26 t/MWh = 55.9 t CO₂.
        call(run, "compute_baseline", "{}");
        assertValue(run, "baseline.consumption", "215000");
        assertValue(run, "baseline.price", "0.19");
        assertValue(run, "baseline.cost", "40850");
        assertValue(run, "baseline.daytime_share", "55");
        assertValue(run, "baseline.co2", "55.9");

        // 300 kWp: 375,000 kWh produced, 118,250 used on the farm, 256,750 sold (68.47% of the production).
        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_fotovoltaice\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("sizing").asText()).isEqualTo("FAIL");
        assertThat(initial.path("components")).hasSize(4);
        assertValue(run, "cfg_initial.total_cost", "210000");
        assertValue(run, "cfg_initial.pv_kwp", "300");
        assertValue(run, "cfg_initial.production", "375000");
        assertValue(run, "cfg_initial.self_consumed", "118250");
        assertValue(run, "cfg_initial.exported", "256750");
        assertValue(run, "cfg_initial.export_share", "68.47");
        assertValue(run, "cfg_initial.coverage", "55");
        assertValue(run, "cfg_initial.indicator", "31.53");
        assertValue(run, "cfg_initial.roof_area", "1650");
        // 118,250 × 0.19 + 256,750 × 0.06 = 37,872.50 EUR; 210,000 / 37,872.50 = 5.54 years = 66.5 months
        assertValue(run, "cfg_initial.savings", "37872.5");
        assertValue(run, "cfg_initial.payback", "5.54");
        assertValue(run, "cfg_initial.payback_months", "66.54");
        assertValue(run, "cfg_initial.co2_avoided", "97.5");

        // The catalog sizes: only 100 kWp keeps the sold share within 30% (19.7%; 150 kWp sells 40.98%, 200 kWp 53.95%).
        JsonNode search = call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).hasSize(4)
                .extracting(c -> c.path("packageId").asText() + ":" + c.path("thresholdResult").asText())
                .containsExactlyInAnyOrder("pkg_pv100:PASS", "pkg_pv150:FAIL", "pkg_pv200:FAIL", "pkg_pv300:FAIL");
        assertValue(run, "cand.pv100.cost", "72000");
        assertValue(run, "cand.pv150.cost", "108000");
        assertValue(run, "cand.pv100.pct", "80.3");
        // 110,662.5 / 187,500 = 59.02%; 115,125 / 250,000 = 46.05%; 118,250 / 375,000 = 31.53%
        assertValue(run, "cand.pv150.pct", "59.02");
        assertValue(run, "cand.pv200.pct", "46.05");
        assertValue(run, "cand.pv300.pct", "31.53");

        JsonNode recommended = call(run, "simulate_upgrade_package",
                "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_recommended\", \"add\": [\"nrg.pv100\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        assertThat(recommended.path("meetsSafetyMargin").asBoolean()).isTrue();
        assertValue(run, "cfg_recommended.total_cost", "72000");
        assertValue(run, "cfg_recommended.upgrade_cost", "-138000");
        assertValue(run, "cfg_recommended.production", "125000");
        assertValue(run, "cfg_recommended.self_consumed", "100375");
        assertValue(run, "cfg_recommended.exported", "24625");
        assertValue(run, "cfg_recommended.export_share", "19.7");
        assertValue(run, "cfg_recommended.coverage", "46.69");
        assertValue(run, "cfg_recommended.indicator", "80.3");
        assertValue(run, "cfg_recommended.roof_area", "550");
        // 100,375 × 0.19 + 24,625 × 0.06 = 20,548.75 EUR; 72,000 / 20,548.75 = 3.50 years = 42.05 months
        assertValue(run, "cfg_recommended.savings", "20548.75");
        assertValue(run, "cfg_recommended.payback", "3.50");
        assertValue(run, "cfg_recommended.payback_months", "42.05");
        // 125 MWh × 0.26 t/MWh
        assertValue(run, "cfg_recommended.co2_avoided", "32.5");

        JsonNode dnsh = call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("mounting").asText()).isEqualTo("ACOPERIS");
        assertThat(dnsh.path("mountingEligible").asBoolean()).isTrue();
        assertThat(dnsh.path("areaSufficient").asBoolean()).isTrue();
        assertThat(dnsh.path("exportWithinLimit").asBoolean()).isTrue();
        assertThat(dnsh.path("sellsToGrid").asBoolean()).isTrue();
        assertThat(dnsh.path("gridNoticePresent").asBoolean()).isFalse();
        assertThat(dnsh.path("natura2000Parcels")).isEmpty();

        call(run, "list_financing_lines", "{}");
        assertValue(run, "line.term", "84");
        assertValue(run, "line.horizon", "7");
        JsonNode eligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(programs(eligibility)).containsEntry("FM_PV", "ELIGIBLE/CLOSED")
                .containsEntry("INVESTEU_FEI", "ELIGIBLE/PERMANENT");
        JsonNode requestedEligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_initial\"}");
        assertThat(programs(requestedEligibility)).containsEntry("INVESTEU_FEI", "NOT_ELIGIBLE/PERMANENT");

        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        // 70% FEI InvestEU guarantee on 72,000 EUR
        assertValue(run, "option_b.guarantee.amount", "50400");

        // Annuities over 84 months, computed separately: 210,000 at 8.9% → 3,368.06 (interest 72,916.93);
        // 72,000 at 6.4% → 1,065.68 (interest 17,516.88). Mortgage costs 1,450 + 380 × 7 years = 4,110.
        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "option_a.installment", "3368.06");
        assertValue(run, "option_a.total_interest", "72916.93");
        assertValue(run, "option_a.collateral_costs", "4110");
        // 37,872.50 × 7 years
        assertValue(run, "option_a.savings_horizon", "265107.5");
        assertValue(run, "option_a.net_cost", "21919.43");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "option_b.installment", "1065.68");
        assertValue(run, "option_b.total_interest", "17516.88");
        // 20,548.75 × 7 years
        assertValue(run, "option_b.savings_horizon", "143841.25");
        assertValue(run, "option_b.net_cost", "-54324.37");

        JsonNode comparison = call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("B");
        assertValue(run, "compare.net_advantage", "76243.8");

        // Yearly installments / yearly net cash flow of 101,000 EUR: 40.4 / 12.66 (limit 40%)
        JsonNode affordability = call(run, "check_affordability", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(affordability.path("A").path("result").asText()).isNotEqualTo("PASS");
        assertThat(affordability.path("B").path("result").asText()).isEqualTo("PASS");
        assertValue(run, "option_a.affordability_ratio", "40.02");
        assertValue(run, "option_b.affordability_ratio", "12.66");

        JsonNode labels = call(run, "get_labeling_rules", "{\"configId\": \"cfg_recommended\"}");
        assertThat(labels.path("rules")).anySatisfy(rule -> {
            assertThat(rule.path("category").asText()).isEqualTo("PV_SYSTEM");
            assertThat(rule.path("label").asText()).isEqualTo("TAXONOMY_ALIGNED");
            assertThat(rule.path("taxonomyActivity").asText()).isEqualTo("4.1");
        });
        JsonNode criteria = call(run, "get_dnsh_criteria", "{}");
        assertThat(criteria.path("substantialContribution").asText()).isEqualTo("CLIMATE_MITIGATION");
        call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        assertValue(run, "label.green_share", "100");
        // 125,000 kWh × 7 years; 32.5 t × 7 years
        assertValue(run, "impact.renewable_horizon", "875000");
        assertValue(run, "impact.co2_horizon", "227.5");
    }

    @Test
    void solarPumpReplacingDieselAddsFuelAndCo2Savings() {
        String answers = ANSWERS.replace("\"diesel_pump_litres_year\": 0", "\"diesel_pump_litres_year\": 5000");
        String run = newRun(answers, Map.of("doc_oferta_pv_pompa", "OFFER", "doc_facturi_energie_avicola", "ENERGY_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_pv_pompa\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_avicola\"}");
        call(run, "compute_baseline", "{}");
        assertValue(run, "baseline.diesel", "5000");
        // 5,000 l × 2.68 kg/l / 1,000 = 13.4 t; net diesel (10.3 / 1.21 − 2.697) / 4.97 = 1.17010 EUR/l → 5,850.50 EUR
        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_pv_pompa\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.total_cost", "102000");
        assertValue(run, "cfg_initial.production", "125000");
        assertValue(run, "cfg_initial.diesel_saved", "5000");
        assertValue(run, "cfg_initial.diesel_saving", "5850.5");
        assertValue(run, "cfg_initial.savings", "20548.75");
        // 32.5 t from the panels + 13.4 t from the diesel
        assertValue(run, "cfg_initial.co2_avoided", "45.9");
        // 102,000 / (20,548.75 + 5,850.50) × 12 = 46.36 months
        assertValue(run, "cfg_initial.payback_months", "46.36");
    }

    @Test
    void demoScenarioLoadsWithItsDocumentsAndFarm() {
        RunRequest request = demo.load("energie");

        assertThat(request.moduleId()).isEqualTo("energie");
        assertThat(request.cui()).isEqualTo("41726035");
        assertThat(request.parcelIds()).containsExactly("ph_0207_01");
        assertThat(request.documents()).extracting(StoredDocument::docType).containsExactly("OFFER", "ENERGY_INVOICES");
        assertThat(farms.get("41726035").company().name()).isEqualTo("Avicola Dealul Verde SRL");
        assertThat(request.questionnaire().path("daytime_share_pct").asInt()).isEqualTo(55);
    }

    @Test
    void panelsOnProductiveFarmlandDoNotPass() {
        String answers = ANSWERS.replace("\"ACOPERIS\"", "\"TEREN_AGRICOL\"");
        String run = newRun(answers, Map.of("doc_oferta_pv_pompa", "OFFER", "doc_facturi_energie_avicola", "ENERGY_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_pv_pompa\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_avicola\"}");
        call(run, "compute_baseline", "{}");
        // The size is right (19.7% sold), but the site is not eligible.
        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_pv_pompa\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertValue(run, "cfg_initial.export_share", "19.7");
    }

    private String newRun(String questionnaire, Map<String, String> docs) {
        List<StoredDocument> stored = new ArrayList<>();
        new LinkedHashMap<>(docs).forEach((id, type) -> stored.add(documents.save(id, type, id + ".pdf",
                "application/pdf", new byte[]{1})));
        try {
            RunRequest request = new RunRequest("41726035", "energie", List.of("ph_0207_01"),
                    mapper.readTree(questionnaire), stored, null);
            Run run = Run.create(request, List.of(), farms.get("41726035")).withStatus(RunStatus.DATE_FIRMA);
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

    private static Map<String, String> programs(JsonNode eligibility) {
        Map<String, String> byCode = new LinkedHashMap<>();
        eligibility.path("programs").forEach(p -> byCode.put(p.path("programCode").asText(),
                p.path("result").asText() + "/" + p.path("session").asText()));
        return byCode;
    }
}
