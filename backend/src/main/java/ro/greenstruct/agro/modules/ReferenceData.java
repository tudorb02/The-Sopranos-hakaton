package ro.greenstruct.agro.modules;

import java.nio.file.Path;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.config.JsonFiles;

/** Financing lines, EU funding programmes, emission factors and prices from config/; every value carries its source. */
@Component
public class ReferenceData {

    private final JsonNode financingLines;
    private final JsonNode fundingPrograms;
    private final JsonNode factors;
    private final JsonNode prices;

    public ReferenceData(GreenStructProperties properties, ObjectMapper mapper) {
        Path config = properties.paths().configDir();
        this.financingLines = JsonFiles.read(mapper, config.resolve("financing-lines.json"));
        this.fundingPrograms = JsonFiles.read(mapper, config.resolve("funding-programs.json"));
        this.factors = JsonFiles.read(mapper, config.resolve("factors.json"));
        this.prices = JsonFiles.read(mapper, config.resolve("prices.json"));
    }

    public JsonNode financingLines() {
        return financingLines;
    }

    public JsonNode fundingPrograms() {
        return fundingPrograms;
    }

    public JsonNode factors() {
        return factors;
    }

    public JsonNode prices() {
        return prices;
    }
}
