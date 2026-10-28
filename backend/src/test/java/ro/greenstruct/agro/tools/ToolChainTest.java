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
                "{\"irrigation_current\": \"BRAZDE\", \"water_source\": \"PUT\", \"pumping_head_m\": 35,"
                        + " \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"], \"old_equipment_fate\": \"NU_E_CAZUL\"}",
                Map.of("doc_oferta_aspersie", "OFFER", "doc_aviz_anar", "WATER_PERMIT_ANAR",
                        "doc_facturi_energie", "ENERGY_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_aspersie\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_aviz_anar\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie\"}");
        call(run, "get_module_rules", "{}");
        JsonNode baseline = call(run, "compute_baseline", "{}");
        assertThat(baseline.path("climateZone").asText()).isEqualTo("SUD_EST");
        // (Kc × 700 mm − 200 mm) × 10 × 8 ha per parcel: tomatoes 0.85 → 31,600; peppers and cucumbers 0.80 → 28,800
        // each; cabbage and onions 0.75 → 26,000 each: 141,200 m³ in total
        assertValue(run, "baseline.net_need", "141200");
        // furrows: 141,200 / 0.60 = 235,333.33 m³
        assertValue(run, "baseline.water", "235333.33");
        // 235,333.33 m³ × (35 m lift + 0) × 0.002725 / 0.65 = 34,530.64 kWh; the invoices (36,900 kWh) are within 20%
        assertValue(run, "baseline.energy", "34530.64");
        assertValue(run, "baseline.energy_invoiced", "36900");
        assertThat(baseline.path("warnings").toString()).doesNotContain("20%");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_aspersie\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertValue(run, "cfg_initial.total_cost", "85000");
        // sprinkler: 141,200 / 0.75 = 188,266.67 m³, 1 − 0.60 / 0.75 = 20%
        assertValue(run, "cfg_initial.water_saving_pct", "20");
        // at 3.5 bar: 188,266.67 × (35 + 35) × 0.002725 / 0.65 = 55,249.03 kWh, 20,718.38 kWh more than furrows
        assertValue(run, "cfg_initial.energy_saved", "-20718.38");
        // −20,718.38 kWh × 0.26 kg/kWh / 1000 = −5.39 t
        assertValue(run, "cfg_initial.co2_avoided", "-5.3868");

        JsonNode search = call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).allSatisfy(c -> assertThat(c.path("thresholdResult").asText()).isEqualTo("PASS"));
        // sprinkler + sensors 1 − 0.9 × 0.60 / 0.75 = 28%; drip 1 − 0.60 / 0.90 = 33.33%; drip + sensors 40%
        assertValue(run, "cand.sensors.pct", "28");
        assertValue(run, "cand.sensors.cost", "92700");
        assertValue(run, "cand.drip.pct", "33.33");
        assertValue(run, "cand.drip_sensors.pct", "40");
        assertValue(run, "cand.drip_sensors.cost", "113000");

        // drip replaces the sprinklers, pipes and works: pump 14,500 + drip 90,800 + meter 1,200 = 106,500 EUR
        call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_min_pass\","
                + " \"add\": [\"irg.drip.surface_veg\", \"irg.meter.electromagnetic\"]}");
        assertValue(run, "cfg_min_pass.total_cost", "106500");
        assertValue(run, "cfg_min_pass.water_saving_pct", "33.33");
        JsonNode recommended = call(run, "simulate_upgrade_package",
                "{\"baseConfigId\": \"cfg_min_pass\", \"configId\": \"cfg_recommended\", \"add\": [\"irg.sensors.soil_moisture\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_recommended.total_cost", "113000");
        assertValue(run, "cfg_recommended.upgrade_cost", "28000");
        assertValue(run, "cfg_recommended.water_saving_pct", "40");
        // 141,200 m³ × (35 + 15) × 0.002725 / 0.65 = 29,597.69 kWh: 4,932.95 kWh less than today, × 0.26 / 1000 = 1.28 t
        assertValue(run, "cfg_recommended.pumping_energy", "29597.69");
        assertValue(run, "cfg_recommended.energy_saved", "4932.95");
        assertValue(run, "cfg_recommended.co2_avoided", "1.2826");

        JsonNode dnsh = call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("nitrateVulnerableParcels")).isEmpty();
        assertThat(dnsh.path("waterMeterInConfig").asBoolean()).isTrue();

        call(run, "list_financing_lines", "{}");
        JsonNode eligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(programs(eligibility)).containsEntry("DR_12", "NOT_ELIGIBLE/OPEN")
                .containsEntry("DR_26", "ELIGIBLE/NOT_OPEN")
                // FM_PV funds solar pumps or panels, which the recommended configuration does not have
                .containsEntry("FM_PV", "NOT_ELIGIBLE/CLOSED")
                .containsEntry("INVESTEU_FEI", "ELIGIBLE/PERMANENT");

        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        // 113,000 × 70%
        assertValue(run, "option_b.guarantee.amount", "79100");
        assertThat(tools.execute(run, "build_scenario", mapper.createObjectNode().put("optionId", "A")
                .put("scheduleType", "EQUAL_MONTHLY")).messageRo()).contains("price_loan");

        assertThat(tools.execute(run, "determine_green_tier", mapper.createObjectNode()
                .put("requestedConfigId", "cfg_initial").put("financedConfigId", "cfg_recommended")).messageRo())
                .contains("Lipsește statusul DNSH");
        JsonNode tier = call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS\"}");
        // 40% ≥ 25% × 1.5 = 37.5% and DNSH passed on every objective: Verde Plus, even though the offer (20%) needed the upgrade
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_PLUS");
        assertThat(tier.path("upgradeNeeded").asBoolean()).isTrue();
        assertValue(run, "green_tier.verde_plus_min", "37.5");

        call(run, "price_loan", "{\"optionIds\": [\"A\", \"B\"]}");
        // classic: 2.0 + 1.2 + 3% × 45% + 75% × 12% × 12% + 1.5 + 1.77 = 2.0 + 1.2 + 1.35 + 1.08 + 1.5 + 1.77 = 8.90%
        assertValue(run, "option_a.rate.risk_cost", "1.35");
        assertValue(run, "option_a.rate.capital_cost", "1.08");
        assertValue(run, "option_a.rate", "8.9");
        // green, g = 70%, Verde Plus (+0): 2.0 + 0.9 + 2.5% × 45% × 30% + 22.5% × 12% × 12% + 1.35 + 1.77 − 0.40
        // = 2.0 + 0.9 + 0.3375 + 0.324 + 1.35 + 1.77 − 0.40 = 6.2815%
        assertValue(run, "option_b.rate.risk_cost", "0.3375");
        assertValue(run, "option_b.rate.capital_cost", "0.324");
        assertValue(run, "option_b.rate.tier_adjustment", "0");
        assertValue(run, "option_b.rate", "6.2815");
        // −0.30 funding, −1.0125 risk, −0.756 capital, −0.15 operational, −0.40 subsidy = −2.6185 pp
        assertValue(run, "pricing.diff.risk_cost", "-1.0125");
        assertValue(run, "pricing.diff.capital_cost", "-0.756");
        assertValue(run, "pricing.diff.rate", "-2.6185");

        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        // PMT(85,000; 8.9% / 12; 60) = 1,760.34
        assertValue(run, "option_a.installment", "1760.34");
        // 1,450 + 380 × 5
        assertValue(run, "option_a.collateral_costs", "3350");
        // a year: 47,066.67 m³ × 0.02 = 941.33 EUR of water, −20,718.38 kWh × 0.20 = −4,143.68 EUR of energy; × 5
        assertValue(run, "option_a.savings_horizon", "-16011.72");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"SEASONAL\"}");
        // 20 payments in July–October 2027–2031 with the present value of 113,000 at 6.2815%; none in Feb–Jun 2027
        assertValue(run, "option_b.installment", "6633.79");
        assertValue(run, "option_b.grace", "5");
        assertValue(run, "option_b.total_interest", "19675.76");
        // (94,133.33 m³ × 0.02 + 4,932.95 kWh × 0.20) × 5 = (1,882.67 + 986.59) × 5
        assertValue(run, "option_b.savings_horizon", "14346.28");

        JsonNode comparison = call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("B");
        // (85,000 + 20,620.26 + 3,350 + 16,011.72) − (113,000 + 19,675.76 − 14,346.28) = 124,981.98 − 118,329.48
        assertValue(run, "compare.net_advantage", "6652.5");
        // 28,000 / ((2,869.26 + 3,202.34) / 12)
        assertValue(run, "compare.upgrade_payback", "55.34");

        JsonNode affordability = call(run, "check_affordability", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(affordability.path("A").path("result").asText()).isEqualTo("PASS_WITH_WARNING");
        assertThat(affordability.path("B").path("result").asText()).isEqualTo("PASS");
        assertValue(run, "option_a.affordability_ratio", "21.47");
        assertValue(run, "option_b.affordability_ratio", "26.97");

        call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // (98,400 − 3,202.34) / (12 × 1,760.34) = 95,197.66 / 21,124.08 = 4.5066
        assertValue(run, "option_a.dscr", "4.5066");
        // (98,400 + 2,869.26) / (4 × 6,633.79) = 101,269.26 / 26,535.16 = 3.8164
        assertValue(run, "option_b.dscr", "3.8164");

        JsonNode labels = call(run, "get_labeling_rules", "{\"configId\": \"cfg_recommended\"}");
        assertThat(labels.path("rules")).anySatisfy(rule -> {
            assertThat(rule.path("category").asText()).isEqualTo("IRRIGATION_DRIP");
            assertThat(rule.path("label").asText()).isEqualTo("MARKET_GREEN");
        });
        call(run, "get_dnsh_criteria", "{}");
        call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        // drip, sensors and meter are green, the offer's pump is not: 98,500 / 113,000
        assertValue(run, "label.green_share", "87.17");
        // 94,133.33 m³ × 5 years; 1.2826 t × 5 years
        assertValue(run, "impact.water_horizon", "470666.67");
        assertValue(run, "impact.co2_horizon", "6.4129");

        // B is secured by the FEI InvestEU guarantee: F1, the primary fund for irrigation (config/funds.json).
        JsonNode fund = call(run, "select_fund", "{\"optionId\": \"B\"}");
        assertThat(fund.path("fundId").asText()).isEqualTo("F1");
        assertThat(fund.path("role").asText()).isEqualTo("PRIMARY");
        // F6 has programmes checked above, none both eligible and open (DR_12 not eligible, DR_16/DR_26 not open).
        assertThat(fund.path("alternatives")).extracting(a -> a.path("fundId").asText() + "/" + a.path("status").asText())
                .containsExactly("F4/TO_CONFIRM", "F6/NOT_AVAILABLE");
        assertValue(run, "fund.coverage", "70");
        assertThat(tools.execute(run, "select_fund", mapper.createObjectNode().put("optionId", "A")).ok()).isFalse();

        JsonNode requirements = call(run, "check_fund_requirements",
                "{\"fundId\": \"F1\", \"optionId\": \"B\", \"dnshStatus\": \"PASS\"}");
        assertThat(requirements.path("requirements"))
                .extracting(r -> r.path("requirementId").asText() + "/" + r.path("status").asText())
                .containsExactly("SME_STATUS/MET", "ELIGIBLE_CATEGORY/MET", "TECHNICAL_THRESHOLD/MET", "DNSH/MET",
                        "IMPACT_QUANTIFIED/MET", "CLIENT_BENEFIT/MET", "PERIODIC_REPORTING/MET");
        assertThat(requirements.path("allMet").asBoolean()).isTrue();

        JsonNode bond = call(run, "get_bond_category", "{}");
        assertThat(bond.path("proposed").asText()).isEqualTo("AGRICULTURE_FORESTRY");
    }

    @Test
    void machineryDossierReproducesTheFixture() {
        String run = newRun("38264019", "utilaje", List.of("cl_1001", "cl_1002", "cl_1003", "cl_1004"),
                "{\"nitrogen_kg_ha\": 150, \"manager_competences\": false, \"old_equipment_fate\": \"CASARE\","
                        + " \"cashin_months\": [\"JUL\", \"AUG\", \"SEP\", \"OCT\"], \"loan_term\": \"ANI_7\"}",
                Map.of("doc_oferta_tractoare", "OFFER", "doc_facturi_motorina", "FUEL_INVOICES"));

        call(run, "extract_document", "{\"documentId\": \"doc_oferta_tractoare\"}");
        call(run, "extract_document", "{\"documentId\": \"doc_facturi_motorina\"}");
        call(run, "get_module_rules", "{}");
        assertValue(run, "rules.price.fuel_net", "1.17");
        call(run, "compute_baseline", "{\"currentFleet\": {\"totalCount\": 4, \"replacedCount\": 4,"
                + " \"averageAgeYears\": 22}}");
        // 36,180 l invoiced / 400 ha = 90.45 l/ha
        assertValue(run, "baseline.fuel_per_ha", "90.45");
        assertValue(run, "baseline.fuel", "36180");
        assertValue(run, "baseline.nitrogen", "60000");
        // 36,180 l × 2.68 kg/l / 1,000 = 96.96 t
        assertValue(run, "baseline.co2", "96.9624");

        JsonNode initial = call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_tractoare\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("sizing").asText()).isEqualTo("PASS");
        assertValue(run, "cfg_initial.total_cost", "440000");
        // new Stage V tractors (246 g/kWh) replacing 22-year-old ones (280 g/kWh): 1 − 246 / 280 = 12.14%
        assertValue(run, "cfg_initial.fuel_saving_pct", "12.1429");
        assertValue(run, "cfg_initial.hp_per_ha", "2.1");

        call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_recommended\","
                + " \"add\": [\"utl.precision.rtk_sc_vra\"]}");
        assertValue(run, "cfg_recommended.total_cost", "492000");
        // 1 − (1 − 0.121429) × (1 − 0.10) = 20.93%; 36,180 l × 0.209286 = 7,571.96 l
        assertValue(run, "cfg_recommended.fuel_saving_pct", "20.9286");
        assertValue(run, "cfg_recommended.fuel_saved", "7571.96");
        // variable rate: 400 ha × 150 kg N/ha × 5% = 3,000 kg; × 1.10 EUR/kg = 3,300 EUR a year
        assertValue(run, "cfg_recommended.nitrogen_saved", "3000");
        assertValue(run, "cfg_recommended.nitrogen_cost_saved", "3300");
        assertValue(run, "cfg_recommended.precision_share", "10.57");
        // (7,571.96 l × 2.68 + 3,000 kg N × 4.29) / 1,000 = 20.2929 + 12.87 = 33.1629 t CO₂e
        assertValue(run, "cfg_recommended.co2_avoided", "33.1629");

        JsonNode eligibility = call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(programs(eligibility)).containsEntry("DR_12", "ELIGIBLE/OPEN")
                .containsEntry("FGCR", "ELIGIBLE/PERMANENT")
                .containsEntry("RABLA_AGRI", "ELIGIBLE/NO_BUDGET");
        assertValue(run, "dr_12.intensity", "65");
        assertValue(run, "dr_12.precision_points", "15");

        // The green offer is the green credit with the FEI guarantee; the DR-12 grant stays an alternative.
        call(run, "list_financing_lines", "{}");
        call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        // 492,000 × 70%
        assertValue(run, "option_b.guarantee.amount", "344400");

        JsonNode tier = call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        // New tractors alone 12.14% (< 20%); with precision 20.93%: above 20% but below 20% × 1.5 = 30%.
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        assertValue(run, "green_tier.verde_plus_min", "30");

        call(run, "price_loan", "{\"optionIds\": [\"A\", \"B\"]}");
        assertValue(run, "option_a.rate", "8.9");
        // 6.2815% + 0.20 pp for "Verde cu upgrade" = 6.4815%
        assertValue(run, "option_b.rate.tier_adjustment", "0.2");
        assertValue(run, "option_b.rate", "6.4815");
        assertValue(run, "pricing.diff.rate", "-2.4185");

        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"SEASONAL\"}");
        assertValue(run, "line.horizon", "7");
        // PMT(440,000; 8.9% / 12; 84) = 7,056.88; mortgage 1,450 + 380 × 7 = 4,110
        assertValue(run, "option_a.installment", "7056.88");
        assertValue(run, "option_a.collateral_costs", "4110");
        // 28 payments in July–October 2027–2033 with the present value of 492,000 at 6.4815%
        assertValue(run, "option_b.installment", "22026.27");
        assertValue(run, "option_b.grace", "5");
        assertValue(run, "option_b.total_interest", "124735.6");
        // 440,000 + 152,778.32 interest + 4,110 − 5,140.58 × 7 fuel = 560,904.24
        assertValue(run, "option_a.net_cost", "560904.24");
        // 492,000 + 124,735.60 − (8,859.95 fuel + 3,300 nitrogen) × 7 = 531,615.97
        assertValue(run, "option_b.net_cost", "531615.97");

        call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertValue(run, "compare.net_advantage", "29288.27");
        assertValue(run, "compare.driver.interest", "28042.73");
        // the 52,000 EUR precision package pays back from the extra fuel and nitrogen savings in 88.9 months
        assertValue(run, "compare.upgrade_payback", "88.9");

        JsonNode affordability = call(run, "check_affordability", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(affordability.path("A").path("result").asText()).isEqualTo("PASS_WITH_WARNING");
        assertThat(affordability.path("B").path("result").asText()).isEqualTo("PASS");
        // 12 × 7,056.88 / 240,000 and 4 × 22,026.27 / 240,000: both under the 40% limit
        assertValue(run, "option_a.affordability_ratio", "35.28");
        assertValue(run, "option_b.affordability_ratio", "36.71");

        call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        // (240,000 + 5,140.58) / (12 × 7,056.88) = 245,140.58 / 84,682.56 = 2.8948
        assertValue(run, "option_a.dscr", "2.8948");
        // (240,000 + 12,159.95) / (4 × 22,026.27) = 252,159.95 / 88,105.08 = 2.8620
        assertValue(run, "option_b.dscr", "2.8620");

        call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        assertValue(run, "label.green_amount", "52000");
        assertValue(run, "label.transition_amount", "440000");
        // 7,571.96 l and 33.1629 t × 7 years
        assertValue(run, "impact.fuel_horizon", "53003.7");
        assertValue(run, "impact.co2_horizon", "232.14");

        // F1 backs the green credit; F6 (the DR-12 grant, eligible and open) is available as the alternative.
        JsonNode fund = call(run, "select_fund", "{\"optionId\": \"B\"}");
        assertThat(fund.path("fundId").asText()).isEqualTo("F1");
        assertThat(fund.path("role").asText()).isEqualTo("PRIMARY");
        assertThat(fund.path("alternatives")).extracting(a -> a.path("fundId").asText() + "/" + a.path("status").asText())
                .containsExactly("F6/AVAILABLE");
        JsonNode requirements = call(run, "check_fund_requirements",
                "{\"fundId\": \"F1\", \"optionId\": \"B\", \"dnshStatus\": \"PASS_WITH_CONDITIONS\"}");
        assertThat(requirements.path("requirements"))
                .extracting(r -> r.path("requirementId").asText() + "/" + r.path("status").asText())
                .contains("DNSH/TO_CONFIRM", "CLIENT_BENEFIT/MET", "TECHNICAL_THRESHOLD/MET");

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
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"C\", \"configId\": \"cfg_new\", \"products\": [\"DR_12\","
                + " \"rbro.agri.cofinancing_fgcr\", \"rbro.agri.bridge_afir\"]}]}");
        // C's co-financing loan is priced as a classic loan whose FGCR guarantee (80%) lowers risk and capital:
        // 2.0 + 1.2 + 3% × 45% × 20% + 15% × 12% × 12% + 1.5 + 1.77 = 2.0 + 1.2 + 0.27 + 0.216 + 1.5 + 1.77 = 6.956%
        call(run, "price_loan", "{\"optionIds\": [\"A\", \"C\"]}");
        assertValue(run, "option_c.rate", "6.956");
        call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        assertValue(run, "line.horizon", "7");
        // PMT(340,000; 8.9% / 12; 84) = 5,453.05
        assertValue(run, "option_a.installment", "5453.05");
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
                + " \"products\": [\"rbro.invest.standard\"]}]}");

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
