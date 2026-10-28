package ro.greenstruct.agro.storage;

/** Local disk for the demo; an S3 implementation plugs in behind the same interface. */
public interface DocumentStore {

    /** documentId may be null, in which case a new doc_… id is generated. */
    StoredDocument save(String documentId, String docType, String fileName, String contentType, byte[] content);

    byte[] read(StoredDocument document);
}
