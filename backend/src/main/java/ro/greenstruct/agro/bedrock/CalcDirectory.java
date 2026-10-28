package ro.greenstruct.agro.bedrock;

import java.util.List;
import java.util.Optional;

import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;

/**
 * The calcs of one dossier, seen by calcId or by their stable name "tool/key". A recording stores the name,
 * a replay maps it back to the calcId of the current run (calcIds depend on the run id).
 */
public interface CalcDirectory {

    boolean exists(String calcId);

    /** "tool/key" of a calc, empty if the id is unknown. */
    Optional<String> nameOf(String calcId);

    /** calcId of the most recent calc with this "tool/key", empty if none has been produced yet. */
    Optional<String> idOf(String name);

    static String name(String tool, String key) {
        return tool + "/" + key;
    }

    static CalcDirectory of(CalcStore store, String runId) {
        return new CalcDirectory() {
            @Override
            public boolean exists(String calcId) {
                return store.find(runId, calcId).isPresent();
            }

            @Override
            public Optional<String> nameOf(String calcId) {
                return store.find(runId, calcId).map(calc -> name(calc.tool(), calc.key()));
            }

            @Override
            public Optional<String> idOf(String name) {
                List<Calc> all = store.all(runId);
                for (int i = all.size() - 1; i >= 0; i--) {
                    if (name(all.get(i).tool(), all.get(i).key()).equals(name)) {
                        return Optional.of(all.get(i).calcId());
                    }
                }
                return Optional.empty();
            }
        };
    }
}
