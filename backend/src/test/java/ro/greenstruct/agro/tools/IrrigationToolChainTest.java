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
 * The README demo (§6 category 1, §12) through the tools in agent order: 40 ha of vegetables irrigated by furrows, a
 * sprinkler offer at 20% (below the 25% threshold), drip + sensors at 40% (Verde Plus). The expected figures were worked
 * out by hand from the formulas of the README: NIR = Σ max(0, Kc × ET0 − P_eff) × 10 × ha with ET0 700 mm and
 * effective rain 200 mm; V = NIR × (1 − s) / η; kWh = V × (lift + pressure head) × 0.002725 / 0.65.
 */
@SpringBootTest(properties = "greenstruct.analysis-date=2026-10-28")
class IrrigationToolChainTest {

    @TestConfiguration
    static class RecordedReadings {

        @Bean
        DocumentExtractor recordedExtractor(ObjectMapper mapper) {
            return (document, content, module) ->
                    JsonFiles.read(mapper, Path.of("../data/demo/extractions/" + document.documentId() + ".json"));
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
    void sprinklerFailsDripWithSensorsIsVerdePlus() {
        String run = chain.newRun("45871203", "irigatii", List.of("ct_0412_01", "ct_0412_02", "ct_0412_03"),
                "{\"irrigation_current\": \"BRAZDE\", \"pump_lift_m\": 35, \"cashin_months\": [\"JUN\", \"JUL\", \"AUG\", \"SEP\", \"OCT\"],"
                        + " \"old_equipment_fate\": \"CASARE\"}",
                Map.of("doc_oferta_aspersie", "OFFER", "doc_aviz_anar", "WATER_PERMIT_ANAR",
                        "doc_facturi_energie", "ENERGY_INVOICES"));

        chain.call(run, "extract_document", "{\"documentId\": \"doc_oferta_aspersie\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_aviz_anar\"}");
        chain.call(run, "extract_document", "{\"documentId\": \"doc_facturi_energie\"}");
        chain.call(run, "get_module_rules", "{}");
        chain.call(run, "compute_baseline", "{}");
        // tomate (0.85×700−200)×10×16 + ardei (0.80×700−200)×10×14 + varză (0.75×700−200)×10×10 = 146,100
        chain.assertValue(run, "baseline.net_need", "146100");
        chain.assertValue(run, "baseline.water", "243500");
        chain.assertValue(run, "baseline.energy", "35729");

        JsonNode initial = chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_aspersie\"}");
        assertThat(initial.path("thresholdResult").asText()).isEqualTo("FAIL");
        chain.assertValue(run, "cfg_initial.total_cost", "52000");
        chain.assertValue(run, "cfg_initial.water", "194800");
        chain.assertValue(run, "cfg_initial.indicator", "20");
        // 194,800 × (35 + 35) × 0.002725 / 0.65 = 57,166.31: more pressure than furrows, so the energy grows
        chain.assertValue(run, "cfg_initial.pumping_energy", "57166.31");
        chain.assertValue(run, "cfg_initial.energy_saved", "-21437.31");

        JsonNode search = chain.call(run, "search_upgrades", "{\"baseConfigId\": \"cfg_initial\"}");
        assertThat(search.path("candidates")).extracting(c -> c.path("packageId").asText())
                .contains("pkg_sensors", "pkg_drip", "pkg_drip_sensors");
        // sensors on the offered sprinkler: 52,000 + 6,500 + 1,200 (meter) = 59,700;
        // 146,100 × 0.9 / 0.75 = 175,320 m³, 1 − 175,320 / 243,500 = 28%
        chain.assertValue(run, "cand.sensors.cost", "59700");
        chain.assertValue(run, "cand.sensors.pct", "28");
        // drip replaces the sprinkler and the pipes, keeps the pump: 11,500 + 68,000 + 1,200 (meter, required by DNSH)
        chain.assertValue(run, "cand.drip.cost", "80700");
        chain.assertValue(run, "cand.drip.pct", "33.33");
        chain.assertValue(run, "cand.drip_sensors.cost", "87200");
        chain.assertValue(run, "cand.drip_sensors.pct", "40");

        JsonNode recommended = chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\","
                + " \"configId\": \"cfg_recommended\", \"add\": [\"irg.drip.surface_veg\", \"irg.sensors.soil_moisture\","
                + " \"irg.meter.electromagnetic\"]}");
        assertThat(recommended.path("thresholdResult").asText()).isEqualTo("PASS");
        chain.assertValue(run, "cfg_recommended.water", "146100");
        chain.assertValue(run, "cfg_recommended.indicator", "40");
        // 146,100 × (35 + 15) × 0.002725 / 0.65 = 30,624.81 kWh; 35,729 − 30,624.81 = 5,104.19 kWh saved
        chain.assertValue(run, "cfg_recommended.energy_saved", "5104.19");
        // 5,104.19 kWh × 0.26 kg/kWh / 1,000 = 1.327 t
        chain.assertValue(run, "cfg_recommended.co2_avoided", "1.33");

