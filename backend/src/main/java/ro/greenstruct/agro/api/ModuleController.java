package ro.greenstruct.agro.api;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;

@RestController
@RequestMapping("/api/modules")
public class ModuleController {

    private final ModuleRegistry modules;

    public ModuleController(ModuleRegistry modules) {
        this.modules = modules;
    }

    /** The Module schema from contracts/openapi.yaml; backend-only config stays on the server. */
    public record ModuleView(String moduleId, String nameRo, String icon, String status, String descriptionRo,
                             List<String> examplesRo, String indicator, ModuleDefinition.Threshold threshold,
                             List<ModuleDefinition.RequiredDoc> requiredDocs, JsonNode questionnaire) {

        static ModuleView of(ModuleDefinition m) {
            return new ModuleView(m.moduleId(), m.nameRo(), m.icon(), m.status(), m.descriptionRo(), m.examplesRo(),
                    m.indicator(), m.threshold(), m.requiredDocs(), m.questionnaire());
        }
    }

    @GetMapping
    public List<ModuleView> list() {
        return modules.all().stream().map(ModuleView::of).toList();
    }

    @GetMapping("/{moduleId}")
    public ModuleView get(@PathVariable String moduleId) {
        return modules.find(moduleId).map(ModuleView::of)
                .orElseThrow(() -> new NotFoundException("Module " + moduleId + " does not exist"));
    }
}
