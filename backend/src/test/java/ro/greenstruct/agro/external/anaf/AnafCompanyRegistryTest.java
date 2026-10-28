package ro.greenstruct.agro.external.anaf;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.engine.sme.SmeStatus;
import ro.greenstruct.agro.external.UpstreamUnavailableException;
import ro.greenstruct.agro.external.mock.DemoFarmRepository;
import ro.greenstruct.agro.external.mock.MockDataSources;
import ro.greenstruct.agro.external.model.CompanyRecord;
import ro.greenstruct.agro.modules.ReferenceData;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** ANAF answers in the shape of the real services (checked on 2026-10-28), for a fictional company. */
class AnafCompanyRegistryTest {

    private static final String CUI = "40123456";
    private static final String VAT_URL = "https://anaf.test/api/PlatitorTvaRest/v9/tva";

    private static final String VAT_RECORD = """
            {"found": [{
              "date_generale": {"data": "2026-10-28", "cui": 40123456, "denumire": "CÂMPIA VERDE AGRO SRL",
                "stare_inregistrare": "INREGISTRAT din data 14.03.2019", "forma_organizare": "PERSOANA JURIDICA",
                "forma_juridica": "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ", "data_inregistrare": "2019-03-14",
                "cod_CAEN": "0111"},
              "inregistrare_scop_Tva": {"scpTVA": true},
              "stare_inactiv": {"dataInactivare": "", "dataReactivare": "", "dataRadiere": "", "statusInactivi": false},
              "adresa_sediu_social": {"sdenumire_Localitate": "Lehliu-Gară", "sdenumire_Judet": "CĂLĂRAŞI"}}],
             "notFound": []}
            """;

    private static final String BALANCE_SHEET_2025 = """
            {"an": 2025, "cui": 40123456, "deni": "CÂMPIA VERDE AGRO SRL", "caen": 111,
             "den_caen": "Cultivarea cerealelor (exclusiv orez), plantelor leguminoase şi a plantelor producătoare de seminţe oleaginoase",
             "i": [{"indicator": "I1", "val_indicator": 6958000, "val_den_indicator": "ACTIVE IMOBILIZATE - TOTAL"},
                   {"indicator": "I2", "val_indicator": 2485000, "val_den_indicator": "ACTIVE CIRCULANTE - TOTAL, din care"},
                   {"indicator": "I6", "val_indicator": 49700, "val_den_indicator": "CHELTUIELI IN AVANS"},
                   {"indicator": "I13", "val_indicator": 4970000, "val_den_indicator": "Cifra de afaceri neta"},
                   {"indicator": "I18", "val_indicator": 497000, "val_den_indicator": "Profit net"},
                   {"indicator": "I19", "val_indicator": 0, "val_den_indicator": "Pierdere neta"},
                   {"indicator": "I20", "val_indicator": 12, "val_den_indicator": "Numar mediu de salariati"}]}
            """;

    private static final String NO_BALANCE_SHEET = """
            {"an": 2025, "cui": 40123456, "deni": "", "caen": 0, "den_caen": "", "i": []}
            """;

    private MockRestServiceServer server;
    private AnafCompanyRegistry registry;

    @BeforeEach
    void setUp() {
        registry = registry(Duration.ofHours(12));
    }

    @Test
    void mapsTheVatRegisterAndTheLatestBalanceSheet() {
        server.expect(requestTo(VAT_URL)).andExpect(method(HttpMethod.POST))
                .andExpect(content().json("[{\"cui\": 40123456, \"data\": \"2026-10-28\"}]"))
                .andRespond(withSuccess(VAT_RECORD, MediaType.APPLICATION_JSON));
        expectBalanceSheet(2025, BALANCE_SHEET_2025);

        CompanyRecord found = registry.company("RO " + CUI).orElseThrow();

        var company = found.company();
        assertThat(company.cui()).isEqualTo(CUI);
        assertThat(company.name()).isEqualTo("CÂMPIA VERDE AGRO SRL");
        assertThat(company.legalForm()).isEqualTo("SRL");
        assertThat(company.caen()).isEqualTo("0111");
        assertThat(company.caenLabelRo()).startsWith("Cultivarea cerealelor").contains("leguminoase și");
        assertThat(company.county()).isEqualTo("Călărași");
        assertThat(company.locality()).isEqualTo("Lehliu-Gară");
        assertThat(company.registeredAt()).isEqualTo(LocalDate.of(2019, 3, 14));
        assertThat(company.turnoverEur()).isEqualByComparingTo("1000000");
        assertThat(company.netProfitEur()).isEqualByComparingTo("100000");
        assertThat(company.employees()).isEqualTo(12);
        // (6,958,000 + 2,485,000 + 49,700) RON / 4.97 = 1,910,000 EUR
        assertThat(company.totalAssetsEur()).isEqualByComparingTo("1910000");
        // 12 employees, turnover 1 mil. EUR
        assertThat(company.smeStatus()).isEqualTo(SmeStatus.SME);
        assertThat(company.financialYear()).isEqualTo(2025);
        assertThat(company.vatPayer()).isTrue();
        assertThat(company.manager()).isNull();
        assertThat(found.source().source()).isEqualTo("ANAF");
        assertThat(found.source().mode()).isEqualTo("LIVE");
        server.verify();
    }

    @Test
    void usesThePreviousYearWhenLastYearsBalanceSheetIsNotFiledYet() {
        expectVatRecord();
        expectBalanceSheet(2025, NO_BALANCE_SHEET);
        expectBalanceSheet(2024, BALANCE_SHEET_2025.replace("\"an\": 2025", "\"an\": 2024"));

        assertThat(registry.company(CUI).orElseThrow().company().financialYear()).isEqualTo(2024);
        server.verify();
    }

