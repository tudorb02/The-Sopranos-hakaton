package ro.greenstruct.agro.modules;

import java.io.ByteArrayInputStream;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.springframework.stereotype.Component;

/**
 * Finds the investment category from the uploaded offer: counts the detectionKeywords of each module
 * (config/modules) in the file name and in the text of the PDF. A scanned or image-only offer has no text,
 * so only the file name counts and the answer may be empty.
 */
@Component
public class OfferClassifier {

    private static final int MAX_PER_KEYWORD = 3;

    private final ModuleRegistry modules;

    public OfferClassifier(ModuleRegistry modules) {
        this.modules = modules;
    }

    public Optional<ModuleDefinition> classify(String fileName, byte[] content) {
        String text = normalize(fileName + " " + textOf(content));
        ModuleDefinition best = null;
        int bestScore = 0;
        for (ModuleDefinition module : modules.all()) {
            int score = score(module, text);
            if (score > bestScore) {
                best = module;
                bestScore = score;
            }
        }
        return Optional.ofNullable(best);
    }

    private static int score(ModuleDefinition module, String text) {
        if (module.detectionKeywords() == null) {
            return 0;
        }
        int score = 0;
        for (String keyword : module.detectionKeywords()) {
            Matcher m = Pattern.compile("\\b" + Pattern.quote(normalize(keyword))).matcher(text);
            int found = 0;
            while (found < MAX_PER_KEYWORD && m.find()) {
                found++;
            }
            score += found;
        }
        return score;
    }

    private static String textOf(byte[] content) {
        try {
            PdfReader reader = new PdfReader(new ByteArrayInputStream(content));
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            StringBuilder text = new StringBuilder();
            for (int page = 1; page <= Math.min(reader.getNumberOfPages(), 5); page++) {
                text.append(extractor.getTextFromPage(page)).append(' ');
            }
            return text.toString();
        } catch (Exception | LinkageError e) {
            return "";
        }
    }

    static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('ș', 's').replace('ț', 't');
    }
}
