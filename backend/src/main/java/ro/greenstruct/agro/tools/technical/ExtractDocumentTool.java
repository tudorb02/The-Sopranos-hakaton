package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;

/**
 * Reads one uploaded PDF: the DocumentExtractor (Bedrock) copies raw text into submit_offer_extraction,
 * then the numbers are parsed here and published as calcs (doc.offer.total_net, doc.fuel.litres_12m, ...).
 */
@Component
public class ExtractDocumentTool implements ToolHandler {

    private static final Map<String, String> DOC_PREFIX = Map.of(
            "OFFER", "doc.offer", "ENERGY_INVOICES", "doc.energy", "FUEL_INVOICES", "doc.fuel",
            "WATER_PERMIT_ANAR", "doc.permit", "FERTILIZER_INVOICES", "doc.fertilizer");

    private static final Map<String, FieldCalc> FIELD_CALCS = Map.of(
            "TOTAL_NET", new FieldCalc("total_net", "Offer value excl. VAT", Unit.EUR),
            "APPLICATION_EFFICIENCY_PCT", new FieldCalc("efficiency", "Declared efficiency", Unit.PCT),
            "IRRIGATED_AREA_HA", new FieldCalc("area", "Irrigated area", Unit.HA),
            "PUMP_POWER_KW", new FieldCalc("pump_power", "Pump power", Unit.KW),
            "ENERGY_KWH", new FieldCalc("kwh_12m", "Energy invoiced over 12 months", Unit.KWH_PER_YEAR),
            "FUEL_LITRES", new FieldCalc("litres_12m", "Diesel invoiced over 12 months", Unit.L_PER_YEAR),
            "PERMITTED_VOLUME_M3", new FieldCalc("volume", "Permitted water volume", Unit.M3_PER_YEAR));

    private record FieldCalc(String key, String labelRo, Unit unit) {
    }

    private final ObjectProvider<DocumentExtractor> extractor;
    private final DocumentStore documents;

    public ExtractDocumentTool(ObjectProvider<DocumentExtractor> extractor, DocumentStore documents) {
        this.extractor = extractor;
        this.documents = documents;
    }

    @Override
    public String name() {
        return "extract_document";
    }

    @Override
    public String description() {
        return "Reads one uploaded document (offer, invoices, permit) and returns its fields. Numbers become calcs; "
                + "the raw text stays in the result. Call it once per document you need.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["documentId"],
                 "properties": {"documentId": {"type": "string", "pattern": "^doc_[a-z0-9_]{3,40}$"}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        String documentId = Params.requiredText(input, "documentId");
        StoredDocument document = context.run().request().documents().stream()
                .filter(d -> d.documentId().equals(documentId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Document " + documentId + " is not in the dossier"));
        DocumentExtractor reader = extractor.getIfAvailable();
        if (reader == null) {
            throw new AgentFailureException("BEDROCK_UNAVAILABLE", "Document reading via Bedrock is not configured",
                    false, null);
        }
        JsonNode extraction;
        try {
            extraction = reader.extract(document, documents.read(document), context.module());
        } catch (Exception e) {
            String reason = "Document " + document.fileName() + " could not be read";
            context.workspace().putExtractionFailure(documentId, reason);
            throw new AgentFailureException("DOCUMENT_UNREADABLE", reason, true, e);
        }
        return ingest(extraction, context);
    }

    /** Parses an extraction and publishes its calcs; also used when replaying a recorded run. */
    public ToolOutput ingest(JsonNode extraction, ToolContext context) {
        DocumentFacts facts = ExtractionParser.parse(extraction);
        context.workspace().putDocument(facts);
        context.workspace().putExtraction(facts.documentId(), extraction);
        String prefix = DOC_PREFIX.getOrDefault(facts.docType(), "doc." + facts.docType().toLowerCase());
        facts.numbers().forEach((field, value) -> {
            FieldCalc calc = FIELD_CALCS.get(field);
            if (calc != null) {
                context.calc(prefix + "." + calc.key(), calc.labelRo(), value, calc.unit())
                        .source("Document " + facts.documentId()).add();
            }
        });
        for (DocumentFacts.LineFacts line : facts.lines()) {
            BigDecimal price = line.numbers().get("LINE_PRICE_NET");
            if (price != null) {
                context.calc(prefix + "." + line.lineId() + ".price", line.descriptionRo(), price, Unit.EUR)
                        .source("Document " + facts.documentId()).add();
            }
        }
        var result = context.newResult();
        result.set("extraction", extraction);
        return context.ok(result, "Read document " + facts.documentId());
    }
}
