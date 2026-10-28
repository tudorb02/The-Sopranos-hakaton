package ro.greenstruct.agro.orchestration;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;

import org.springframework.stereotype.Component;

/** In-memory dossiers; enough for the demo, replaceable by a database behind the same methods. */
@Component
public class RunStore {

    private final Map<String, Run> runs = new ConcurrentHashMap<>();

    public Run save(Run run) {
        runs.put(run.id(), run);
        return run;
    }

    public Optional<Run> find(String id) {
        return Optional.ofNullable(runs.get(id));
    }

    /** Every dossier, oldest first. */
    public java.util.List<Run> all() {
        return runs.values().stream().sorted(java.util.Comparator.comparing(Run::createdAt)).toList();
    }

    /** Atomic read-modify-write of one dossier. */
    public Run update(String id, UnaryOperator<Run> change) {
        Run updated = runs.computeIfPresent(id, (key, run) -> change.apply(run));
        if (updated == null) {
            throw new RunNotFoundException(id);
        }
        return updated;
    }
}
