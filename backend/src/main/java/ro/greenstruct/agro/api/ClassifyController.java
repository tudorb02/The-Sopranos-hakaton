package ro.greenstruct.agro.api;

import java.io.IOException;
import java.io.UncheckedIOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ro.greenstruct.agro.modules.OfferClassifier;

/** The app finds the investment category from the offer; the farmer does not pick it. */
@RestController
@RequestMapping("/api/classify")
public class ClassifyController {

    private final OfferClassifier classifier;

    public ClassifyController(OfferClassifier classifier) {
        this.classifier = classifier;
    }

    /** moduleId is null when the offer does not say what is being bought. */
    public record Classification(String moduleId) {
    }

    @PostMapping(consumes = "multipart/form-data")
    public Classification classify(@RequestParam("document") MultipartFile document) {
        try {
            return new Classification(classifier.classify(String.valueOf(document.getOriginalFilename()), document.getBytes())
                    .map(m -> m.moduleId()).orElse(null));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
