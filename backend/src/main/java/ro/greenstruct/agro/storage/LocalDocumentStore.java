package ro.greenstruct.agro.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;

@Component
public class LocalDocumentStore implements DocumentStore {

    private final Path root;

    public LocalDocumentStore(GreenStructProperties properties) {
        this.root = properties.paths().uploadsDir();
    }

    @Override
    public StoredDocument save(String documentId, String docType, String fileName, String contentType,
                               byte[] content) {
        String id = documentId != null ? documentId : newId();
        String storageKey = UUID.randomUUID() + "-" + safeName(fileName);
        try {
            Files.createDirectories(root);
            Files.write(root.resolve(storageKey), content);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot store document " + fileName, e);
        }
        return new StoredDocument(id, docType, fileName, contentType, content.length, sha256(content), storageKey);
    }

    @Override
    public byte[] read(StoredDocument document) {
        try {
            return Files.readAllBytes(root.resolve(document.storageKey()));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read document " + document.fileName(), e);
        }
    }

    /** doc_ + 12 base-36 characters, matching the contract's documentId pattern. */
    private static String newId() {
        String random = Long.toString(UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE, 36);
        return "doc_" + (random + "000000000000").substring(0, 12);
    }

    private static String safeName(String fileName) {
        String name = fileName == null || fileName.isBlank() ? "document" : Path.of(fileName).getFileName().toString();
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
