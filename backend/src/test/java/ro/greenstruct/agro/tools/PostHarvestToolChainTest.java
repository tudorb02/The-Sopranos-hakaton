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
 * The post-harvest dossier of the demo apple cold store (DEMO-0005 of the Product team: 650 t, 85.000 kWh per season,
 * offered unit with R404A at 115 kWh/t, R290 unit with insulation panels at 92 kWh/t) through the tools in agent
 * order. Every expected figure was worked out by hand from the documents and config/modules/post_recolta.json.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class PostHarvestToolChainTest {

    private static final String COLD_STORE = """
            {"activity": "DEPOZIT_FRIGORIFIC", "stored_product": "mere", "quantity": 650, "operating_months": 7,
             "old_equipment_fate": "CASARE", "offtake_contracts": true, "cashin_months": ["OCT", "NOV", "DEC", "SEP"],
             "loan_term": "ANI_5"}
            """;

    private static final String GREENHOUSE = """
            {"activity": "SERA", "stored_product": "tomate", "quantity": 2000, "operating_months": 8,
             "gas_kwh_year": 120000, "old_equipment_fate": "NU_E_CAZUL", "cashin_months": ["JUN", "JUL", "AUG"]}
            """;

    private static String field(String key, String raw, String unit) {
        return "{\"key\": \"" + key + "\", \"rawValue\": \"" + raw + "\", \"unit\": \"" + unit
                + "\", \"page\": 1, \"confidence\": \"HIGH\"}";
    }

    private static String line(String id, String category, String description, String quantity, String price,
                               String... extra) {
        String fields = field("QUANTITY", quantity, "PCS") + ", " + field("LINE_PRICE_NET", price, "EUR");
        for (String e : extra) {
            fields += ", " + e;
        }
        return "{\"lineId\": \"" + id + "\", \"category\": \"" + category + "\", \"descriptionRo\": \"" + description
                + "\", \"fields\": [" + fields + "]}";
    }

    private static String extraction(String id, String type, String documentFields, String lines) {
        return "{\"documentId\": \"" + id + "\", \"documentType\": \"" + type + "\", \"moduleId\": \"post_recolta\","
                + " \"currency\": \"EUR\", \"documentFields\": [" + documentFields + "], \"lineItems\": [" + lines
                + "], \"missingFields\": [], \"warnings\": []}";
    }

    /** The Frig Industrial offer: 118.000 EUR, R404A (GWP 3.922), 115 kWh/t per season. */
    private static final String OFFER = extraction("doc_oferta_agregat", "OFFER",
            field("TOTAL_NET", "118.000 EUR", "EUR") + ", "
                    + field("SPECIFIC_CONSUMPTION_KWH_PER_UNIT", "115 kWh / tonă / sezon", "KWH") + ", "
                    + field("REFRIGERANT_TYPE", "R404A (GWP 3.922)", "TEXT") + ", "
                    + field("REFRIGERANT_GWP", "3.922", "PCS"),
            line("ln_1", "REFRIGERATION_UNIT", "Agregat frigorific cu compresoare semiermetice, agent R404A", "1 buc.",
                    "74.000 EUR") + ", "
                    + line("ln_2", "REFRIGERATION_UNIT", "Vaporizatoare pentru celule", "6 buc.", "26.000 EUR") + ", "
                    + line("ln_3", "INSTALLATION_WORKS", "Automatizare, montaj, punere în funcțiune", "1 set",
                    "18.000 EUR"));

    private static final String INVOICES = extraction("doc_facturi_energie_depozit", "ENERGY_INVOICES",
            field("ENERGY_KWH", "85.000 kWh", "KWH"), "");

    private static final String OLD_SHEET = extraction("doc_fisa_echipament_vechi", "CURRENT_EQUIPMENT",
            field("MANUFACTURE_YEAR", "2006", "YEAR") + ", " + field("REFRIGERANT_GWP", "3.922", "PCS"), "");

    /** A greenhouse: thermal screens bring gas from 60 to 48 kWh/m² and leave electricity at 15 kWh/m². */
    private static final String SCREEN_OFFER = extraction("doc_oferta_ecrane_sera", "OFFER",
            field("TOTAL_NET", "40.000 EUR", "EUR"),
            line("ln_1", "GREENHOUSE_SCREEN", "Ecrane termice pentru seră, 2.000 m²", "1 set", "40.000 EUR",
                    field("SPECIFIC_CONSUMPTION_KWH_PER_UNIT", "15 kWh/m²", "KWH"),
                    field("SPECIFIC_GAS_CONSUMPTION_KWH_PER_UNIT", "48 kWh/m²", "KWH")));

    private static final String GREENHOUSE_INVOICES = extraction("doc_facturi_energie_sera", "ENERGY_INVOICES",
            field("ENERGY_KWH", "30.000 kWh", "KWH"), "");

    private static final Map<String, String> EXTRACTIONS = Map.of("doc_oferta_agregat", OFFER,
            "doc_facturi_energie_depozit", INVOICES, "doc_fisa_echipament_vechi", OLD_SHEET,
            "doc_oferta_ecrane_sera", SCREEN_OFFER, "doc_facturi_energie_sera", GREENHOUSE_INVOICES);

    @TestConfiguration
    static class PostHarvestExtractor {

        @Bean
        DocumentExtractor postHarvestExtractor(ObjectMapper mapper) {
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
    void appleColdStoreStartsBelowTheThresholdAndPassesWithPropaneAndPanels() {
        String run = chain.newRun("38751946", "post_recolta", List.of("ag_3001", "ag_3002"), COLD_STORE,
                Map.of("doc_oferta_agregat", "OFFER", "doc_facturi_energie_depozit", "ENERGY_INVOICES",
                        "doc_fisa_echipament_vechi", "CURRENT_EQUIPMENT"));

        chain.call(run, "get_module_rules", "{}");
        chain.assertValue(run, "rules.threshold.energy_saving", "20");
        chain.assertValue(run, "rules.dnsh.max_refrigerant_gwp", "675");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_agregat\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_depozit\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_fisa_echipament_vechi\"}");

        // 85,000 / 650 = 130.77 kWh/t; 85 MWh × 0.26 = 22.1 t CO2
        chain.call(run, "compute_baseline", "{}");
        chain.assertValue(run, "baseline.quantity", "650");
        chain.assertValue(run, "baseline.energy", "85000");
        chain.assertValue(run, "baseline.specific", "130.77");
        chain.assertValue(run, "baseline.co2", "22.1");
        chain.assertValue(run, "baseline.months", "7");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_agregat\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        chain.assertValue(run, "cfg_initial.total_cost", "118000");
        // 1 − 115 × 650 / 85,000 = 12.0588%; 10,250 kWh saved; 10.25 MWh × 0.26 = 2.665 t; 10,250 × 0.20 = 2,050 EUR
        chain.assertValue(run, "cfg_initial.energy_saving_pct", "12.0588");
        chain.assertValue(run, "cfg_initial.specific_new", "115");
        chain.assertValue(run, "cfg_initial.energy_saved", "10250");
        chain.assertValue(run, "cfg_initial.co2_avoided", "2.665");
        chain.assertValue(run, "cfg_initial.savings_electricity", "2050");
        chain.assertValue(run, "cfg_initial.refrigerant_gwp", "3922");

        JsonNode initialDnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(initialDnsh.path("refrigerantLowGwp").asBoolean()).isFalse();
        assertThat(initialDnsh.path("refrigerantGwp").asInt()).isEqualTo(3922);
        assertThat(initialDnsh.path("maxRefrigerantGwp").asInt()).isEqualTo(675);

        JsonNode search = chain.call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).hasSize(3);
        assertThat(search.path("candidates")).anySatisfy(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_r290_panels");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("PASS");
        }).anySatisfy(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_r290");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("FAIL");
        }).anySatisfy(c -> {
            assertThat(c.path("packageId").asText()).isEqualTo("pkg_panels");
            assertThat(c.path("thresholdResult").asText()).isEqualTo("FAIL");
        });
        chain.assertValue(run, "cand.r290_panels.pct", "29.647");
        chain.assertValue(run, "cand.r290_panels.cost", "142000");
        chain.assertValue(run, "cand.r290.pct", "12.0588");
        chain.assertValue(run, "cand.r290.cost", "127000");
        chain.assertValue(run, "cand.panels.pct", "12.0588");

        JsonNode recommended = chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_recommended\", \"add\": [\"ph.r290.surcharge\", \"ph.panels.insulation_hr\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        assertThat(recommended.path("meetsSafetyMargin").asBoolean()).isTrue();
        chain.assertValue(run, "cfg_recommended.total_cost", "142000");
        chain.assertValue(run, "cfg_recommended.upgrade_cost", "24000");
        // 92 × 650 = 59,800 kWh; saved 25,200 kWh = 29.647%; 25.2 MWh × 0.26 = 6.552 t; 25,200 × 0.20 = 5,040 EUR
        chain.assertValue(run, "cfg_recommended.energy_saving_pct", "29.647");
        chain.assertValue(run, "cfg_recommended.specific_new", "92");
        chain.assertValue(run, "cfg_recommended.energy_saved", "25200");
        chain.assertValue(run, "cfg_recommended.co2_avoided", "6.552");
        chain.assertValue(run, "cfg_recommended.savings_electricity", "5040");
        chain.assertValue(run, "cfg_recommended.refrigerant_gwp", "3");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("refrigerantLowGwp").asBoolean()).isTrue();
        assertThat(dnsh.path("refrigerantGwp").asInt()).isEqualTo(3);
        assertThat(dnsh.path("naturalRefrigerant").asBoolean()).isTrue();
        assertThat(dnsh.path("oldEquipmentFate").asText()).isEqualTo("CASARE");
        assertThat(dnsh.path("oldEquipmentDocument").asBoolean()).isTrue();

        JsonNode eligibility = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_recommended\"}");
        assertThat(ChainSupport.programs(eligibility)).containsEntry("INVESTEU_FEI", "ELIGIBLE/PERMANENT")
                .containsEntry("FGCR", "ELIGIBLE/PERMANENT");
        JsonNode requested = chain.call(run, "check_program_eligibility", "{\"configId\": \"cfg_initial\"}");
        assertThat(ChainSupport.programs(requested)).containsEntry("INVESTEU_FEI", "NOT_ELIGIBLE/PERMANENT");

        chain.call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");
        chain.assertValue(run, "option_b.guarantee.amount", "99400");

        // a refrigerant that fails DNSH keeps the loan classic, however good the saving
        JsonNode blocked = chain.call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"FAIL\"}");
        assertThat(blocked.path("tier").asText()).isEqualTo("CLASIC");
        // 29.647% is above 20% but below 20% × 1.5 = 30%: Verde cu upgrade
        JsonNode tier = chain.call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS\"}");
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_CU_UPGRADE");
        chain.assertValue(run, "green_tier.requested_indicator", "12.0588");
        chain.assertValue(run, "green_tier.financed_indicator", "29.647");
        chain.assertValue(run, "green_tier.verde_plus_min", "30");
        // green (70% guaranteed, Verde cu upgrade): 2 + 0.9 + 0.3375 + 0.324 + 1.35 + 1.77 − 0.4 + 0.2 = 6.4815
        chain.call(run, "price_loan", "{}");
        chain.assertValue(run, "pricing.classic.rate", "8.9");
        chain.assertValue(run, "pricing.green.rate", "6.4815");

        // PMT = P·r / (1 − (1 + r)^−60), r = rate / 12
        chain.call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        chain.assertValue(run, "option_a.installment", "2443.76");
        chain.assertValue(run, "option_a.total_interest", "28625.78");
        chain.assertValue(run, "option_a.collateral_costs", "3350");
        chain.assertValue(run, "option_a.savings_horizon", "10250");
        chain.assertValue(run, "option_a.net_cost", "139725.78");
        chain.call(run, "build_scenario", "{\"optionId\": \"B\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        chain.assertValue(run, "option_b.installment", "2777.16");
        chain.assertValue(run, "option_b.total_interest", "24629.76");
        chain.assertValue(run, "option_b.savings_horizon", "25200");
        chain.assertValue(run, "option_b.net_cost", "141429.76");

        // (38,000 net cash flow + yearly savings) / (12 × installment)
        chain.call(run, "compute_dscr", "{\"optionIds\": [\"A\", \"B\"]}");
        chain.assertValue(run, "option_a.dscr", "1.3657");
        chain.assertValue(run, "option_b.dscr", "1.2915");

        chain.call(run, "compare_scenarios", "{\"optionIds\": [\"A\", \"B\"]}");
        chain.assertValue(run, "compare.net_advantage", "-1703.99");

        chain.call(run, "calculate_impact", "{\"configId\": \"cfg_recommended\"}");
        // unit 74,000 + evaporators 26,000 + R290 supplement 9,000 + panels 15,000 = 124,000 of 142,000
        chain.assertValue(run, "label.green_amount", "124000");
        chain.assertValue(run, "label.green_share", "87.32");
        chain.assertValue(run, "impact.energy_horizon", "126000");
        // 6.552 t × 5 years
        chain.assertValue(run, "impact.co2_horizon", "32.76");
    }

    @Test
    void greenhouseGasAndElectricityAreCountedSeparately() {
        String run = chain.newRun("38751946", "post_recolta", List.of(), GREENHOUSE,
                Map.of("doc_oferta_ecrane_sera", "OFFER", "doc_facturi_energie_sera", "ENERGY_INVOICES"));
        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_ecrane_sera\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie_sera\"}");

        // (30,000 kWh electricity + 120,000 kWh gas) / 2,000 m² = 75 kWh/m²; 30 MWh × 0.26 + 120 MWh × 0.20 = 31.8 t
        chain.call(run, "compute_baseline", "{}");
        chain.assertValue(run, "baseline.quantity", "2000");
        chain.assertValue(run, "baseline.specific", "75");
        chain.assertValue(run, "baseline.co2", "31.8");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_ecrane_sera\"}");

        // new: 15 + 48 = 63 kWh/m² → 1 − 63/75 = 16%, below 20%; gas saved (60 − 48) × 2,000 = 24,000 kWh
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        chain.assertValue(run, "cfg_initial.energy_saving_pct", "16");
        chain.assertValue(run, "cfg_initial.specific_new", "63");
        chain.assertValue(run, "cfg_initial.gas_saved", "24000");
        chain.assertValue(run, "cfg_initial.electricity_saved", "0");
        // 24 MWh × 0.20 = 4.8 t; 24,000 × 0.05 = 1,200 EUR of gas, no electricity
        chain.assertValue(run, "cfg_initial.co2_avoided", "4.8");
        chain.assertValue(run, "cfg_initial.savings_gas", "1200");
        chain.assertValue(run, "cfg_initial.savings_electricity", "0");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_initial\"}");
        assertThat(dnsh.path("refrigerantLowGwp").asBoolean()).isTrue();
        assertThat(dnsh.has("refrigerantGwp")).isFalse();
    }

    @Test
    void missingInvoicesComeBackAsAToolError() {
        String run = chain.newRun("38751946", "post_recolta", List.of(), COLD_STORE, Map.of());

        ToolOutput output = chain.callRaw(run, "compute_baseline", "{}");

        assertThat(output.ok()).isFalse();
        assertThat(output.messageRo()).contains("facturile de energie");
    }
}
