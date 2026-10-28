package ro.greenstruct.agro.tools;

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

import ro.greenstruct.agro.farm.FarmProfileService;
import ro.greenstruct.agro.orchestration.RunStore;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.tools.technical.DocumentExtractor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The livestock dossier of the demo dairy farm (DEMO-0004 of the Product team: 150 cows, 22 kg CH4/head/year,
 * digester −45%, with a covered digestate tank −85%) through the tools in agent order. Every expected figure was
 * worked out by hand from the documents and config/modules/zootehnie.json.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class LivestockToolChainTest {

    private static final String QUESTIONNAIRE = """
            {"livestock_confirmed": true, "manure_storage": "MIXT_DESCOPERIT", "digestate_use": "%s",
             "fertilisation_plan": true, "old_equipment_fate": "NU_E_CAZUL", "cashin_months": ["JUN", "JUL", "AUG", "SEP"],
             "loan_term": "ANI_7"}
            """;

    private static String field(String key, String raw, String unit) {
        return "{\"key\": \"" + key + "\", \"rawValue\": \"" + raw + "\", \"unit\": \"" + unit
                + "\", \"page\": 1, \"confidence\": \"HIGH\"}";
    }

    private static String line(String id, String category, String description, String price, String... extra) {
        String fields = field("QUANTITY", "1 buc.", "PCS") + ", " + field("LINE_PRICE_NET", price, "EUR");
        for (String e : extra) {
            fields += ", " + e;
        }
        return "{\"lineId\": \"" + id + "\", \"category\": \"" + category + "\", \"descriptionRo\": \"" + description
                + "\", \"fields\": [" + fields + "]}";
    }

    private static String extraction(String id, String type, String documentFields, String lines) {
        return "{\"documentId\": \"" + id + "\", \"documentType\": \"" + type + "\", \"moduleId\": \"zootehnie\","
                + " \"currency\": \"EUR\", \"documentFields\": [" + documentFields + "], \"lineItems\": [" + lines
                + "], \"missingFields\": [], \"warnings\": []}";
    }

    /** The offer of the BioEnergie digester: 270.000 EUR, 45% methane reduction, ≈225.000 kWh per year. */
    private static final String OFFER = extraction("doc_oferta_digestor", "OFFER",
            field("TOTAL_NET", "270.000 EUR", "EUR") + ", " + field("METHANE_REDUCTION_PCT", "45%", "PCT") + ", "
                    + field("ENERGY_KWH", "≈ 225.000 kWh / an", "KWH"),
            line("ln_1", "DIGESTER", "Digestor anaerob din beton, cu agitatoare", "142.000 EUR") + ", "
                    + line("ln_2", "COGENERATION", "Unitate de cogenerare 30 kWe / 45 kWt", "78.000 EUR",
                    field("ENGINE_POWER_KW", "30 kW", "KW")) + ", "
                    + line("ln_3", "INSTALLATION_WORKS", "Pompe, conducte, automatizare, racordare", "50.000 EUR"));

    private static final String PERMIT = extraction("doc_autorizatie_mediu", "ENVIRONMENTAL_PERMIT",
            field("PERMIT_NUMBER", "AM-DEMO-42/2024", "TEXT") + ", " + field("DOCUMENT_DATE", "17.06.2024", "DATE"), "");

    /** Twelve invoices of 9.300–11.000 kWh: 120.000 kWh in total. */
    private static final String INVOICES = extraction("doc_facturi_energie_ferma", "ENERGY_INVOICES",
            field("ENERGY_KWH", "120.000 kWh", "KWH"), "");

    /** A digester without cogeneration (60% reduction, no electricity), for the "manure must be valorised" rule. */
    private static final String DIGESTER_ONLY = extraction("doc_oferta_biogaz_fara_energie", "OFFER",
            field("TOTAL_NET", "100.000 EUR", "EUR") + ", " + field("METHANE_REDUCTION_PCT", "60%", "PCT"),
            line("ln_1", "DIGESTER", "Digestor anaerob fără cogenerare", "100.000 EUR"));

    private static final Map<String, String> EXTRACTIONS = Map.of("doc_oferta_digestor", OFFER,
            "doc_autorizatie_mediu", PERMIT, "doc_facturi_energie_ferma", INVOICES,
            "doc_oferta_biogaz_fara_energie", DIGESTER_ONLY);

    @TestConfiguration
    static class LivestockExtractor {

        @Bean
        DocumentExtractor livestockExtractor(ObjectMapper mapper) {
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

    private ChainSupport chain;

    @BeforeEach
    void setUp() {
        chain = new ChainSupport(tools, runs, farms, documents, calcs, mapper);
    }

    @Test
    void dairyFarmStartsBelowTheThresholdAndPassesWithTheCoveredTank() {
        String run = chain.newRun("47209135", "zootehnie", List.of("bn_2001", "bn_2002"),
                QUESTIONNAIRE.formatted("INGRASAMANT"),
                Map.of("doc_oferta_digestor", "OFFER", "doc_autorizatie_mediu", "ENVIRONMENTAL_PERMIT",
                        "doc_facturi_energie_ferma", "ENERGY_INVOICES"));

        chain.call(run, "get_module_rules", "{}");
        chain.assertValue(run, "rules.threshold.methane_reduction", "50");
        chain.assertValue(run, "rules.factor.ch4_per_head", "22");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_digestor\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_autorizatie_mediu\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_ferma\"}");

        // 150 cows × 22 kg CH4 = 3,300 kg; 3,300 × 27 / 1,000 = 89.1 t CO2e
        chain.call(run, "compute_baseline", "{}");
        chain.assertValue(run, "baseline.heads", "150");
        chain.assertValue(run, "baseline.methane", "3300");
        chain.assertValue(run, "baseline.co2", "89.1");
        chain.assertValue(run, "baseline.farm_energy", "120000");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_digestor\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("manureValorised").asBoolean()).isTrue();
        chain.assertValue(run, "cfg_initial.total_cost", "270000");
        chain.assertValue(run, "cfg_initial.methane_reduction_pct", "45");
        // 3,300 × 0.55 = 1,815 left; 1,485 saved; × 27 / 1,000 = 40.095 t
        chain.assertValue(run, "cfg_initial.methane_new", "1815");
        chain.assertValue(run, "cfg_initial.methane_saved", "1485");
        chain.assertValue(run, "cfg_initial.co2_avoided", "40.095");
        // 225,000 kWh: 120,000 on the farm at 0.20 + 105,000 sold at 0.06 = 30,300; 150 × 40 kg N × 1.00 = 6,000
        chain.assertValue(run, "cfg_initial.energy_produced", "225000");
        chain.assertValue(run, "cfg_initial.energy_own", "120000");
        chain.assertValue(run, "cfg_initial.energy_sold", "105000");
        chain.assertValue(run, "cfg_initial.savings_energy", "30300");
        chain.assertValue(run, "cfg_initial.nitrogen_digestate", "6000");
        chain.assertValue(run, "cfg_initial.savings_fertiliser", "6000");

        JsonNode search = chain.call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).hasSize(1).anySatisfy(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_cover");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("PASS");
        });
        chain.assertValue(run, "cand.cover.pct", "85");
        chain.assertValue(run, "cand.cover.cost", "296000");

        JsonNode recommended = chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_recommended\", \"add\": [\"liv.cover.digestate_tank\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        assertThat(recommended.path("meetsSafetyMargin").asBoolean()).isTrue();
        chain.assertValue(run, "cfg_recommended.total_cost", "296000");
        chain.assertValue(run, "cfg_recommended.upgrade_cost", "26000");
        chain.assertValue(run, "cfg_recommended.methane_reduction_pct", "85");
        // 3,300 × 0.15 = 495 left; 2,805 saved; × 27 / 1,000 = 75.735 t
        chain.assertValue(run, "cfg_recommended.methane_new", "495");
        chain.assertValue(run, "cfg_recommended.co2_avoided", "75.735");
        chain.assertValue(run, "cfg_recommended.savings_energy", "30300");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("permitPresent").asBoolean()).isTrue();
        assertThat(dnsh.path("permitValid").asBoolean()).isTrue();
        assertThat(dnsh.path("digestateCoverInConfig").asBoolean()).isTrue();
        assertThat(dnsh.path("manureValorised").asBoolean()).isTrue();
        assertThat(dnsh.path("digestateUse").asText()).isEqualTo("INGRASAMANT");
        assertThat(dnsh.path("nitrateVulnerableParcels")).extracting(JsonNode::asText)
                .containsExactly("bn_2001", "bn_2002");

        JsonNode eligibility = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(ChainSupport.programs(eligibility)).containsEntry("INVESTEU_FEI", "ELIGIBLE/PERMANENT")
                .containsEntry("FGCR", "ELIGIBLE/PERMANENT");
        JsonNode requested = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_initial\"}");
        assertThat(ChainSupport.programs(requested)).containsEntry("INVESTEU_FEI", "NOT_ELIGIBLE/PERMANENT");

        chain.call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        chain.assertValue(run, "option_b.guarantee.amount", "207200");

        // 85% on a 50% threshold is above 50% × 1.5: Verde Plus
        chain.storeTechnicalAssessment(run, "cfg_initial", "cfg_recommended", "PASS");
        JsonNode tier = chain.call(run, "determine_green_tier", "{}");
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_PLUS");
        assertThat(tier.path("upgradeNeeded").asBoolean()).isTrue();
        chain.assertValue(run, "tier.financed_indicator", "85");
        chain.assertValue(run, "tier.verde_plus_min", "75");
        // classic 2 + 1.2 + 1.35 + 1.08 + 1.5 + 1.77 = 8.9; green (70% guaranteed, Verde Plus):
        // 2 + 0.9 + 0.3375 + 0.324 + 1.35 + 1.77 − 0.4 = 6.2815
        chain.call(run, "price_loan", "{}");
        chain.assertValue(run, "pricing.classic.rate", "8.9");
        chain.assertValue(run, "pricing.green.rate", "6.2815");

        // PMT = P·r / (1 − (1 + r)^−84), r = rate / 12
        chain.call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        chain.assertValue(run, "option_a.installment", "4330.36");
        chain.assertValue(run, "option_a.total_interest", "93750.33");
        chain.assertValue(run, "option_a.collateral_costs", "4110");
        chain.assertValue(run, "option_a.savings_horizon", "254100");
        chain.assertValue(run, "option_a.net_cost", "113760.33");
        chain.call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        chain.assertValue(run, "option_b.installment", "4364.19");
        chain.assertValue(run, "option_b.total_interest", "70591.83");
        chain.assertValue(run, "option_b.savings_horizon", "254100");
        chain.assertValue(run, "option_b.net_cost", "112491.83");

        // (48,000 net cash flow + 36,300 savings) / (12 × installment)
        chain.call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        chain.assertValue(run, "option_a.dscr", "1.6223");
        chain.assertValue(run, "option_b.dscr", "1.6097");

        JsonNode comparison = chain.call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        assertThat(comparison.path("better").asText()).isEqualTo("B");
        chain.assertValue(run, "compare.net_advantage", "1268.50");

        chain.call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        // digester 142,000 + cogeneration 78,000 + cover 26,000 = 246,000 of 296,000
        chain.assertValue(run, "label.green_amount", "246000");
        chain.assertValue(run, "label.taxonomy_amount", "78000");
        chain.assertValue(run, "label.green_share", "83.11");
        chain.assertValue(run, "impact.energy_horizon", "1575000");
        // 75.735 t × 7 years
        chain.assertValue(run, "impact.co2_horizon", "530.145");
    }

    @Test
    void manureThatIsNotValorisedDoesNotPassEvenAtSixtyPercent() {
        String run = chain.newRun("47209135", "zootehnie", List.of("bn_2001", "bn_2002"),
                QUESTIONNAIRE.formatted("NEVALORIFICAT"),
                Map.of("doc_oferta_biogaz_fara_energie", "OFFER", "doc_facturi_energie_ferma", "ENERGY_INVOICES"));
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_biogaz_fara_energie\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_ferma\"}");
        chain.call(run, "compute_baseline", "{}");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_biogaz_fara_energie\"}");

        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        assertThat(initial.path("manureValorised").asBoolean()).isFalse();
        chain.assertValue(run, "cfg_initial.methane_reduction_pct", "60");
        // no cogeneration, so no electricity and no nitrogen from a digestate nobody uses
        chain.assertValue(run, "cfg_initial.savings_energy", "0");
        chain.assertValue(run, "cfg_initial.savings_fertiliser", "0");
    }

    @Test
    void sameDigesterPassesWhenTheDigestateIsSpreadOnOwnLand() {
        String run = chain.newRun("47209135", "zootehnie", List.of("bn_2001", "bn_2002"),
                QUESTIONNAIRE.formatted("INGRASAMANT"),
                Map.of("doc_oferta_biogaz_fara_energie", "OFFER", "doc_facturi_energie_ferma", "ENERGY_INVOICES"));
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_biogaz_fara_energie\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_ferma\"}");
        chain.call(run, "compute_baseline", "{}");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_biogaz_fara_energie\"}");

        assertThat(initial.path("thresholdResult").asText()).isEqualTo("PASS");
        assertThat(initial.path("manureValorised").asBoolean()).isTrue();
        // 3,300 × 0.40 = 1,320 left; 1,980 saved; × 27 / 1,000 = 53.46 t
        chain.assertValue(run, "cfg_initial.co2_avoided", "53.46");
        chain.assertValue(run, "cfg_initial.savings_fertiliser", "6000");
    }

    @Test
    void missingStorageAnswerComesBackAsAToolError() {
        String run = chain.newRun("47209135", "zootehnie", List.of(), "{}", Map.of());

        ToolOutput output = chain.callRaw(run, "compute_baseline", "{}");

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("manure_storage");
    }
}
