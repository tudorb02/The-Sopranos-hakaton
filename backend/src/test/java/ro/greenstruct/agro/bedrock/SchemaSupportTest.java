package ro.greenstruct.agro.bedrock;

import java.nio.file.Path;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static ro.greenstruct.agro.bedrock.TestKit.MAPPER;
import static ro.greenstruct.agro.bedrock.TestKit.json;

class SchemaSupportTest {

    private static final Path CONTRACTS = Path.of("..", "contracts", "schemas");

    @TempDir
    Path dir;

    @Test
    void inlinesRefsAndDropsSchemaIdAndDefs() throws Exception {
        SchemaSupport schemas = TestKit.demoSchemas(dir);

        JsonNode flat = schemas.forBedrock(TestKit.SUBMIT);

        assertThat(flat.has("$schema")).isFalse();
        assertThat(flat.has("$id")).isFalse();
        assertThat(flat.has("$defs")).isFalse();
        assertThat(flat.toString()).doesNotContain("$ref");
        assertThat(flat.at("/properties/savingCalcId/pattern").asText()).isEqualTo("^calc_[0-9a-f]{12}$");
        assertThat(flat.at("/properties/notesRo/items/properties/calcId/type").asText()).isEqualTo("string");
        assertThat(flat.at("/properties/notesRo/items/additionalProperties").asBoolean(true)).isFalse();
        // the file on disk is untouched
        assertThat(schemas.raw(TestKit.SUBMIT).has("$defs")).isTrue();
    }

    @Test
    void keepsSiblingKeywordsNextToARef() {
        JsonNode flat = SchemaSupport.flatten(json("""
                {"type": "object", "properties": {"a": {"$ref": "#/$defs/id", "description": "mine"}},
                 "$defs": {"id": {"type": "string", "description": "generic", "maxLength": 5}}}
                """));

        assertThat(flat.at("/properties/a/type").asText()).isEqualTo("string");
        assertThat(flat.at("/properties/a/maxLength").asInt()).isEqualTo(5);
        assertThat(flat.at("/properties/a/description").asText()).isEqualTo("mine");
    }

    @Test
    void doesNotDropAPropertyCalledDefinitions() {
        JsonNode flat = SchemaSupport.flatten(json("""
                {"type": "object", "properties": {"definitions": {"type": "string"}}}
                """));

        assertThat(flat.at("/properties/definitions/type").asText()).isEqualTo("string");
    }

    @Test
    void resolvesRefsInsideRefs() {
        JsonNode flat = SchemaSupport.flatten(json("""
                {"type": "object", "properties": {"x": {"$ref": "#/$defs/outer"}},
                 "$defs": {"outer": {"type": "array", "items": {"$ref": "#/$defs/inner"}},
                           "inner": {"type": "integer"}}}
                """));

        assertThat(flat.at("/properties/x/items/type").asText()).isEqualTo("integer");
    }

    @Test
    void validatesWithTheRealValidatorAndReportsRomanianPaths() throws Exception {
        SchemaSupport schemas = TestKit.demoSchemas(dir);

        assertThat(schemas.validate(TestKit.SUBMIT,
                json("{\"verdict\":\"PASS\",\"savingCalcId\":\"calc_0123456789ab\"}"))).isEmpty();

        List<SchemaSupport.Issue> issues = schemas.validate(TestKit.SUBMIT,
                json("{\"verdict\":\"MAYBE\",\"extra\":1,\"notesRo\":[{\"text\":\"x\",\"calcId\":\"nope\"}]}"));

        assertThat(issues).extracting(SchemaSupport.Issue::messageRo).anyMatch(m -> m.contains("savingCalcId"))
                .anyMatch(m -> m.contains("extra"));
        assertThat(issues).hasSizeGreaterThanOrEqualTo(4);
    }

    @ParameterizedTest
    @ValueSource(strings = {"submit_technical_assessment", "submit_funding_recommendation",
            "submit_underwriting_report", "submit_offer_extraction"})
    void everyRealContractSchemaFlattensToAToolSchema(String name) {
        SchemaSupport schemas = new SchemaSupport(CONTRACTS, MAPPER);

        JsonNode flat = schemas.forBedrock(name);

        assertThat(flat.path("type").asText()).isEqualTo("object");
        assertThat(flat.toString()).doesNotContain("\"$ref\"", "\"$defs\"", "\"$schema\"", "\"$id\"");
        // a trivially wrong input is rejected by the real schema
        assertThat(schemas.validate(name, MAPPER.createObjectNode())).isNotEmpty();
    }
}