    @Test
    void aCompanyWithoutBalanceSheetsHasNoFinancials() {
        expectVatRecord();
        expectBalanceSheet(2025, NO_BALANCE_SHEET);
        expectBalanceSheet(2024, NO_BALANCE_SHEET);

        var company = registry.company(CUI).orElseThrow().company();
        assertThat(company.turnoverEur()).isNull();
        assertThat(company.totalAssetsEur()).isNull();
        assertThat(company.smeStatus()).isEqualTo(SmeStatus.UNKNOWN);
        assertThat(company.caen()).isEqualTo("0111");
        assertThat(company.caenLabelRo()).isEqualTo("Cod CAEN 0111");
    }

    @Test
    void demoFarmsNeverReachAnaf() {
        CompanyRecord demo = registry.company("38264019").orElseThrow();

        assertThat(demo.company().name()).isEqualTo("Cereale Câmpia Demo SRL");
        // derived from the demo file: 9 employees, turnover 690,000 EUR, assets 1,350,000 EUR
        assertThat(demo.company().smeStatus()).isEqualTo(SmeStatus.SME);
        assertThat(demo.source().mode()).isEqualTo("MOCK");
        server.verify();
    }

    @Test
    void unknownCuiIsEmpty() {
        // The real service answers an unknown CUI with HTTP 404 and this body.
        server.expect(requestTo(VAT_URL)).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.APPLICATION_JSON).body("{\"found\": [], \"notFound\": [40123456]}"));

        assertThat(registry.company(CUI)).isEmpty();
    }

    @Test
    void inactiveTaxpayersAreRefusedWithTheReason() {
        server.expect(requestTo(VAT_URL)).andRespond(withSuccess(VAT_RECORD
                .replace("\"dataInactivare\": \"\"", "\"dataInactivare\": \"2026-02-01\"")
                .replace("\"statusInactivi\": false", "\"statusInactivi\": true"), MediaType.APPLICATION_JSON));
        expectBalanceSheet(2025, BALANCE_SHEET_2025);

        assertThatThrownBy(() -> registry.company(CUI))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inactivă fiscal de ANAF din 2026-02-01");
    }

    @Test
    void lettersInTheCuiAreRejectedBeforeCallingAnaf() {
        assertThatThrownBy(() -> registry.company("RO12AB")).isInstanceOf(IllegalArgumentException.class);
        server.verify();
    }

    @Test
    void anafDownWithNothingCachedIsAnUpstreamError() {
        server.expect(requestTo(VAT_URL)).andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThatThrownBy(() -> registry.company(CUI))
                .isInstanceOf(UpstreamUnavailableException.class)
                .hasMessageContaining("ANAF nu răspunde");
    }

    @Test
    void anafDownAfterAnEarlierAnswerServesTheCachedCopy() {
        registry = registry(Duration.ZERO);
        expectVatRecord();
        expectBalanceSheet(2025, BALANCE_SHEET_2025);
        server.expect(requestTo(VAT_URL)).andRespond(withServerError());

        assertThat(registry.company(CUI).orElseThrow().source().mode()).isEqualTo("LIVE");
        CompanyRecord cached = registry.company(CUI).orElseThrow();
        assertThat(cached.source().mode()).isEqualTo("CACHE");
        assertThat(cached.company().name()).isEqualTo("CÂMPIA VERDE AGRO SRL");
    }

    @Test
    void aFreshCachedAnswerIsNotFetchedAgain() {
        expectVatRecord();
        expectBalanceSheet(2025, BALANCE_SHEET_2025);
        registry.company(CUI);

        assertThat(registry.company(CUI).orElseThrow().source().mode()).isEqualTo("CACHE");
        server.verify();
    }

    @Test
    void legalFormsAndNames() {
        assertThat(AnafCompanyMapper.legalForm("SOCIETATE COMERCIALĂ PE ACŢIUNI", "X")).isEqualTo("SA");
        assertThat(AnafCompanyMapper.legalForm("", "POPESCU ION PERSOANĂ FIZICĂ AUTORIZATĂ PFA")).isEqualTo("PFA");
        assertThat(AnafCompanyMapper.legalForm("", "AGRO NORD S.R.L.")).isEqualTo("SRL");
        assertThat(AnafCompanyMapper.legalForm("SOCIETATE AGRICOLĂ", "UNIREA")).isNull();
        assertThat(AnafCompanyMapper.properCase(AnafCompanyMapper.withCommaBelow("BISTRIŢA-NĂSĂUD")))
                .isEqualTo("Bistrița-Năsăud");
    }

    private void expectVatRecord() {
        server.expect(requestTo(VAT_URL)).andRespond(withSuccess(VAT_RECORD, MediaType.APPLICATION_JSON));
    }

    private void expectBalanceSheet(int year, String body) {
        server.expect(requestTo("https://anaf.test/bilant?an=" + year + "&cui=" + CUI))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
    }

    private AnafCompanyRegistry registry(Duration cacheTtl) {
        var anaf = new GreenStructProperties.Anaf(true, "https://anaf.test", null, null, Duration.ZERO, cacheTtl);
        var properties = new GreenStructProperties(
                new GreenStructProperties.Paths("../config", "../data", "target/uploads"),
                new GreenStructProperties.Agents(Duration.ofSeconds(90)),
                new GreenStructProperties.Cors(List.of()), "2026-10-28", "HYBRID", null, anaf);
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        RestClient.Builder builder = RestClient.builder().baseUrl(anaf.baseUrl());
        server = MockRestServiceServer.bindTo(builder).build();
        var reference = new ReferenceData(properties, mapper);
        return new AnafCompanyRegistry(new AnafClient(builder.build(), Duration.ZERO),
                new MockDataSources(new DemoFarmRepository(properties, mapper), mapper, reference), properties, reference);
    }
}