        JsonNode dnsh = chain.call(run, "check_dnsh_inputs", "{\"configId\": \"cfg_recommended\"}");
        assertThat(dnsh.path("permitValid").asBoolean()).isTrue();
        assertThat(dnsh.path("waterMeterInConfig").asBoolean()).isTrue();
        assertThat(dnsh.path("nitrateVulnerableParcels")).isEmpty();
    }

    @Test
    void ratesAndTierOfTheDemoLoan() {
        String run = chain.newRun("45871203", "irigatii", List.of("ct_0412_01", "ct_0412_02", "ct_0412_03"),
                "{\"irrigation_current\": \"BRAZDE\", \"pump_lift_m\": 35, \"cashin_months\": [\"JUN\", \"JUL\", \"AUG\", \"SEP\", \"OCT\"],"
                        + " \"old_equipment_fate\": \"CASARE\"}",
                Map.of("doc_oferta_aspersie", "OFFER", "doc_aviz_anar", "WATER_PERMIT_ANAR",
                        "doc_facturi_energie", "ENERGY_INVOICES"));
        for (String doc : List.of("doc_oferta_aspersie", "doc_aviz_anar", "doc_facturi_energie")) {
            chain.call(run, "extract_document", "{\"documentId\": \"" + doc + "\"}");
        }
        chain.call(run, "compute_baseline", "{}");
        chain.call(run, "compute_indicator", "{\"documentId\": \"doc_oferta_aspersie\"}");
        chain.call(run, "simulate_upgrade_package", "{\"baseConfigId\": \"cfg_initial\", \"configId\": \"cfg_recommended\","
                + " \"add\": [\"irg.drip.surface_veg\", \"irg.sensors.soil_moisture\", \"irg.meter.electromagnetic\"]}");
        chain.call(run, "list_financing_lines", "{}");
        chain.call(run, "build_funding_stack", "{\"options\": ["
                + "{\"optionId\": \"A\", \"configId\": \"cfg_initial\", \"products\": [\"rbro.invest.standard\"]},"
                + "{\"optionId\": \"B\", \"configId\": \"cfg_recommended\", \"products\": [\"rbro.agri.green_investeu\"]}]}");

        JsonNode tier = chain.call(run, "determine_green_tier", "{\"requestedConfigId\": \"cfg_initial\","
                + " \"financedConfigId\": \"cfg_recommended\", \"dnshStatus\": \"PASS\"}");
        // 40% ≥ 25% × 1.5 = 37.5% and DNSH complete
        assertThat(tier.path("tier").asText()).isEqualTo("VERDE_PLUS");

        chain.call(run, "price_loan", "{}");
        // classic: 2.618 + 1.20 + 3% × 45% + 75% × 12% × 12% + 1.50 + 1.77 = 9.518
        chain.assertValue(run, "pricing.classic.rate", "9.518");
        chain.assertValue(run, "pricing.classic.risk_cost", "1.35");
        chain.assertValue(run, "pricing.classic.capital_cost", "1.08");
        // green: 2.618 + (1.20 − 0.10) + 2.5% × 45% × 30% + 22.5% × 12% × 12% + (1.50 − 0.15) + 1.77 − 0.40 = 7.0995
        chain.assertValue(run, "pricing.green.risk_cost", "0.34");
        chain.assertValue(run, "pricing.green.capital_cost", "0.32");
        chain.assertValue(run, "pricing.green.rate", "7.0995");
        chain.assertValue(run, "pricing.diff.risk_cost", "-1.01");
        chain.assertValue(run, "pricing.diff.capital_cost", "-0.76");
        chain.assertValue(run, "pricing.diff.total", "-2.4185");

        chain.call(run, "build_scenario", "{\"optionId\": \"A\", \"scheduleType\": \"EQUAL_MONTHLY\"}");
        // 52,000 over 60 months at 9.518%: 1,092.55 per month, 13,553.26 interest; mortgage 1,450 + 5 × 380 = 3,350
        chain.assertValue(run, "option_a.installment", "1092.55");
        chain.assertValue(run, "option_a.total_interest", "13553.26");
        chain.assertValue(run, "option_a.collateral_costs", "3350");
    }
}
