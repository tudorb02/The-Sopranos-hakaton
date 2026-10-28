package ro.greenstruct.agro.tools.workspace;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

@Component
public class WorkspaceStore {

    private final Map<String, RunWorkspace> workspaces = new ConcurrentHashMap<>();

    public RunWorkspace forRun(String runId) {
        return workspaces.computeIfAbsent(runId, id -> new RunWorkspace());
    }
}
