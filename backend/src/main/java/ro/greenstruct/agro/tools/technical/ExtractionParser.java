package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.workspace.DocumentFacts;

/**
 * Turns the model's raw extraction into numbers. The model copies text exactly ("85.000,00 EUR", "76,5%");
 * parsing Romanian number formats is code, not AI.
 */
public final class ExtractionParser {

    private static final Set<String> TEXT_UNITS = Set.of("TEXT", "DATE", "BOOL");
    private static final Pattern NUMBER = Pattern.compile("\\d[\\d.]*(,\\d+)?");

    private ExtractionParser() {
    }

    public static DocumentFacts parse(JsonNode extraction) {
        Map<String, BigDecimal> numbers = new HashMap<>();
        Map<String, String> texts = new HashMap<>();
        readFields(extraction.path("documentFields"), numbers, texts);

        List<DocumentFacts.LineFacts> lines = new ArrayList<>();
        for (JsonNode line : extraction.path("lineItems")) {
            Map<String, BigDecimal> lineNumbers = new HashMap<>();
            Map<String, String> lineTexts = new HashMap<>();
            readFields(line.path("fields"), lineNumbers, lineTexts);
            lines.add(new DocumentFacts.LineFacts(line.path("lineId").asText(), line.path("category").asText(),
                    line.path("descriptionRo").asText(), lineNumbers, lineTexts));
        }
        return new DocumentFacts(extraction.path("documentId").asText(), extraction.path("documentType").asText(),
                numbers, texts, lines);
    }

    /**
     * "85.000,00 EUR" → 85000.00, "76,5%" → 76.5, "2 buc." → 2, "240.000 m³/an" → 240000.
     * Without a comma, dots are thousands separators only when every group after them has 3 digits.
     */
    public static Optional<BigDecimal> parseNumber(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        Matcher matcher = NUMBER.matcher(raw);
        if (!matcher.find()) {
            return Optional.empty();
        }
        String token = matcher.group();
        if (token.endsWith(".")) {
            token = token.substring(0, token.length() - 1);
        }
        if (token.contains(",")) {
            token = token.replace(".", "").replace(',', '.');
        } else if (token.contains(".")) {
            String[] groups = token.split("\\.");
            boolean thousands = true;
            for (int i = 1; i < groups.length; i++) {
                thousands &= groups[i].length() == 3;
            }
            if (thousands) {
                token = token.replace(".", "");
            }
        }
        BigDecimal value = new BigDecimal(token);
        return Optional.of(raw.trim().startsWith("-") || raw.trim().startsWith("−") ? value.negate() : value);
    }

    private static void readFields(JsonNode fields, Map<String, BigDecimal> numbers, Map<String, String> texts) {
        for (JsonNode field : fields) {
            String key = field.path("key").asText();
            String raw = field.path("rawValue").asText();
            texts.put(key, raw);
            if (!TEXT_UNITS.contains(field.path("unit").asText())) {
                parseNumber(raw).ifPresent(number -> numbers.put(key, number));
            }
        }
    }
}
