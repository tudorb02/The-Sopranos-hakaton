package ro.greenstruct.agro.modules;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class OfferClassifierTest {

    private static final Path DOCS = Path.of("..", "data", "demo", "docs");

    @Autowired
    private OfferClassifier classifier;

    @Test
    void everyDemoOfferIsRecognisedFromItsText() throws Exception {
        Map<String, String> expected = Map.of(
                "oferta-aspersie-40ha.pdf", "irigatii",
                "oferta-fotovoltaice-300kwp.pdf", "energie",
                "oferta-tractor-300cp-stage-v.pdf", "utilaje",
                "oferta-digestor-biogaz.pdf", "zootehnie",
                "oferta-agregat-frigorific.pdf", "post_recolta",
                "oferta-utilaje-bio.pdf", "ecologic");
        expected.forEach((file, module) -> {
            try {
                assertThat(classifier.classify("oferta.pdf", Files.readAllBytes(DOCS.resolve(file))))
                        .as(file).map(ModuleDefinition::moduleId).hasValue(module);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
    }

    @Test
    void anUnreadableFileWithANeutralNameIsNotClassified() {
        assertThat(classifier.classify("scan.jpg", new byte[] {1, 2, 3})).isEmpty();
    }
}
