package ro.greenstruct.agro.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Reads the JSON files under config/ and data/; a missing or broken file fails startup with its path. */
public final class JsonFiles {

    private JsonFiles() {
    }

    public static JsonNode read(ObjectMapper mapper, Path file) {
        if (!Files.isRegularFile(file)) {
            throw new IllegalStateException("Missing JSON file: " + file.toAbsolutePath().normalize());
        }
        try {
            return mapper.readTree(file.toFile());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot parse " + file.toAbsolutePath().normalize(), e);
        }
    }

    public static List<Path> listJson(Path directory) {
        if (!Files.isDirectory(directory)) {
            throw new IllegalStateException("Missing directory: " + directory.toAbsolutePath().normalize());
        }
        try (Stream<Path> files = Files.list(directory)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".json")).sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot list " + directory.toAbsolutePath().normalize(), e);
        }
    }
}
