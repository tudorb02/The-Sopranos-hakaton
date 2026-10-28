package ro.greenstruct.agro.external.mock;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;
import ro.greenstruct.agro.external.Cui;

/** Demo farms from data/demo/farms/*.json; one file per CUI feeds the ANAF, APIA and Open Banking mocks. */
@Component
public class DemoFarmRepository {

    private final Map<String, JsonNode> farmsByCui = new HashMap<>();

    public DemoFarmRepository(GreenStructProperties properties, ObjectMapper mapper) {
        Path dir = properties.paths().dataDir().resolve("demo").resolve("farms");
        for (Path file : JsonFiles.listJson(dir)) {
            JsonNode farm = JsonFiles.read(mapper, file);
            farmsByCui.put(Cui.normalize(farm.path("cui").asText()), farm);
        }
    }

    public Optional<JsonNode> find(String cui) {
        return Optional.ofNullable(farmsByCui.get(Cui.normalize(cui)));
    }
}
