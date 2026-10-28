package ro.greenstruct.agro.tools;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import ro.greenstruct.agro.farm.FarmProfile;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.tools.workspace.RunWorkspace;

/** Everything one tool call may read, plus the calcs it creates. One context per call. */
public class ToolContext {

    private final String tool;
    private final Run run;
    private final ModuleDefinition module;
    private final JsonNode catalog;
    private final RunWorkspace workspace;
    private final ReferenceData reference;
    private final LocalDate today;
    private final ObjectMapper mapper;
    private final CalcStore calcStore;
    private final List<Calc> created = new ArrayList<>();

    public ToolContext(String tool, Run run, ModuleDefinition module, JsonNode catalog, RunWorkspace workspace,
                       ReferenceData reference, LocalDate today, ObjectMapper mapper, CalcStore calcStore) {
        this.tool = tool;
        this.run = run;
        this.module = module;
        this.catalog = catalog;
        this.workspace = workspace;
        this.reference = reference;
        this.today = today;
        this.mapper = mapper;
        this.calcStore = calcStore;
    }

    public Run run() {
        return run;
    }

    public FarmProfile farm() {
        if (run.farmProfile() == null) {
            throw new IllegalStateException("Datele fermei nu sunt încă încărcate");
        }
        return run.farmProfile();
    }

    public ModuleDefinition module() {
        return module;
    }

    /** The module's upgrade catalog (data/catalog/&lt;module&gt;.json); an empty object for config-only modules. */
    public JsonNode catalog() {
        return catalog;
    }

    public RunWorkspace workspace() {
        return workspace;
    }

    public ReferenceData reference() {
        return reference;
    }

    public LocalDate today() {
        return today;
    }

    public JsonNode questionnaire() {
        return run.request().questionnaire() == null ? mapper.createObjectNode() : run.request().questionnaire();
    }

    /** A module parameter from config/modules/&lt;id&gt;.json (parameters.&lt;name&gt;.value). */
    public BigDecimal param(String name) {
        return Params.value(module.parameters().path(name), "parameters." + name);
    }

    public String paramSource(String name) {
        return module.parameters().path(name).path("sourceRo").asText(null);
    }

    public ObjectNode newResult() {
        return mapper.createObjectNode();
    }

    public ObjectMapper mapper() {
        return mapper;
    }

    public CalcDraft calc(String key, String labelRo, BigDecimal value, Unit unit) {
        return new CalcDraft(key, labelRo, value, unit);
    }

    public ToolOutput ok(JsonNode result, String messageRo) {
        return new ToolOutput(true, created, result, messageRo);
    }

    List<Calc> created() {
        return List.copyOf(created);
    }

    /** Builder so every calc can carry its formula, source and the calcs it depends on. */
    public final class CalcDraft {

        private final String key;
        private final String labelRo;
        private final BigDecimal value;
        private final Unit unit;
        private String formula;
        private String sourceRo;
        private final List<String> dependsOn = new ArrayList<>();
        private List<Calc.SeriesPoint> series;

        private CalcDraft(String key, String labelRo, BigDecimal value, Unit unit) {
            this.key = key;
            this.labelRo = labelRo;
            this.value = value;
            this.unit = unit;
        }

        public CalcDraft formula(String formula) {
            this.formula = formula;
            return this;
        }

        public CalcDraft source(String sourceRo) {
            this.sourceRo = sourceRo;
            return this;
        }

        public CalcDraft dependsOn(Calc... calcs) {
            Arrays.stream(calcs).map(Calc::calcId).forEach(dependsOn::add);
            return this;
        }

        public CalcDraft series(List<Calc.SeriesPoint> points) {
            this.series = points;
            return this;
        }

        public Calc add() {
            Calc calc = calcStore.create(run.id(), tool, key, labelRo, value, unit, formula, sourceRo, dependsOn, series);
            created.add(calc);
            return calc;
        }
    }
}
