package ro.greenstruct.agro.tools;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import ro.greenstruct.agro.config.JsonFiles;
import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The README demo of category 3 (§6) through the tools in agent order, on the Product farm DEMO-0003: 600 ha, 46,800 l of
 * diesel (78 l/ha), 84,020 kg N, a 300 CP Stage V tractor at 185,000 EUR and 68 l/ha (12.8%, below the 20% threshold)
 * and a GPS RTK at 16,000 EUR (−9% diesel, −5% nitrogen) that brings it to 61.88 l/ha (20.7%). Every expected figure
 * was worked out by hand from the formulas of the README, with the net diesel price (10.3 lei/l / 1.21 − 2.697 lei/l)
 * / 4.97 lei/EUR = 1.17010 EUR/l and 1.00 EUR/kg N; the loans from PMT = P × r / (1 − (1 + r)^−n) in a separate
 * calculation.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class MachineryToolChainTest {

    /** Second-hand and non-Stage V offers that are not among the recorded demo documents. */
    private static final Map<String, String> EXTRA_READINGS = Map.of(
            "doc_sh_oferta", offer("Tractor 300 CP, second-hand, 2021", "300 CP", "Stage V", "second-hand", "2021",
                    "74 l/ha", "120.000,00 EUR"),
            "doc_sh_vechi", offer("Tractor 300 CP, second-hand, 2018", "300 CP", "Stage V", "second-hand", "2018",
                    "74 l/ha", "90.000,00 EUR"),
            "doc_stage_iv", offer("Tractor 300 CP, Stage IV, nou", "300 CP", "Stage IV", "nou", "2026", "60 l/ha",
                    "150.000,00 EUR"));

    private static String offer(String description, String power, String stage, String condition, String year,
                                String litresPerHa, String price) {
        return """
                {"documentId": "x", "documentType": "OFFER", "moduleId": "utilaje", "currency": "EUR",
                 "documentFields": [{"key": "TOTAL_NET", "rawValue": "%s", "unit": "EUR", "page": 1, "confidence": "HIGH"}],
                 "lineItems": [{"lineId": "ln_1", "category": "TRACTOR", "descriptionRo": "%s",
                   "fields": [
                     {"key": "QUANTITY", "rawValue": "1 buc.", "unit": "PCS", "page": 1, "confidence": "HIGH"},
                     {"key": "ENGINE_POWER_HP", "rawValue": "%s", "unit": "HP", "page": 1, "confidence": "HIGH"},
                     {"key": "EMISSION_STAGE", "rawValue": "%s", "unit": "TEXT", "page": 1, "confidence": "HIGH"},
                     {"key": "CONDITION", "rawValue": "%s", "unit": "TEXT", "page": 1, "confidence": "HIGH"},
                     {"key": "MANUFACTURE_YEAR", "rawValue": "%s", "unit": "YEAR", "page": 1, "confidence": "HIGH"},
                     {"key": "DIESEL_L_PER_HA", "rawValue": "%s", "unit": "L", "page": 1, "confidence": "HIGH"},
                     {"key": "LINE_PRICE_NET", "rawValue": "%s", "unit": "EUR", "page": 1, "confidence": "HIGH"}]}],
                 "missingFields": [], "warnings": []}
                """.formatted(price, description, power, stage, condition, year, litresPerHa, price);
    }

    @TestConfiguration
    static class RecordedReadings {

        @Bean
        DocumentExtractor recordedExtractor(ObjectMapper mapper) {
            return (document, content, module) -> {
                String inline = EXTRA_READINGS.get(document.documentId());
                if (inline != null) {
                    return ((com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(inline))
                            .put("documentId", document.documentId());
                }
                return JsonFiles.read(mapper, Path.of("../data/demo/extractions/" + document.documentId() + ".json"));
            };
        }
    }

    private static final List<String> PARCELS = List.of("il_2001", "il_2002", "il_2003");
    private static final String ANSWERS = "{\"replaced_machine_year\": 2004, \"replaced_machine_hp\": 240,"
            + " \"tillage\": \"ARATURA\", \"nitrogen_kg_ha\": 140, \"old_equipment_fate\": \"VANZARE\","
            + " \"loan_term\": \"ANI_5\", \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"]}";
    private static final Map<String, String> DEMO_DOCS = Map.of("doc_oferta_tractor", "OFFER",
            "doc_facturi_motorina", "FUEL_INVOICES", "doc_facturi_ingrasaminte", "FERTILIZER_INVOICES",
            "doc_fisa_tractor_vechi", "CURRENT_EQUIPMENT");

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

    private ChainSupport chain;

    @BeforeEach
    void setUp() {
        chain = new ChainSupport(tools, runs, farms, documents, calcs, mapper);
    }

    private String demoRun() {
        String run = chain.newRun("38264019", "utilaje", PARCELS, ANSWERS, DEMO_DOCS);
        for (String doc : List.of("doc_oferta_tractor", "doc_facturi_motorina", "doc_facturi_ingrasaminte",
                "doc_fisa_tractor_vechi")) {
            chain.call(run, "extract_document", "{\"documentId\": \"" + doc + "\"}");
        }
        return run;
    }

    @Test
    void theRequestedTractorFailsAndGpsRtkMakesItGreen() {
        String run = chain.newRun("38264019", "utilaje", PARCELS, ANSWERS, DEMO_DOCS);

        chain.call(run, "get_module_rules", "{}");
        chain.assertValue(run, "rules.threshold.reduction", "20");
        // (10.3 / 1.21 − 2.697) / 4.97 = 1.1701 EUR/l
        chain.assertValue(run, "rules.price.fuel_net", "1.17");
        chain.assertValue(run, "rules.price.nitrogen", "1");

        for (String doc : List.of("doc_oferta_tractor", "doc_facturi_motorina", "doc_facturi_ingrasaminte",
                "doc_fisa_tractor_vechi")) {
            chain.call(run, "extract_document", "{\"documentId\": \"" + doc + "\"}");
        }
        chain.assertValue(run, "doc.offer.total_net", "185000");
        chain.assertValue(run, "doc.fuel.litres_12m", "46800");

        JsonNode baseline = chain.call(run, "compute_baseline", "{}");
        assertThat(baseline.path("dataSource").asText()).isEqualTo("INVOICES");
        chain.assertValue(run, "baseline.area", "600");
        chain.assertValue(run, "baseline.fuel", "46800");
        chain.assertValue(run, "baseline.fuel_per_ha", "78");
        // 2 × 62,000 kg ammonium nitrate × 34% + 91,000 kg urea × 46% = 42,160 + 41,860 = 84,020 kg N; / 600 = 140.03
        chain.assertValue(run, "baseline.nitrogen", "84020");
        chain.assertValue(run, "baseline.nitrogen_per_ha", "140.03");
        // (46,800 × 2.68 + 84,020 × 4.29) / 1000 = (125,424 + 360,445.8) / 1000
        chain.assertValue(run, "baseline.co2", "485.87");
        chain.assertValue(run, "baseline.replaced_age", "22");
        chain.assertValue(run, "baseline.replaced_power", "240");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_tractor\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("sizing").asText()).isEqualTo("PASS");
        chain.assertValue(run, "cfg_initial.total_cost", "185000");
        chain.assertValue(run, "cfg_initial.tractor_per_ha", "68");
        // 1 − 68/78 = 12.82%; (78 − 68) × 600 = 6,000 l
        chain.assertValue(run, "cfg_initial.fuel_saving_pct", "12.82");
        chain.assertValue(run, "cfg_initial.nitrogen_saving_pct", "0");
        chain.assertValue(run, "cfg_initial.indicator", "12.82");
        chain.assertValue(run, "cfg_initial.fuel_saved", "6000");
        chain.assertValue(run, "cfg_initial.fuel_use", "40800");
        chain.assertValue(run, "cfg_initial.nitrogen_saved", "0");
        // 300 CP / 600 ha
        chain.assertValue(run, "cfg_initial.hp_per_ha", "0.5");
        // 6,000 l × 1.1701 EUR/l
        chain.assertValue(run, "cfg_initial.savings", "7020.6");
        // 6,000 × 2.68 / 1000
        chain.assertValue(run, "cfg_initial.co2_avoided", "16.08");

        JsonNode search = chain.call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).extracting(c -> c.path("packageId").asText())
                .containsExactly("pkg_vra", "pkg_gps", "pkg_gps_vra");
        assertThat(search.path("candidates")).extracting(c -> c.path("thresholdResult").asText())
                .containsExactly("FAIL", "PASS", "PASS");
        // the variable-rate module only cuts 12% of the nitrogen: 12% < 20%, the diesel stays at 12.82%
        chain.assertValue(run, "cand.vra.cost", "196000");
        chain.assertValue(run, "cand.vra.pct", "12.82");
        // 68 × 0.91 = 61.88 l/ha; 1 − 61.88/78 = 20.67%
        chain.assertValue(run, "cand.gps.cost", "201000");
        chain.assertValue(run, "cand.gps.pct", "20.67");
        chain.assertValue(run, "cand.gps_vra.cost", "212000");
        chain.assertValue(run, "cand.gps_vra.pct", "20.67");

        JsonNode recommended = chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_recommended\", \"add\": [\"utl.gps.rtk\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        chain.assertValue(run, "cfg_recommended.total_cost", "201000");
        chain.assertValue(run, "cfg_recommended.upgrade_cost", "16000");
        chain.assertValue(run, "cfg_recommended.fuel_per_ha", "61.88");
        chain.assertValue(run, "cfg_recommended.fuel_saving_pct", "20.67");
        chain.assertValue(run, "cfg_recommended.indicator", "20.67");
        chain.assertValue(run, "cfg_recommended.nitrogen_saving_pct", "5");
        // (78 − 61.88) × 600 = 9,672 l; 84,020 × 5% = 4,201 kg N; 61.88 × 600 = 37,128 l
        chain.assertValue(run, "cfg_recommended.fuel_saved", "9672");
        chain.assertValue(run, "cfg_recommended.nitrogen_saved", "4201");
        chain.assertValue(run, "cfg_recommended.fuel_use", "37128");
        // 9,672 × 1.1701 + 4,201 × 1.00 = 11,317.21 + 4,201
        chain.assertValue(run, "cfg_recommended.savings", "15518.21");
        // (9,672 × 2.68 + 4,201 × 4.29) / 1000 = (25,920.96 + 18,022.29) / 1000
        chain.assertValue(run, "cfg_recommended.co2_avoided", "43.94");
        // 16,000 / 201,000
        chain.assertValue(run, "cfg_recommended.precision_share", "7.96");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("stageV").asBoolean()).isTrue();
        assertThat(dnsh.path("nitrateVulnerableParcels")).hasSize(3);
        assertThat(dnsh.path("natura2000Parcels")).isEmpty();
        assertThat(dnsh.path("oldEquipmentFate").asText()).isEqualTo("VANZARE");
        assertThat(dnsh.path("usedEquipment")).isEmpty();
        assertThat(dnsh.path("tillage").asText()).isEqualTo("ARATURA");

        chain.call(run, "list_financing_lines", "{}");
        JsonNode eligibility = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        // new equipment, manager of 38 without a certificate of competence: 65% intensity; the GPS is 7.96% of the
        // investment, below the 10% share that earns the precision-farming points
        assertThat(ChainSupport.programs(eligibility)).containsEntry("DR_12", "ELIGIBLE/OPEN");
        chain.assertValue(run, "dr_12.intensity", "65");
        chain.assertValue(run, "dr_12.precision_points", "0");
        chain.call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.machinery\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");

        JsonNode tier = chain.call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        // requested 12.82% < 20%; with the GPS 20.67% ≥ 20% but < 20% × 1.5 = 30%
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        chain.assertValue(run, "green_tier.verde_plus_min", "30");

        chain.call(run, "price_loan", "{}");
        // classic: 2.00 + 1.20 + 3% × 45% + 75% × 12% × 12% + 1.50 + 1.77 = 8.90
        chain.assertValue(run, "pricing.classic.rate", "8.90");
        // green: 2.00 + 0.90 + 0.3375 + 0.324 + 1.35 + 1.77 − 0.40 = 6.2815, plus 0.20 pp for the tier below Verde Plus
        chain.assertValue(run, "pricing.green.rate", "6.48");

        chain.call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        chain.call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        // A: 185,000 over 60 months at 8.9%/12; B: 201,000 over 60 months at 6.4815%/12
        chain.assertValue(run, "option_a.installment", "3831.32");
        chain.assertValue(run, "option_b.installment", "3931.05");
        chain.assertValue(run, "option_a.total_interest", "44879.40");
        chain.assertValue(run, "option_b.total_interest", "34863.26");
        // 5 years of savings: A 5 × 7,020.60, B 5 × 15,518.21
        chain.assertValue(run, "option_a.savings.fuel_eur", "7020.6");
        chain.assertValue(run, "option_b.savings.fuel_eur", "11317.21");
        chain.assertValue(run, "option_b.savings.inputs_eur", "4201");
        // net cost = investment + interest − savings: 185,000 + 44,879.40 − 35,103.00; 201,000 + 34,863.26 − 77,591.03
        chain.assertValue(run, "option_a.net_cost", "194776.40");
        chain.assertValue(run, "option_b.net_cost", "158272.22");

        chain.call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // (74,000 + 7,020.60) / (12 × 3,831.32); (74,000 + 15,518.21) / (12 × 3,931.05)
        chain.assertValue(run, "option_a.dscr", "1.7622");
        chain.assertValue(run, "option_b.dscr", "1.8977");

        JsonNode comparison = chain.call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("B");
        chain.assertValue(run, "compare.net_advantage", "36504.18");
        chain.assertValue(run, "compare.driver.investment", "-16000");
        chain.assertValue(run, "compare.driver.interest", "10016.14");
        chain.assertValue(run, "compare.driver.savings", "42488.03");
        // the 16,000 EUR GPS pays back from (15,518.21 − 7,020.60) / 12 = 708.13 EUR a month more: 22.6 months
        chain.assertValue(run, "compare.upgrade_payback", "22.59");
    }

    @Test
    void secondHandTractorsGetNoGrantNoLabelAndTheNewAlternativeIsProposed() {
        String run = chain.newRun("38264019", "utilaje", PARCELS, ANSWERS, Map.of("doc_sh_oferta", "OFFER",
                "doc_facturi_motorina", "FUEL_INVOICES", "doc_facturi_ingrasaminte", "FERTILIZER_INVOICES"));
        for (String doc : List.of("doc_sh_oferta", "doc_facturi_motorina", "doc_facturi_ingrasaminte")) {
            chain.call(run, "extract_document", "{\"documentId\": \"" + doc + "\"}");
        }
        chain.call(run, "compute_baseline", "{}");

        JsonNode offered = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_sh_oferta\"}");
        // 1 − 74/78 = 5.13%
        assertThat(offered.path("thresholdResult").asText()).isEqualTo("FAIL");
        chain.assertValue(run, "cfg_initial.indicator", "5.13");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(dnsh.path("usedEquipment").get(0).path("ageYears").asInt()).isEqualTo(5);

        JsonNode secondHand = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_initial\"}");
        assertThat(ChainSupport.programs(secondHand)).containsEntry("DR_12", "NOT_ELIGIBLE/OPEN");
        assertThat(secondHand.path("programs").get(0).path("reasonsRo").toString()).contains("new machinery only");

        JsonNode usedLabels = chain.call(run, "get_labeling_rules", "{\"configId\": \"cfg_initial\"}");
        assertThat(usedLabels.path("rules").get(0).path("label").asText()).isEqualTo("NONE");

        // a new Stage V tractor saves 12% of 78 l/ha: 68.64 l/ha; with the GPS 62.4624 l/ha = 19.92% < 20%
        chain.call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        chain.assertValue(run, "cand.tractor.cost", "157500");
        chain.assertValue(run, "cand.tractor.pct", "12");
        // 74 × 0.91 = 67.34 l/ha: 1 − 67.34/78 = 13.67%, on the second-hand tractor
        chain.assertValue(run, "cand.gps.pct", "13.67");
        chain.assertValue(run, "cand.gps_tractor.cost", "173500");
        chain.assertValue(run, "cand.gps_tractor.pct", "19.92");

        JsonNode upgraded = chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_new\", \"add\": [\"utl.tractor.new_stage_v\", \"utl.gps.rtk\"]}");
        assertThat(upgraded.path("thresholdResult").asText()).isEqualTo("FAIL");
        // 525 EUR/CP × 300 CP + 16,000
        chain.assertValue(run, "cfg_new.total_cost", "173500");
        JsonNode newTractors = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_new\"}");
        assertThat(ChainSupport.programs(newTractors)).containsEntry("DR_12", "ELIGIBLE/OPEN");
        JsonNode newLabels = chain.call(run, "get_labeling_rules", "{\"configId\": \"cfg_new\"}");
        assertThat(newLabels.path("rules")).anySatisfy(r -> assertThat(r.path("label").asText()).isEqualTo("TRANSITION"));
    }

    @Test
    void theNewAlternativeReplacesOnlySecondHandTractors() {
        String run = demoRun();
        chain.call(run, "compute_baseline", "{}");
        chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_tractor\"}");

        ToolOutput output = chain.callRaw(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_x\", \"add\": [\"utl.tractor.new_stage_v\"]}");

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("only replaces second-hand machinery");
    }

    @Test
    void aTractorBelowStageVFailsTheEligibilityEvenWhenTheDieselIsLow() {
        String run = chain.newRun("38264019", "utilaje", PARCELS, ANSWERS, Map.of("doc_stage_iv", "OFFER",
                "doc_facturi_motorina", "FUEL_INVOICES", "doc_facturi_ingrasaminte", "FERTILIZER_INVOICES"));
        for (String doc : List.of("doc_stage_iv", "doc_facturi_motorina", "doc_facturi_ingrasaminte")) {
            chain.call(run, "extract_document", "{\"documentId\": \"" + doc + "\"}");
        }
        chain.call(run, "compute_baseline", "{}");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_stage_iv\"}");

        // 1 − 60/78 = 23.08% ≥ 20%, but the engine is Stage IV
        chain.assertValue(run, "cfg_initial.indicator", "23.08");
        assertThat(initial.path("sizing").asText()).isEqualTo("FAIL");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(dnsh.path("stageV").asBoolean()).isFalse();
        assertThat(dnsh.path("emissionStages").toString()).contains("Stage IV");
    }

    @Test
    void secondHandTooOldForTheLoanTermIsRefused() {
        String answers = "{\"loan_term\": \"ANI_7\", \"replaced_machine_year\": 2004}";
        String run = chain.newRun("38264019", "utilaje", PARCELS, answers, Map.of("doc_sh_vechi", "OFFER",
                "doc_facturi_motorina", "FUEL_INVOICES"));
        chain.call(run, "extract_document", "{\"documentId\": \"doc_sh_vechi\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_motorina\"}");
        chain.call(run, "compute_baseline", "{}");
        chain.call(run, "compute_indicator", "{\"documentId\": \"doc_sh_vechi\"}");
        chain.call(run, "build_funding_stack", "{\"options\": [{\"optionId\": \"A\", \"configId\": \"cfg_initial\","
                + " \"products\": [\"rbro.invest.machinery\"]}]}");

        ToolOutput output = chain.callRaw(run, "build_scenario",
                "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");

        // built in 2018: 8 years old today, 15 at the last installment of a 7-year loan (limit 12)
        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("second-hand").contains("at most 4 years");
    }

    @Test
    void withoutInvoicesTheNormAndTheQuestionnaireStandIn() {
        String run = chain.newRun("38264019", "utilaje", PARCELS, ANSWERS, Map.of("doc_oferta_tractor", "OFFER"));
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_tractor\"}");

        JsonNode baseline = chain.call(run, "compute_baseline", "{}");

        // 600 ha × 90 l/ha (config norm); 600 ha × 140 kg N/ha (questionnaire)
        assertThat(baseline.path("dataSource").asText()).isEqualTo("NORM");
        assertThat(baseline.path("warnings")).hasSize(2);
        chain.assertValue(run, "baseline.fuel", "54000");
        chain.assertValue(run, "baseline.fuel_per_ha", "90");
        chain.assertValue(run, "baseline.nitrogen", "84000");
    }
}
