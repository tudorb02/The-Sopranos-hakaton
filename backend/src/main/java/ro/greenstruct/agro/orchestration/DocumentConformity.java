package ro.greenstruct.agro.orchestration;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.external.Cui;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.modules.OfferClassifier;
import ro.greenstruct.agro.storage.DocumentStore;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.workspace.RunWorkspace;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

/**
 * Deterministic check of the uploaded documents once the technical auditor has read them. A dossier whose
 * documents are not what they claim to be stops here, whatever the agent concluded:
 * <ul>
 *   <li>a document the extractor could not read;</li>
 *   <li>a document whose content is another type than the one it was uploaded as (an invoice sent as the offer);</li>
 *   <li>a document addressed to another company than the dossier's CUI;</li>
 *   <li>an offer for another investment category than the dossier's module.</li>
 * </ul>
 * Missing documents are not checked here: they become conditions before drawdown (README §5.3).
 */
@Component
public class DocumentConformity {

    /** An offer often comes with its technical sheet in the same file, and the other way round. */
    private static final Set<String> OFFER_TYPES = Set.of("OFFER", "TECHNICAL_SHEET");

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("OFFER", "ofertă"), Map.entry("TECHNICAL_SHEET", "fișă tehnică"),
            Map.entry("CURRENT_EQUIPMENT", "fișa echipamentului vechi"),
            Map.entry("WATER_PERMIT_ANAR", "autorizație de gospodărire a apelor"),
            Map.entry("WATER_CONSUMPTION", "consum de apă"), Map.entry("ENERGY_INVOICES", "facturi de energie"),
            Map.entry("FUEL_INVOICES", "facturi de motorină"), Map.entry("FERTILIZER_INVOICES", "facturi de îngrășăminte"),
            Map.entry("ENVIRONMENTAL_PERMIT", "autorizație de mediu"),
            Map.entry("CERTIFICATION_CONTRACT", "contract de certificare"), Map.entry("BUSINESS_PLAN", "plan de afaceri"),
            Map.entry("OTHER", "alt tip de document"));

    private final WorkspaceStore workspaces;
    private final OfferClassifier classifier;
    private final DocumentStore documents;
    private final ModuleRegistry modules;

    public DocumentConformity(WorkspaceStore workspaces, OfferClassifier classifier, DocumentStore documents,
                              ModuleRegistry modules) {
        this.workspaces = workspaces;
        this.classifier = classifier;
        this.documents = documents;
        this.modules = modules;
    }

    /** The problems found, in Romanian, one per document and rule; empty when the documents are conform. */
    public List<String> problems(Run run) {
        RunWorkspace workspace = workspaces.forRun(run.id());
        List<String> problems = new ArrayList<>();
        String dossierCui = Cui.normalize(run.request().cui());

        workspace.unreadableDocuments().forEach((documentId, reason) -> problems.add(reason));

        for (JsonNode extraction : workspace.extractions()) {
            Optional<StoredDocument> stored = uploaded(run, extraction.path("documentId").asText());
            if (stored.isEmpty()) {
                continue;
            }
            String file = stored.get().fileName();
            String declared = stored.get().docType();
            String detected = extraction.path("documentType").asText();
            if (!sameKind(declared, detected)) {
                problems.add("Documentul " + file + " a fost încărcat ca " + label(declared) + ", dar este "
                        + label(detected));
            }
            String recipient = recipientCui(field(extraction, "RECIPIENT_CUI"));
            if (!recipient.isEmpty() && !recipient.equals(dossierCui)) {
                problems.add("Documentul " + file + " este pe CUI-ul " + recipient + ", nu pe CUI-ul firmei ("
                        + dossierCui + ")");
            }
        }

        for (StoredDocument document : run.request().documents()) {
            if (!"OFFER".equals(document.docType())) {
                continue;
            }
            // the text decides, not the file name the farmer chose
            Optional<ModuleDefinition> category = classifier.classify("", documents.read(document));
            if (category.isPresent() && !category.get().moduleId().equals(run.request().moduleId())) {
                String dossierModule = modules.find(run.request().moduleId()).map(ModuleDefinition::nameRo)
                        .orElse(run.request().moduleId());
                problems.add("Oferta " + document.fileName() + " este pentru " + category.get().nameRo()
                        + ", nu pentru " + dossierModule);
            }
        }
        return problems;
    }

    private static Optional<StoredDocument> uploaded(Run run, String documentId) {
        return run.request().documents().stream().filter(d -> d.documentId().equals(documentId)).findFirst();
    }

    private static boolean sameKind(String declared, String detected) {
        if (detected == null || detected.isBlank() || declared.equals(detected)) {
            return true;
        }
        return OFFER_TYPES.contains(declared) && OFFER_TYPES.contains(detected);
    }

    private static String field(JsonNode extraction, String key) {
        for (JsonNode field : extraction.path("documentFields")) {
            if (key.equals(field.path("key").asText())) {
                return field.path("rawValue").asText();
            }
        }
        return "";
    }

    /** "CUI: RO 45871203", "C.I.F. 45871203" and "45871203" all give "45871203"; other codes stay as written. */
    static String recipientCui(String raw) {
        String value = raw == null ? "" : raw.toUpperCase(java.util.Locale.ROOT)
                .replaceAll("^\\s*(CUI|C\\.U\\.I\\.|CIF|C\\.I\\.F\\.|COD FISCAL)\\s*:?", "");
        return Cui.normalize(value.replaceAll("[\\s:]", ""));
    }

    private static String label(String docType) {
        return LABELS.getOrDefault(docType, docType);
    }
}
