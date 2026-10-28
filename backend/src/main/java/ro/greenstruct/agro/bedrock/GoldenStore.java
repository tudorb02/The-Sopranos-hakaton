package ro.greenstruct.agro.bedrock;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import ro.greenstruct.agro.orchestration.AgentSlot;

/** Recorded agent runs on disk: data/demo/golden/&lt;scenario&gt;/&lt;slot&gt;.json (slot in lower case). */
public class GoldenStore {

    private final Path root;
    private final ObjectMapper mapper;

    public GoldenStore(Path root, ObjectMapper mapper) {
        this.root = root;
        this.mapper = mapper.copy().enable(SerializationFeature.INDENT_OUTPUT);
    }

    public Path fileFor(String scenario, AgentSlot slot) {
        return root.resolve(safe(scenario)).resolve(slot.name().toLowerCase() + ".json");
    }

    public Optional<Recording> find(String scenario, AgentSlot slot) {
        Path file = fileFor(scenario, slot);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            Recording recording = mapper.readValue(file.toFile(), Recording.class);
            if (recording.version() != Recording.VERSION) {
                throw new IllegalStateException("Unsupported golden version " + recording.version() + " in " + file);
            }
            return Optional.of(recording);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read golden file " + file, e);
        }
    }

    public Path write(String scenario, AgentSlot slot, Recording recording) {
        Path file = fileFor(scenario, slot);
        try {
            Files.createDirectories(file.getParent());
            mapper.writeValue(file.toFile(), recording);
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write golden file " + file, e);
        }
    }

    private static String safe(String scenario) {
        if (!scenario.matches("[a-z0-9_-]{1,40}")) {
            throw new IllegalArgumentException("Invalid scenario name " + scenario);
        }
        return scenario;
    }
}
