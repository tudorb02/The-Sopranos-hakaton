package ro.greenstruct.agro.orchestration.events;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import ro.greenstruct.agro.orchestration.AgentSlot;

/**
 * Keeps every event of a dossier and fans it out to the open SSE connections. A client that connects late
 * or reconnects with Last-Event-ID gets the events it missed, so the farmer and officer screens never drift.
 * As the contract says, a stream closes after run.completed or run.failed; later officer transitions stay in
 * the buffer for the next connection.
 */
@Component
public class SseHub {

    private final Map<String, Channel> channels = new ConcurrentHashMap<>();

    public RunEvent publish(String runId, EventType type, AgentSlot agent, String message, JsonNode data) {
        return channel(runId).append(type, agent, message, data);
    }

    public SseEmitter subscribe(String runId, long afterSeq) {
        SseEmitter emitter = new SseEmitter(0L);
        channel(runId).attach(emitter, afterSeq);
        return emitter;
    }

    public List<RunEvent> history(String runId) {
        return channel(runId).history();
    }

    public long lastSeq(String runId) {
        return channel(runId).lastSeq();
    }

    /** SSE comment every 15 s so proxies and browsers keep idle connections open. */
    @Scheduled(fixedRate = 15_000)
    public void heartbeat() {
        channels.values().forEach(Channel::heartbeat);
    }

    private Channel channel(String runId) {
        return channels.computeIfAbsent(runId, Channel::new);
    }

    private static boolean terminal(EventType type) {
        return type == EventType.RUN_COMPLETED || type == EventType.RUN_FAILED;
    }

    private static final class Channel {

        private final String runId;
        private final List<RunEvent> history = new CopyOnWriteArrayList<>();
        private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();
        private long seq;

        private Channel(String runId) {
            this.runId = runId;
        }

        synchronized RunEvent append(EventType type, AgentSlot agent, String message, JsonNode data) {
            RunEvent event = new RunEvent(++seq, runId, type, agent, Instant.now(), message, data);
            history.add(event);
            emitters.removeIf(emitter -> !send(emitter, event));
            if (terminal(type)) {
                emitters.forEach(SseEmitter::complete);
                emitters.clear();
            }
            return event;
        }

        synchronized void attach(SseEmitter emitter, long afterSeq) {
            for (RunEvent event : history) {
                if (event.seq() > afterSeq && !send(emitter, event)) {
                    return;
                }
            }
            if (history.stream().anyMatch(event -> terminal(event.type()))) {
                emitter.complete();
                return;
            }
            emitters.add(emitter);
            emitter.onCompletion(() -> emitters.remove(emitter));
            emitter.onTimeout(() -> emitters.remove(emitter));
            emitter.onError(error -> emitters.remove(emitter));
        }

        List<RunEvent> history() {
            return List.copyOf(history);
        }

        synchronized long lastSeq() {
            return seq;
        }

        synchronized void heartbeat() {
            emitters.removeIf(emitter -> {
                try {
                    emitter.send(SseEmitter.event().comment("heartbeat"));
                    return false;
                } catch (IOException | IllegalStateException e) {
                    return true;
                }
            });
        }

        private static boolean send(SseEmitter emitter, RunEvent event) {
            try {
                emitter.send(SseEmitter.event().id(Long.toString(event.seq())).data(event, MediaType.APPLICATION_JSON));
                return true;
            } catch (IOException | IllegalStateException e) {
                return false;
            }
        }
    }
}
