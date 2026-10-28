package ro.greenstruct.agro.modules;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ModuleDefinitionTest {

    @Autowired
    private ModuleRegistry modules;

    @Test
    void aModuleIsReadyForAnalysisOnlyWithACalculator() {
        ModuleDefinition withoutCalculator = new ModuleDefinition("x", "X", "", "CONFIG_ONLY", "", List.of(), "I", null,
                List.of(), null, null, null, "WATER_MARINE_RESOURCES", List.of(), List.of(), Map.of(), null, null, null);

        assertThat(withoutCalculator.demoReady()).isFalse();
    }

    @Test
    void allSixCategoriesAreReady() {
        assertThat(modules.all()).extracting(ModuleDefinition::moduleId)
                .containsExactlyInAnyOrder("irigatii", "energie", "utilaje", "zootehnie", "post_recolta", "ecologic");
        assertThat(modules.all()).allMatch(ModuleDefinition::demoReady);
    }
}
