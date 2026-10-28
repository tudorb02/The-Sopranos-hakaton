package ro.greenstruct.agro.bedrock;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.storage.StoredDocument;

/**
 * Level 3 of plan B: the recording of an earlier LIVE run on the same uploaded files, module and answers.
 * In memory only. It stores decisions (with calc placeholders), so a cache hit also recalculates live.
 */
public class RunCache {

    private final Map<String, Recording> entries = new ConcurrentHashMap<>();

    public static String key(AgentSlot slot, Run run) {
        List<String> hashes = new ArrayList<>();
        for (StoredDocument document : run.request().documents()) {
            hashes.add(document.docType() + ":" + document.sha256());
        }
        hashes.sort(Comparator.naturalOrder());
        String material = slot.name() + "|" + run.request().moduleId() + "|"
                + canonical(run.request().questionnaire()) + "|" + String.join(",", hashes);
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(material.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public Optional<Recording> find(String key) {
        return Optional.ofNullable(entries.get(key));
    }

    public void put(String key, Recording recording) {
        entries.put(key, recording);
    }

    /** JSON text with object keys in alphabetical order, so equal answers always hash the same. */
    static String canonical(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return "null";
        }
        if (node.isObject()) {
            Map<String, String> sorted = new TreeMap<>();
            node.fields().forEachRemaining(entry -> sorted.put(entry.getKey(), canonical(entry.getValue())));
            StringBuilder out = new StringBuilder("{");
            sorted.forEach((key, value) -> out.append(out.length() > 1 ? "," : "").append('"').append(key)
                    .append("\":").append(value));
            return out.append('}').toString();
        }
        if (node.isArray()) {
            List<String> items = new ArrayList<>();
            node.forEach(item -> items.add(canonical(item)));
            return "[" + String.join(",", items) + "]";
        }
        return node.toString();
    }
}
