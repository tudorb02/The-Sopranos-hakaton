package ro.greenstruct.agro.tools;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
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
import ro.greenstruct.agro.modules.ReferenceData;
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
 * Runs the tools in the order of contracts/fixtures/*.ndjson, with the fixtures' document extractions in
 * place of Bedrock, and checks the engine reproduces the fixtures' figures.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class ToolChainTest {

    private static final BigDecimal CENTS = new BigDecimal("0.02");

    /** Offers that are not in the fixtures: 5 second-hand John Deere tractors, built in 2021 or 2018. */
    private static final Map<String, String> EXTRA_EXTRACTIONS = Map.of(
            "doc_sh_oferta", secondHandOffer("doc_sh_oferta", "2021"),
            "doc_sh_vechi", secondHandOffer("doc_sh_vechi", "2018"));

    private static String secondHandOffer(String documentId, String year) {
        return """
                {"documentId": "%s", "documentType": "OFFER", "moduleId": "utilaje", "currency": "EUR",
                 "documentFields": [{"key": "TOTAL_NET", "rawValue": "340.000,00 EUR", "unit": "EUR", "page": 1, "confidence": "HIGH"}],
                 "lineItems": [{"lineId": "ln_1", "category": "TRACTOR", "descriptionRo": "John Deere 6R 185, second-hand, 5 buc.",
                   "fields": [
                     {"key": "QUANTITY", "rawValue": "5 buc.", "unit": "PCS", "page": 1, "confidence": "HIGH"},
                     {"key": "ENGINE_POWER_HP", "rawValue": "185 CP", "unit": "HP", "page": 1, "confidence": "HIGH"},
                     {"key": "CONDITION", "rawValue": "second-hand", "unit": "TEXT", "page": 1, "confidence": "HIGH"},
                     {"key": "MANUFACTURE_YEAR", "rawValue": "%s", "unit": "YEAR", "page": 1, "confidence": "HIGH"},
                     {"key": "LINE_PRICE_NET", "rawValue": "340.000,00 EUR", "unit": "EUR", "page": 1, "confidence": "HIGH"}]}],
                 "missingFields": [], "warnings": []}
                """.formatted(documentId, year);
    }

    @TestConfiguration
    static class FixtureExtractor {

        @Bean
        DocumentExtractor fixtureExtractor(ObjectMapper mapper) {
            return (document, content, module) -> EXTRA_EXTRACTIONS.containsKey(document.documentId())
                    ? mapper.readTree(EXTRA_EXTRACTIONS.get(document.documentId()))
                    : fixtureExtraction(mapper, document.documentId());
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
    private ReferenceData reference;
    @Autowired
    private ObjectMapper mapper;

    @Test
    void irrigationDossierReproducesTheFixture() {
        String run = newRun("45871203", "irigatii",
                List.of("ct_0412_01", "ct_0412_02", "ct_0412_03", "ct_0415_01", "ct_0415_02"),
                "{\"irrigation_current\": \"ASPERSIE_VECHE\", \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"],"
                        + " \"old_equipment_fate\": \"VANZARE\"}",
                Map.of("doc_oferta_aspersie", "OFFER", "doc_aviz_anar", "WATER_PERMIT_ANAR",
                        "doc_facturi_energie", "ENERGY_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_aspersie\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_aviz_anar\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie\"}");
        call(run, "get_module_rules", "{}");
        call(run, "compute_baseline", "{}");
        assertValue(run, "baseline.water", "233846.15");
        assertValue(run, "baseline.kwh_per_m3", "0.45");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_aspersie\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertValue(run, "cfg_initial.total_cost", "85000");
        assertValue(run, "cfg_initial.water_saving_pct", "15.03");
        // The fixture rounds kWh/m³ to 0.45 before multiplying; the engine keeps 0.449998…, hence +0.65 kWh.
        assertValue(run, "cfg_initial.energy_saved", "15818.89");

        JsonNode search = call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).anySatisfy(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_drip_sensors");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("PASS");
        });
        assertValue(run, "cand.sensors.pct", "21.83");
        assertValue(run, "cand.drip_sensors.cost", "113000");

        call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_min_pass\","
                + " \"add\": [\"irg.drip.surface_veg\", \"irg.sensors.soil_moisture\", \"irg.meter.electromagnetic\"]}");
        assertValue(run, "cfg_min_pass.water_saving_pct", "32.05");
        assertValue(run, "cfg_min_pass.energy_saved", "65502.73");
        JsonNode recommended = call(run, "simulate_upgrade_package",
                "{\"baseConfigId\": \"cfg_min_pass\", \"configId\": \"cfg_recommended\", \"add\": [\"irg.pump.solar_25kwp\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_recommended.total_cost", "125000");
        assertValue(run, "cfg_recommended.upgrade_cost", "40000");
        assertValue(run, "cfg_recommended.pv_kwh", "32000");
        assertValue(run, "cfg_recommended.energy_saved", "97502.73");
        // 97,502.73 kWh × 0.26 kg/kWh (config/factors.json) / 1,000 = 25.3507 t
        assertValue(run, "cfg_recommended.co2_avoided", "25.35");

        JsonNode dnsh = call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("permitValid").asBoolean()).isTrue();
        assertThat(dnsh.path("waterMeterInConfig").asBoolean()).isTrue();
        assertThat(dnsh.path("nitrateVulnerableParcels")).extracting(JsonNode::asText)
                .containsExactly("ct_0415_01", "ct_0415_02");

        call(run, "list_financing_lines", "{}");
        JsonNode eligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(programs(eligibility)).containsEntry("DR_12", "NOT_ELIGIBLE/OPEN")
                .containsEntry("DR_26", "ELIGIBLE/NOT_OPEN")
                .containsEntry("FM_PV", "ELIGIBLE/CLOSED")
                .containsEntry("INVESTEU_FEI", "ELIGIBLE/PERMANENT");

        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        assertValue(run, "option_b.guarantee.amount", "87500");

        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "option_a.installment", "1760.34");
        assertValue(run, "option_a.collateral_costs", "3350");
        assertValue(run, "option_a.savings_horizon", "36910.89");
        assertValue(run, "option_a.net_cost", "72059.37");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"SEASONAL\"}");
        assertValue(run, "option_b.installment", "7359.90");
        assertValue(run, "option_b.grace", "5");
        assertValue(run, "option_b.total_interest", "22198.05");
        assertValue(run, "option_b.savings_horizon", "142464.97");

        JsonNode comparison = call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("B");
        assertValue(run, "compare.net_advantage", "67326.29");
        assertValue(run, "compare.upgrade_payback", "22.74");

        JsonNode affordability = call(run, "check_affordability", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(affordability.path("A").path("result").asText()).isEqualTo("PASS_WITH_WARNING");
        assertThat(affordability.path("B").path("result").asText()).isEqualTo("PASS");
        assertValue(run, "option_a.affordability_ratio", "21.47");
        assertValue(run, "option_b.affordability_ratio", "29.92");

        call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // (98,400 net cash flow + 36,910.89 / 5 savings) / (12 × 1,760.34) = 105,782.18 / 21,124.08 = 5.0077
        assertValue(run, "option_a.dscr", "5.0077");
        // Seasonal: 4 installments in every loan year. (98,400 + 142,464.97 / 5) / (4 × 7,359.90) = 4.3103
        assertValue(run, "option_b.debt_service_year", "29439.60");
        assertValue(run, "option_b.dscr", "4.3103");

        assertThat(tools.execute(run, "determine_green_tier", mapper.createObjectNode()
                .put("requestedConfigId", "cfg_initial").put("financedConfigId", "cfg_recommended")).messageRo())
                .contains("Lipsește statusul DNSH");
        JsonNode tier = call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        // The offer saves 15.03% (< 25%); with the upgrade 32.05%: above 25% but below 25% × 1.5 = 37.5%.
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        assertThat(tier.path("upgradeNeeded").asBoolean()).isTrue();
        assertValue(run, "green_tier.verde_plus_min", "37.5");
        assertValue(run, "green_tier.financed_indicator", "32.05");

        JsonNode labels = call(run, "get_labeling_rules", "{\"configId\": \"cfg_recommended\"}");
        assertThat(labels.path("rules")).anySatisfy(rule -> {
            assertThat(rule.path("category").asText()).isEqualTo("SOLAR_PUMP");
            assertThat(rule.path("label").asText()).isEqualTo("TAXONOMY_ALIGNED");
            assertThat(rule.path("taxonomyActivity").asText()).isEqualTo("4.1");
        });
        call(run, "get_dnsh_criteria", "{}");
        call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        assertValue(run, "label.green_share", "100");
        assertValue(run, "impact.water_horizon", "374685.31");
        // 25.3507 t × 5 years = 126.7535 t
        assertValue(run, "impact.co2_horizon", "126.75");

        // B is secured by the FEI InvestEU guarantee: F1, the primary fund for irrigation (config/funds.json).
        JsonNode fund = call(run, "select_fund", "{\"optionId\": \"B\"}");
        assertThat(fund.path("fundId").asText()).isEqualTo("F1");
        assertThat(fund.path("role").asText()).isEqualTo("PRIMARY");
        // F6 has programmes checked above, none both eligible and open (DR_12 not eligible, DR_16/DR_26 not open).
        assertThat(fund.path("alternatives")).extracting(a -> a.path("fundId").asText() + "/" + a.path("status").asText())
                .containsExactly("F4/TO_CONFIRM", "F6/NOT_AVAILABLE");
        assertValue(run, "fund.coverage", "70");
        assertThat(tools.execute(run, "select_fund", mapper.createObjectNode().put("optionId", "A")).ok()).isFalse();

        assertThat(tools.execute(run, "check_fund_requirements",
                mapper.createObjectNode().put("fundId", "F1").put("optionId", "B")).messageRo())
                .contains("Lipsește statusul DNSH");
        JsonNode requirements = call(run, "check_fund_requirements",
                "{\"fundId\": \"F1\", \"optionId\": \"B\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        assertThat(requirements.path("requirements"))
                .extracting(r -> r.path("requirementId").asText() + "/" + r.path("status").asText())
                .containsExactly("SME_STATUS/MET", "ELIGIBLE_CATEGORY/MET", "TECHNICAL_THRESHOLD/MET", "DNSH/TO_CONFIRM",
                        "IMPACT_QUANTIFIED/MET", "CLIENT_BENEFIT/MET", "PERIODIC_REPORTING/MET");
        assertThat(requirements.path("allMet").asBoolean()).isFalse();

        JsonNode bond = call(run, "get_bond_category", "{}");
        assertThat(bond.path("proposed").asText()).isEqualTo("AGRICULTURE_FORESTRY");
    }

    @Test
    void machineryDossierReproducesTheFixture() {
        String run = newRun("38264019", "utilaje", List.of("cl_1001", "cl_1002", "cl_1003", "cl_1004"),
                "{\"nitrogen_kg_ha\": 150, \"manager_competences\": false, \"old_equipment_fate\": \"CASARE\","
                        + " \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"]}",
                Map.of("doc_oferta_tractoare", "OFFER", "doc_facturi_motorina", "FUEL_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_tractoare\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_motorina\"}");
        call(run, "get_module_rules", "{}");
        assertValue(run, "rules.price.fuel_net", "1.17");
        call(run, "compute_baseline", "{\"currentFleet\": {\"totalCount\": 4, \"replacedCount\": 4,"
                + " \"averageAgeYears\": 22}}");
        assertValue(run, "baseline.fuel", "36000");
        assertValue(run, "baseline.nitrogen", "60000");
        // 36,000 l × 2.68 kg/l / 1,000 = 96.48 t
        assertValue(run, "baseline.co2", "96.48");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_tractoare\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("sizing").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.total_cost", "440000");
        // The fixture uses a flat 12%; the engine derives 1 − 246/280 g/kWh = 12.14% from the tractors' age.
        assertValue(run, "cfg_initial.fuel_saving_pct", "12.14");
        assertValue(run, "cfg_initial.hp_per_ha", "2.1");

        call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_recommended\","
                + " \"add\": [\"utl.precision.rtk_sc_vra\"]}");
        assertValue(run, "cfg_recommended.total_cost", "492000");
        assertValue(run, "cfg_recommended.fuel_saving_pct", "20.93");
        assertValue(run, "cfg_recommended.fuel_saved", "7534.29");
        assertValue(run, "cfg_recommended.nitrogen_saved", "3000");
        assertValue(run, "cfg_recommended.inputs_saved", "3000");
        assertValue(run, "cfg_recommended.precision_share", "10.57");
        // 7,534.29 l × 2.68 kg/l / 1,000 = 20.1919 t
        assertValue(run, "cfg_recommended.co2_avoided", "20.19");

        JsonNode eligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(programs(eligibility)).containsEntry("DR_12", "ELIGIBLE/OPEN")
                .containsEntry("FGCR", "ELIGIBLE/PERMANENT")
                .containsEntry("RABLA_AGRI", "ELIGIBLE/NO_BUDGET");
        assertValue(run, "dr_12.intensity", "65");
        assertValue(run, "dr_12.precision_points", "15");

        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.machinery\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"DR_12\","
                + " \"rbro.agri.cofinancing_fgcr\", \"rbro.agri.bridge_afir\"]}]}");
        assertValue(run, "option_b.grant.amount", "200000");
        assertValue(run, "option_b.loan.amount", "292000");
        assertValue(run, "option_b.guarantee.amount", "233600");

        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "option_a.installment", "6748.84");
        assertValue(run, "option_b.installment", "4265.70");
        assertValue(run, "option_b.bridge.interest", "14000");
        assertValue(run, "option_b.total_interest", "80318.62");
        assertValue(run, "option_a.net_cost", "531097.62");
        assertValue(run, "option_b.net_cost", "289607.55");

        call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertValue(run, "compare.net_advantage", "241490.06");
        assertValue(run, "compare.driver.grant", "200000");
        assertValue(run, "compare.driver.interest", "46584.06");
        // Without the grant, the 52.000 EUR precision package pays back from fuel and inputs alone in ~93 months.
        assertValue(run, "compare.upgrade_payback", "93.12");

        call(run, "check_affordability", "{\"optionIds\": [\"A\", \"B\"]}");
        assertValue(run, "option_a.affordability_ratio", "38.56");
        assertValue(run, "option_b.affordability_ratio", "24.38");

        call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // Savings A = 84 × 6,748.84 paid − 531,097.62 net cost = 35,804.94 over 7 years = 5,114.99 a year:
        // (210,000 + 5,114.99) / (12 × 6,748.84) = 215,114.99 / 80,986.08 = 2.6562
        assertValue(run, "option_a.dscr", "2.6562");
        // Savings B = 492,000 − 200,000 grant + 80,318.62 interest − 289,607.55 = 82,711.07 over 7 years; the bridge
        // is repaid from the grant: (210,000 + 11,815.87) / (12 × 4,265.70) = 221,815.87 / 51,188.40 = 4.3333
        assertValue(run, "option_b.dscr", "4.3333");

        JsonNode tier = call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        // New tractors alone 12.14% (< 20%); with precision 20.93%: above 20% but below 20% × 1.5 = 30%.
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        assertValue(run, "green_tier.verde_plus_min", "30");

        call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        assertValue(run, "label.green_amount", "52000");
        assertValue(run, "label.transition_amount", "440000");
        assertValue(run, "impact.fuel_horizon", "52740");
        // 52,740.03 l over 7 years × 2.68 kg/l / 1,000 = 141.3433 t
        assertValue(run, "impact.co2_horizon", "141.34");

        // B uses the DR-12 grant and the AFIR co-financing line: F6, an alternative for machinery with no own
        // green requirements in config/funds.json; F1 stays available.
        JsonNode fund = call(run, "select_fund", "{\"optionId\": \"B\"}");
        assertThat(fund.path("fundId").asText()).isEqualTo("F6");
        assertThat(fund.path("role").asText()).isEqualTo("ALTERNATIVE");
        assertThat(fund.path("alternatives")).extracting(a -> a.path("fundId").asText() + "/" + a.path("status").asText())
                .containsExactly("F1/AVAILABLE");
        JsonNode requirements = call(run, "check_fund_requirements",
                "{\"fundId\": \"F6\", \"optionId\": \"B\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        assertThat(requirements.path("requirements")).isEmpty();

        JsonNode bond = call(run, "get_bond_category", "{}");
        assertThat(bond.path("categories")).extracting(c -> c.path("categoryId").asText())
                .containsExactly("AGRICULTURE_FORESTRY", "ENERGY_EFFICIENCY");
    }

    @Test
    void bondCategoriesOfTheConfigAreTheReportSchemaCategories() throws Exception {
        JsonNode schema = mapper.readTree(Path.of("../contracts/schemas/submit_underwriting_report.json").toFile());
        List<String> inSchema = new ArrayList<>();
        schema.path("properties").path("greenBond").path("properties").path("category").path("enum")
                .forEach(category -> inSchema.add(category.asText()));
        List<String> inConfig = new ArrayList<>();
        reference.funds().path("bondCategories").forEach(category -> inConfig.add(category.path("categoryId").asText()));
        inConfig.add("NONE");

        assertThat(inSchema).containsExactlyInAnyOrderElementsOf(inConfig);
    }

    @Test
    void secondHandTractorsGetNoGrantAndNewOnesAreProposed() {
        String questionnaire = "{\"nitrogen_kg_ha\": 150, \"manager_competences\": false, \"current_tractors\": 5,"
                + " \"replaced_tractors\": 5, \"replaced_fleet_age\": \"PESTE_15_ANI\", \"loan_term\": \"ANI_7\","
                + " \"old_equipment_fate\": \"VANZARE\", \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"]}";
        String run = newRun("38264019", "utilaje", List.of("cl_1001", "cl_1002", "cl_1003", "cl_1004"), questionnaire,
                Map.of("doc_sh_oferta", "OFFER", "doc_facturi_motorina", "FUEL_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_sh_oferta\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_motorina\"}");
        JsonNode baseline = call(run, "compute_baseline", "{}");
        assertThat(baseline.path("fleetChange").asText()).isEqualTo("FULL_REPLACEMENT");
        assertValue(run, "baseline.replaced_age", "20");

        // 2021 tractors (252 g/kWh) replacing ones older than 15 years (280 g/kWh): 10%, below the 20% threshold.
        JsonNode offered = call(run, "compute_indicator", "{\"documentId\": \"doc_sh_oferta\"}");
        assertThat(offered.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertValue(run, "cfg_initial.tractor_saving_pct", "10");
        assertValue(run, "cfg_initial.hp_per_ha", "2.31");

        JsonNode dnsh = call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(dnsh.path("usedEquipment").get(0).path("ageYears").asInt()).isEqualTo(5);

        JsonNode secondHand = call(run, "check_program_eligibility", "{\"configId\": \"cfg_initial\"}");
        assertThat(programs(secondHand)).containsEntry("DR_12", "NOT_ELIGIBLE/OPEN");
        assertThat(secondHand.path("programs").get(0).path("reasonsRo").toString()).contains("doar utilaje noi");

        // Precision alone is not enough on used tractors (19%); new tractors + precision pass (20.93%).
        call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertValue(run, "cand.precision.pct", "19");
        assertValue(run, "cand.tractor.pct", "12.14");
        assertValue(run, "cand.precision_tractor.pct", "20.93");
        JsonNode upgraded = call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_new\", \"add\": [\"utl.tractor.new_stage_v\", \"utl.precision.rtk_sc_vra\"]}");
        assertThat(upgraded.path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_new.total_cost", "550625");
        assertValue(run, "cfg_new.upgrade_cost", "210625");

        JsonNode newTractors = call(run, "check_program_eligibility", "{\"configId\": \"cfg_new\"}");
        assertThat(programs(newTractors)).containsEntry("DR_12", "ELIGIBLE/OPEN");

        JsonNode usedLabels = call(run, "get_labeling_rules", "{\"configId\": \"cfg_initial\"}");
        assertThat(usedLabels.path("rules").get(0).path("label").asText()).isEqualTo("NONE");
        JsonNode newLabels = call(run, "get_labeling_rules", "{\"configId\": \"cfg_new\"}");
        assertThat(newLabels.path("rules")).anySatisfy(r -> assertThat(r.path("label").asText()).isEqualTo("TRANSITION"));

        call(run, "list_financing_lines", "{}");
        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.machinery\"]},"
                + "{\"optionId\": \"C\", \"configId\": \"cfg_new\", \"products\": [\"DR_12\","
                + " \"rbro.agri.cofinancing_fgcr\", \"rbro.agri.bridge_afir\"]}]}");
        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "line.horizon", "7");
        assertValue(run, "option_a.installment", "5215.01");
        call(run, "build_scenario", "{\"optionId\": \"C\", \"scheduleType\": \"SEASONAL\"}");
        JsonNode comparison = call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"C\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("C");
    }

    @Test
    void secondHandTooOldForTheLoanTermIsRefused() {
        String run = newRun("38264019", "utilaje", List.of(), "{\"current_tractors\": 5, \"replaced_tractors\": 5,"
                        + " \"replaced_fleet_age\": \"PESTE_15_ANI\", \"loan_term\": \"ANI_7\"}",
                Map.of("doc_sh_vechi", "OFFER"));
        call(run, "extract_document", "{\"documentId\": \"doc_sh_vechi\"}");
        call(run, "compute_baseline", "{}");
        call(run, "compute_indicator", "{\"documentId\": \"doc_sh_vechi\"}");
        call(run, "build_funding_stack", "{\"options\": [{\"optionId\": \"A\", \"configId\": \"cfg_initial\","
                + " \"products\": [\"rbro.invest.machinery\"]}]}");

        ToolOutput output = tools.execute(run, "build_scenario",
                mapper.createObjectNode().put("optionId", "A").put("scheduleType", "EQUAL_MONTHLY"));

        // Built in 2018: 8 years old today, 15 at the last installment of a 7-year loan (limit 12).
        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("second-hand").contains("cel mult 4 ani");
    }

    @Test
    void inputMistakesComeBackAsToolErrors() {
        String run = newRun("38264019", "utilaje", List.of(), "{}", Map.of());

        ToolOutput output = tools.execute(run, "simulate_upgrade_package",
                mapper.createObjectNode().put("baseConfigId", "cfg_missing").put("configId", "cfg_x"));

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("cfg_missing");
    }

    private String newRun(String cui, String moduleId, List<String> parcels, String questionnaire,
                          Map<String, String> docs) {
        List<StoredDocument> stored = new ArrayList<>();
        new LinkedHashMap<>(docs).forEach((id, type) -> stored.add(documents.save(id, type, id + ".pdf",
                "application/pdf", new byte[]{1})));
        try {
            RunRequest request = new RunRequest(cui, moduleId, parcels, mapper.readTree(questionnaire), stored, null);
            Run run = Run.create(request, List.of(), farms.get(cui)).withStatus(RunStatus.DATE_FIRMA);
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

    static JsonNode fixtureExtraction(ObjectMapper mapper, String documentId) throws IOException {
        for (String fixture : List.of("irigatii", "utilaje")) {
            for (String line : Files.readAllLines(Path.of("../contracts/fixtures/" + fixture + ".ndjson"))) {
                JsonNode event = mapper.readTree(line);
                JsonNode extraction = event.path("data").path("result").path("extraction");
                if ("extract_document".equals(event.path("data").path("tool").asText())
                        && documentId.equals(extraction.path("documentId").asText())) {
                    return extraction;
                }
            }
        }
        throw new IllegalArgumentException("No fixture extraction for " + documentId);
    }
}
