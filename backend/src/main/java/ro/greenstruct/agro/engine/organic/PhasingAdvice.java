package ro.greenstruct.agro.engine.organic;

import java.math.BigDecimal;

/**
 * Result of {@link OrganicCalculator#advisePhasing}. shortfallEur is what the chosen plan's first-year gap
 * still exceeds the pre-financing capacity by (0 when covered).
 */
public record PhasingAdvice(Choice choice, boolean fullCovered, boolean phasedCovered, BigDecimal shortfallEur) {

    public enum Choice { FULL, PHASED }
}
