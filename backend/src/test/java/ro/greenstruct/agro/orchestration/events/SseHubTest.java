package ro.greenstruct.agro.orchestration.events;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SseHubTest {

    @Test
    void numbersEventsPerRunWithoutGaps() {
        SseHub hub = new SseHub();

        hub.publish("run_a", EventType.STATE_TRANSITION, null, "unu", JsonNodeFactory.instance.objectNode());
        hub.publish("run_b", EventType.STATE_TRANSITION, null, "altul", JsonNodeFactory.instance.objectNode());
        hub.publish("run_a", EventType.RUN_COMPLETED, null, "doi", JsonNodeFactory.instance.objectNode());

        assertThat(hub.history("run_a")).extracting(RunEvent::seq).containsExactly(1L, 2L);
        assertThat(hub.history("run_b")).extracting(RunEvent::seq).containsExactly(1L);
    }

    @Test
    void lateSubscribersStillGetAnEmitter() {
        SseHub hub = new SseHub();
        hub.publish("run_a", EventType.STATE_TRANSITION, null, "unu", JsonNodeFactory.instance.objectNode());

        assertThat(hub.subscribe("run_a", 0)).isNotNull();
        assertThat(hub.subscribe("run_a", 1)).isNotNull();
    }
}
