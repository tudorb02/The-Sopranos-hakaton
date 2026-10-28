package ro.greenstruct.agro.storage;

/**
 * A document attached to a dossier. documentId (doc_…), docType, fileName and sizeBytes are the contract's
 * Document fields; contentType, sha256 and storageKey stay on the server.
 */
public record StoredDocument(
        String documentId,
        String docType,
        String fileName,
        String contentType,
        long sizeBytes,
        String sha256,
        String storageKey) {
}
