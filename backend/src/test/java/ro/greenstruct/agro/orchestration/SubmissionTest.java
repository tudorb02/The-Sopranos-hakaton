package ro.greenstruct.agro.orchestration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Which option of submit_funding_recommendation each of the two cards sends (README §7 and §13). */
class SubmissionTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static JsonNode funding(String recommended, boolean greenEligible) throws JsonProcessingException {
        return MAPPER.readTree("""
                {"recommendedOptionId": "%s", "options": [
                  {"optionId": "A", "kind": "STANDARD", "greenEligible": false},
                  {"optionId": "B", "kind": "GREEN_PACKAGE", "greenEligible": %s},
                  {"optionId": "C", "kind": "GREEN_PACKAGE_WITH_GRANT", "greenEligible": %s}]}
                """.formatted(recommended, greenEligible, greenEligible));
    }

    @Test
    void optionKindsMapToTheTwoCards() {
        assertThat(Submission.Variant.ofKind("STANDARD")).isEqualTo(Submission.Variant.CLASIC);
        assertThat(Submission.Variant.ofKind("GREEN_PACKAGE")).isEqualTo(Submission.Variant.VERDE);
        assertThat(Submission.Variant.ofKind("GREEN_PACKAGE_WITH_GRANT")).isEqualTo(Submission.Variant.VERDE);
        assertThat(Submission.Variant.ofKind("")).isNull();
    }

    @Test
    void theGreenCardSendsTheRecommendedGreenOption() throws JsonProcessingException {
        assertThat(RunOrchestrator.optionFor(funding("C", true), Submission.Variant.VERDE)).contains("C");
        assertThat(RunOrchestrator.optionFor(funding("C", true), Submission.Variant.CLASIC)).contains("A");
    }

    @Test
    void whenTheClassicOptionIsRecommendedTheGreenCardSendsTheFirstGreenOption() throws JsonProcessingException {
        assertThat(RunOrchestrator.optionFor(funding("A", true), Submission.Variant.VERDE)).contains("B");
    }

    @Test
    void thereIsNoGreenCardWithoutAGreenEligibleOption() throws JsonProcessingException {
        assertThat(RunOrchestrator.optionFor(funding("A", false), Submission.Variant.VERDE)).isEmpty();
        assertThat(RunOrchestrator.optionFor(MissingNode.getInstance(), Submission.Variant.CLASIC)).isEmpty();
    }
}
