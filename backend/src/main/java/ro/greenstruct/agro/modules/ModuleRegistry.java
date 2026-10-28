package ro.greenstruct.agro.modules;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;

/** Loads every module from config/modules and, for demo-ready modules, its upgrade catalog from data/. */
@Component
public class ModuleRegistry {

    private final Map<String, ModuleDefinition> modules = new LinkedHashMap<>();
    private final Map<String, JsonNode> catalogs = new LinkedHashMap<>();

    public ModuleRegistry(GreenStructProperties properties, ObjectMapper mapper) {
        Path dataDir = properties.paths().dataDir();
        for (Path file : JsonFiles.listJson(properties.paths().configDir().resolve("modules"))) {
            ModuleDefinition module = toModule(mapper, file);
            modules.put(module.moduleId(), module);
            if (module.catalog() != null) {
                catalogs.put(module.moduleId(), JsonFiles.read(mapper, dataDir.resolve(module.catalog())));
            }
        }
    }

    /** The order of README §6: irrigation, energy, machinery, livestock, post-harvest, organic. */
    private static final List<String> README_ORDER = List.of("irigatii", "energie", "utilaje", "zootehnie",
            "post_recolta", "ecologic");

    public List<ModuleDefinition> all() {
        return modules.values().stream().sorted(java.util.Comparator.comparingInt(m -> {
            int index = README_ORDER.indexOf(m.moduleId());
            return index < 0 ? README_ORDER.size() : index;
        })).toList();
    }

    public Optional<ModuleDefinition> find(String moduleId) {
        return Optional.ofNullable(modules.get(moduleId));
    }

    public ModuleDefinition require(String moduleId) {
        return find(moduleId).orElseThrow(() -> new IllegalArgumentException("Modul necunoscut: " + moduleId));
    }

    public Optional<JsonNode> catalog(String moduleId) {
        return Optional.ofNullable(catalogs.get(moduleId));
    }

    private static ModuleDefinition toModule(ObjectMapper mapper, Path file) {
        try {
            return mapper.treeToValue(JsonFiles.read(mapper, file), ModuleDefinition.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Invalid module definition " + file, e);
        }
    }
}
