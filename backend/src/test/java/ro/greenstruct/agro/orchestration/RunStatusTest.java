package ro.greenstruct.agro.orchestration;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RunStatusTest {

    @Test
    void followsTheReadmeLifecycle() {
        assertThat(RunStatus.CREAT.canMoveTo(RunStatus.DATE_FIRMA)).isTrue();
        assertThat(RunStatus.DATE_FIRMA.canMoveTo(RunStatus.AGENT_1)).isTrue();
        assertThat(RunStatus.AGENT_3.canMoveTo(RunStatus.GATA)).isTrue();
        assertThat(RunStatus.GATA.canMoveTo(RunStatus.TRIMIS)).isTrue();
        assertThat(RunStatus.TRIMIS.canMoveTo(RunStatus.APROBAT)).isTrue();
        assertThat(RunStatus.APROBAT.canMoveTo(RunStatus.MONITORIZARE)).isTrue();
    }

    @Test
    void cannotSkipAgentsOrLeaveFinalStates() {
        assertThat(RunStatus.AGENT_1.canMoveTo(RunStatus.AGENT_3)).isFalse();
        assertThat(RunStatus.CREAT.canMoveTo(RunStatus.GATA)).isFalse();
        assertThat(RunStatus.GATA.canMoveTo(RunStatus.ESUAT)).isFalse();
        assertThat(RunStatus.GATA.canMoveTo(RunStatus.APROBAT)).isFalse();
        assertThat(RunStatus.ESUAT.canMoveTo(RunStatus.CREAT)).isFalse();
    }

    @Test
    void runIdsMatchTheContractPattern() {
        Run run = Run.create(new RunRequest("RO1", "irigatii", java.util.List.of(), null, java.util.List.of(), null),
                java.util.List.of(), null);

        assertThat(run.id()).matches("^run_[0-9a-z]{12}$");
    }
}
