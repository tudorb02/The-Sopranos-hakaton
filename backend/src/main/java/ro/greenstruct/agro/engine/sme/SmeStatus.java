package ro.greenstruct.agro.engine.sme;

/** Whether the company is an SME (IMM), the F1 requirement of README §3.2; UNKNOWN when the balance sheet lacks the figures. */
public enum SmeStatus {
    SME,
    NOT_SME,
    UNKNOWN
}
