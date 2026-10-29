package ro.greenstruct.agro.orchestration;

import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.modules.OfferClassifier;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The cases found by uploading nonconforming documents to the live backend (28.10.2026). */
class DocumentConformityTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final StoredDocument OFFER = doc("doc_offer_01", "OFFER", "oferta.pdf");
    private static final StoredDocument PERMIT = doc("doc_permit_01", "WATER_PERMIT_ANAR", "autorizatie.pdf");

    private final WorkspaceStore workspaces = new WorkspaceStore();
    private final OfferClassifier classifier = mock(OfferClassifier.class);
    private DocumentConformity conformity;
    private Run run;

    @BeforeEach
    void setUp() {
        DocumentStore documents = mock(DocumentStore.class);
        when(documents.read(any())).thenReturn(new byte[0]);
        ModuleRegistry modules = mock(ModuleRegistry.class);
        when(modules.find(anyString())).thenReturn(Optional.empty());
        when(classifier.classify(anyString(), any())).thenReturn(Optional.empty());
        conformity = new DocumentConformity(workspaces, classifier, documents, modules);
        run = Run.create(new RunRequest("45871203", "irigatii", List.of("ct_0412_01"), MAPPER.createObjectNode(),
                List.of(OFFER, PERMIT), null), List.of(), null);
    }

    @Test
    void conformDocumentsPass() {
        read(OFFER, "OFFER", "RO 45871203");
        read(PERMIT, "WATER_PERMIT_ANAR", "CUI: 45871203");

        assertThat(conformity.problems(run)).isEmpty();
    }

    @Test
    void anInvoiceUploadedAsTheOfferIsRejected() {
        read(OFFER, "FERTILIZER_INVOICES", null);

        assertThat(conformity.problems(run)).containsExactly(
                "Document oferta.pdf was uploaded as offer, but it is fertiliser invoices");
    }

    @Test
    void anOfferWithItsTechnicalSheetIsStillAnOffer() {
        read(OFFER, "TECHNICAL_SHEET", null);

        assertThat(conformity.problems(run)).isEmpty();
    }

    @Test
    void aDocumentOnAnotherCompanysCuiIsRejected() {
        read(PERMIT, "WATER_PERMIT_ANAR", "DEMO-0001");

        assertThat(conformity.problems(run)).containsExactly(
                "Document autorizatie.pdf is addressed to CUI DEMO-0001, not to the company's CUI (45871203)");
    }

    @Test
    void anOfferForAnotherCategoryIsRejected() {
        ModuleDefinition energy = mock(ModuleDefinition.class);
        when(energy.moduleId()).thenReturn("energie");
        when(energy.nameRo()).thenReturn("On-farm energy");
        when(classifier.classify(anyString(), any())).thenReturn(Optional.of(energy));

        assertThat(conformity.problems(run)).containsExactly(
                "Offer oferta.pdf is for On-farm energy, not for irigatii");
    }

    @Test
    void aDocumentTheExtractorCouldNotReadIsRejectedUntilItIsRead() {
        workspaces.forRun(run.id()).putExtractionFailure(OFFER.documentId(), "Document oferta.pdf could not be read");
        assertThat(conformity.problems(run)).containsExactly("Document oferta.pdf could not be read");

        read(OFFER, "OFFER", null);
        assertThat(conformity.problems(run)).isEmpty();
    }

    @Test
    void recipientCodesAreNormalised() {
        assertThat(DocumentConformity.recipientCui("CUI: RO 45871203")).isEqualTo("45871203");
        assertThat(DocumentConformity.recipientCui("C.I.F. 45871203")).isEqualTo("45871203");
        assertThat(DocumentConformity.recipientCui("DEMO-0001")).isEqualTo("DEMO-0001");
        assertThat(DocumentConformity.recipientCui(null)).isEmpty();
    }

    private void read(StoredDocument document, String detectedType, String recipientCui) {
        ObjectNode extraction = MAPPER.createObjectNode().put("documentId", document.documentId())
                .put("documentType", detectedType);
        var fields = extraction.putArray("documentFields");
        if (recipientCui != null) {
            fields.addObject().put("key", "RECIPIENT_CUI").put("rawValue", recipientCui);
        }
        workspaces.forRun(run.id()).putExtraction(document.documentId(), (JsonNode) extraction);
    }

    private static StoredDocument doc(String id, String type, String fileName) {
        return new StoredDocument(id, type, fileName, "application/pdf", 100, "sha", "key");
    }
}
