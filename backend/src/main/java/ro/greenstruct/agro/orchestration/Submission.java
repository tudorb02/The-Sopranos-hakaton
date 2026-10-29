package ro.greenstruct.agro.orchestration;

import java.time.Instant;

/** The offer the farmer sent to the bank (Submission in contracts/openapi.yaml). */
public record Submission(Variant variant, String optionId, Instant submittedAt) {

    /** The two cards of README §7; each maps to the kind of an option in submit_funding_recommendation. */
    public enum Variant {
        CLASIC("Classic credit"), VERDE("Green credit");

        private final String labelRo;

        Variant(String labelRo) {
            this.labelRo = labelRo;
        }

        public String labelRo() {
            return labelRo;
        }

        /** STANDARD → CLASIC; GREEN_PACKAGE and GREEN_PACKAGE_WITH_GRANT → VERDE; anything else → null. */
        public static Variant ofKind(String kind) {
            return switch (kind) {
                case "STANDARD" -> CLASIC;
                case "GREEN_PACKAGE", "GREEN_PACKAGE_WITH_GRANT" -> VERDE;
                default -> null;
            };
        }
    }
}
