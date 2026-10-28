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
