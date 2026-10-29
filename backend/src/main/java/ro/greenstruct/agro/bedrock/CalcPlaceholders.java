package ro.greenstruct.agro.bedrock;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;

/**
 * Recordings never contain a calcId (it changes with the run id). They hold {{calc:tool/key}} instead;
 * this class converts in both directions, inside any string of a JSON tree.
 */
public final class CalcPlaceholders {

    public static final Pattern CALC_ID = Pattern.compile("calc_[0-9a-f]{12}");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{calc:([^}]+)}}");

    private CalcPlaceholders() {
    }

    /** Thrown on replay when a recorded {{calc:...}} has no counterpart in the current run. */
    public static class UnresolvedCalcException extends RuntimeException {

        private final String name;

        public UnresolvedCalcException(String name) {
            super("Missing calculation on replay: " + name);
            this.name = name;
        }

        public String name() {
            return name;
        }
    }

    /** calcId to {{calc:tool/key}} (unknown ids are left untouched). */
    public static JsonNode toPlaceholders(JsonNode node, CalcDirectory directory) {
        return mapStrings(node, text -> replace(text, CALC_ID, id -> directory.nameOf(id).map(n -> "{{calc:" + n + "}}")));
    }

    /** {{calc:tool/key}} to the calcId of the current run; throws UnresolvedCalcException if one is missing. */
    public static JsonNode substitute(JsonNode node, CalcDirectory directory) {
        return mapStrings(node, text -> {
            Matcher matcher = PLACEHOLDER.matcher(text);
            StringBuilder out = new StringBuilder();
            while (matcher.find()) {
                String name = matcher.group(1);
                String id = directory.idOf(name).orElseThrow(() -> new UnresolvedCalcException(name));
                matcher.appendReplacement(out, Matcher.quoteReplacement(id));
            }
            matcher.appendTail(out);
            return out.toString();
        });
    }

    /** Every calcId mentioned anywhere in the tree. */
    public static Set<String> calcIds(JsonNode node) {
        Set<String> ids = new LinkedHashSet<>();
        mapStrings(node, text -> {
            Matcher matcher = CALC_ID.matcher(text);
            while (matcher.find()) {
                ids.add(matcher.group());
            }
            return text;
        });
        return ids;
    }

    private static String replace(String text, Pattern pattern, java.util.function.Function<String, Optional<String>> mapper) {
        Matcher matcher = pattern.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String replacement = mapper.apply(matcher.group()).orElse(matcher.group());
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static JsonNode mapStrings(JsonNode node, java.util.function.UnaryOperator<String> function) {
        if (node == null) {
            return null;
        }
        if (node.isTextual()) {
            return new TextNode(function.apply(node.asText()));
        }
        if (node.isObject()) {
            ObjectNode copy = ((ObjectNode) node).objectNode();
            node.fields().forEachRemaining(entry -> copy.set(entry.getKey(), mapStrings(entry.getValue(), function)));
            return copy;
        }
        if (node.isArray()) {
            ArrayNode copy = ((ArrayNode) node).arrayNode();
            node.forEach(item -> copy.add(mapStrings(item, function)));
            return copy;
        }
        return node;
    }
}
