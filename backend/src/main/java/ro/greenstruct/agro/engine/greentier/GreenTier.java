package ro.greenstruct.agro.engine.greentier;

/** The green tiers of README §4 step 8, from the largest rate reduction to none. */
public enum GreenTier {
    VERDE_PLUS,
    VERDE,
    VERDE_CU_UPGRADE,
    CLASIC;

    /** Every tier but CLASIC gets a green loan. */
    public boolean isGreen() {
        return this != CLASIC;
    }
}
