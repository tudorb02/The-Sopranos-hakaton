package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * A document after extraction: the model copied raw text (submit_offer_extraction), the backend parsed the
 * numbers. Keys are the contract's fieldKey values (TOTAL_NET, APPLICATION_EFFICIENCY_PCT, FUEL_LITRES, ...).
 */
public record DocumentFacts(
        String documentId,
        String docType,
        Map<String, BigDecimal> numbers,
        Map<String, String> texts,
        List<LineFacts> lines) {

    public DocumentFacts {
        numbers = Map.copyOf(numbers);
        texts = Map.copyOf(texts);
        lines = List.copyOf(lines);
    }

    public Optional<BigDecimal> number(String key) {
        return Optional.ofNullable(numbers.get(key));
    }

    public record LineFacts(String lineId, String category, String descriptionRo, Map<String, BigDecimal> numbers,
                            Map<String, String> texts) {

        public LineFacts {
            numbers = Map.copyOf(numbers);
            texts = Map.copyOf(texts);
        }
    }
}
