package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.tools.workspace.DocumentFacts;

import static org.assertj.core.api.Assertions.assertThat;

/** A file with 5 monthly invoices must give the total of the 5, not the first page (bug seen live, 28.10.2026). */
class ExtractionParserTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void invoiceLinesAreSummedIntoTheDocumentTotal() {
        // the pumping invoices of the irrigation demo: 4,300 + 7,900 + 10,200 + 9,100 + 4,229 = 35,729 kWh
        ObjectNode extraction = invoices("ENERGY_INVOICES", "4.300", "7.900", "10.200", "9.100", "4.229");
        // the model also copied page 1 as a document-level value
        extraction.putArray("documentFields").addObject().put("key", "ENERGY_KWH").put("rawValue", "4.300")
                .put("unit", "KWH");

        DocumentFacts facts = ExtractionParser.parse(extraction);

        assertThat(facts.number("ENERGY_KWH")).hasValueSatisfying(v -> assertThat(v).isEqualByComparingTo("35729"));
    }

    @Test
    void invoiceAmountsAreSummedToo() {
        ObjectNode extraction = invoices("FUEL_INVOICES");
        var lines = extraction.withArray("lineItems");
        for (String net : new String[]{"6.500,00", "3.875,00"}) {
            lines.addObject().put("lineId", "ln_" + (lines.size() + 1)).put("category", "OTHER")
                    .put("descriptionRo", "Factură").putArray("fields").addObject().put("key", "TOTAL_NET")
                    .put("rawValue", net + " EUR").put("unit", "EUR");
        }
        extraction.putArray("documentFields");

        assertThat(ExtractionParser.parse(extraction).number("TOTAL_NET"))
                .hasValueSatisfying(v -> assertThat(v).isEqualByComparingTo("10375.00"));
    }

    @Test
    void offerLinesLeftAsOtherGetTheirCategoryFromTheDescription() {
        ObjectNode extraction = MAPPER.createObjectNode().put("documentId", "doc_biogas_01").put("documentType", "OFFER");
        var lines = extraction.putArray("lineItems");
        lines.addObject().put("lineId", "ln_1").put("category", "OTHER")
                .put("descriptionRo", "Digestor anaerob din beton, cu agitatoare").putArray("fields");
        lines.addObject().put("lineId", "ln_2").put("category", "OTHER")
                .put("descriptionRo", "Unitate de cogenerare 30 kWe / 45 kWt").putArray("fields");
        lines.addObject().put("lineId", "ln_3").put("category", "PV_SYSTEM")
                .put("descriptionRo", "Structură de montaj pe acoperiș").putArray("fields");
        lines.addObject().put("lineId", "ln_4").put("category", "OTHER")
                .put("descriptionRo", "Pompe, conducte, automatizare, racordare").putArray("fields");
        extraction.putArray("documentFields");

        assertThat(ExtractionParser.parse(extraction).lines()).extracting(DocumentFacts.LineFacts::category)
                .containsExactly("DIGESTER", "COGENERATION", "PV_SYSTEM", "OTHER");
    }

    @Test
    void invoiceLinesKeepTheirCategory() {
        ObjectNode extraction = invoices("ENERGY_INVOICES", "4.300");
        ((ObjectNode) extraction.withArray("lineItems").get(0)).put("descriptionRo", "Stație de pompare, mai 2026");
        extraction.putArray("documentFields");

        assertThat(ExtractionParser.parse(extraction).lines().getFirst().category()).isEqualTo("OTHER");
    }

    @Test
    void anOfferKeepsItsOwnTotals() {
        ObjectNode extraction = invoices("OFFER", "10", "20");
        extraction.putArray("documentFields");

        assertThat(ExtractionParser.parse(extraction).number("ENERGY_KWH")).isEmpty();
    }

    private static ObjectNode invoices(String docType, String... kwh) {
        ObjectNode extraction = MAPPER.createObjectNode().put("documentId", "doc_test_01").put("documentType", docType);
        var lines = extraction.putArray("lineItems");
        for (int i = 0; i < kwh.length; i++) {
            ObjectNode line = lines.addObject().put("lineId", "ln_" + (i + 1)).put("category", "OTHER")
                    .put("descriptionRo", "Factura " + (i + 1));
            line.putArray("fields").addObject().put("key", "ENERGY_KWH").put("rawValue", kwh[i]).put("unit", "KWH");
        }
        return extraction;
    }
}
