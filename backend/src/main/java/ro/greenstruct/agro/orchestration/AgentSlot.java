package ro.greenstruct.agro.orchestration;

/**
 * The three agents in pipeline order (names as in contracts/schemas/event.json). Each one runs while the
 * dossier is in its status and must finish by calling its submit tool.
 */
public enum AgentSlot {
    TECHNICAL_AUDITOR("Auditor tehnic", RunStatus.AGENT_1, "submit_technical_assessment"),
    FUNDING_OPTIMIZER("Optimizator de finanțare", RunStatus.AGENT_2, "submit_funding_recommendation"),
    GREEN_UNDERWRITER("Underwriter verde", RunStatus.AGENT_3, "submit_underwriting_report");

    private final String label;
    private final RunStatus status;
    private final String submitTool;

    AgentSlot(String label, RunStatus status, String submitTool) {
        this.label = label;
        this.status = status;
        this.submitTool = submitTool;
    }

    public String label() {
        return label;
    }

    public RunStatus status() {
        return status;
    }

    public String submitTool() {
        return submitTool;
    }
}
