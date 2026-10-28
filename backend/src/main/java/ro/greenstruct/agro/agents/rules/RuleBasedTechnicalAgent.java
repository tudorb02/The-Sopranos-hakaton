package ro.greenstruct.agro.agents.rules;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.upgrade.UpgradeSelector;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.orchestration.Agent;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentFailureException;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.storage.StoredDocument;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.ToolRegistry;
import ro.greenstruct.agro.tools.technical.ModuleCalculator;
import ro.greenstruct.agro.tools.technical.ModuleCalculators;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

/**
 * Agent 1 without a model: the same tools in the same order as the Bedrock auditor, with the decisions (which upgrade,
 * which DNSH status) taken by rules. Used for the offline demo and in tests; its submit output is validated against
 * the same schema as the model's.
 */
@Component
@ConditionalOnProperty(name = "greenstruct.agents.rule-based", havingValue = "true")
public class RuleBasedTechnicalAgent implements Agent {

    private static final String INITIAL = "cfg_initial";
    private static final String RECOMMENDED = "cfg_recommended";
    private static final Set<String> COMPONENT_CATEGORIES = Set.of("IRRIGATION_SPRINKLER", "IRRIGATION_DRIP",
            "SOIL_MOISTURE_SENSORS", "PUMP", "SOLAR_PUMP", "WATER_METER", "PIPES", "PV_SYSTEM", "TRACTOR", "COMBINE",
            "PRECISION_PACKAGE", "PRECISION_GUIDANCE", "PRECISION_SECTION_CONTROL", "PRECISION_VARIABLE_RATE",
            "IMPLEMENT", "BUILDING", "INSTALLATION_WORKS", "OTHER");

    private final ToolRegistry tools;
    private final CalcStore calcs;
    private final ModuleRegistry modules;
    private final ModuleCalculators calculators;
    private final WorkspaceStore workspaces;
    private final ReferenceData reference;
    private final ObjectMapper mapper;

    public RuleBasedTechnicalAgent(ToolRegistry tools, CalcStore calcs, ModuleRegistry modules,
                                   ModuleCalculators calculators, WorkspaceStore workspaces, ReferenceData reference,
                                   ObjectMapper mapper) {
        this.tools = tools;
        this.calcs = calcs;
        this.modules = modules;
        this.calculators = calculators;
        this.workspaces = workspaces;
        this.reference = reference;
        this.mapper = mapper;
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public String modelId() {
        return "rule-based";
    }

    @Override
    public AgentResult run(Run run, AgentContext context) {
        ToolFlow flow = new ToolFlow(run, context, tools, calcs, mapper);
        ModuleDefinition module = modules.require(run.request().moduleId());
        ModuleCalculator calculator = calculators.require(module.calculator());

        ToolOutput rules = flow.call("get_module_rules", flow.input(), "Încarc regulile modulului " + module.nameRo());
        String thresholdCalcId = rules.calcs().stream().filter(c -> c.key().startsWith("rules.threshold"))
                .map(Calc::calcId).findFirst().orElseThrow(() -> new AgentFailureException("AGENT_MISSING_CALC",
                        "Modulul nu publică pragul verde (rules.threshold.*)", false, null));

        String offerId = null;
        for (StoredDocument document : run.request().documents()) {
            flow.call("extract_document", flow.input().put("documentId", document.documentId()),
                    "Citesc documentul " + document.fileName());
            if (offerId == null && "OFFER".equals(document.docType())) {
                offerId = document.documentId();
            }
        }
        if (offerId == null) {
            throw new AgentFailureException("OFFER_MISSING", "Dosarul nu conține oferta investiției", false, null);
        }

        ToolOutput baseline = flow.call("compute_baseline", flow.input(), "Calculez situația actuală");
        ToolOutput initial = flow.call("compute_indicator", flow.input().put("configId", INITIAL)
                .put("documentId", offerId), "Calculez indicatorul investiției cerute");

        String recommendedId = INITIAL;
        String type = "KEEP_INITIAL";
        if (!"PASS".equals(initial.result().path("thresholdResult").asText())) {
            Optional<Pick> pick = searchUpgrade(flow, module);
            if (pick.isPresent()) {
                ObjectNode simulate = flow.input().put("baseConfigId", INITIAL).put("configId", RECOMMENDED);
                ArrayNode addNode = simulate.putArray("add");
                pick.get().catalogIds().forEach(addNode::add);
                ToolOutput simulated = flow.call("simulate_upgrade_package", simulate,
                        "Simulez pachetul de upgrade " + pick.get().candidate().id());
                if ("PASS".equals(simulated.result().path("thresholdResult").asText())) {
                    recommendedId = RECOMMENDED;
                    type = "UPGRADE_TO_PASS";
                } else {
                    type = "NO_FEASIBLE_UPGRADE";
                }
            } else {
                type = "NO_FEASIBLE_UPGRADE";
            }
        }

        ToolOutput dnsh = flow.call("check_dnsh_inputs", flow.input().put("configId", recommendedId),
                "Verific datele pentru DNSH");

        ObjectNode output = assemble(flow, module, calculator, run, baseline, thresholdCalcId, recommendedId, type, dnsh);
        flow.thought("Evaluarea tehnică e gata: " + output.path("summaryRo").asText());
        return new AgentResult(output, "LIVE", flow.iterations());
    }

    private record Pick(UpgradeSelector.Candidate candidate, List<String> catalogIds) {
    }

    private Optional<Pick> searchUpgrade(ToolFlow flow, ModuleDefinition module) {
        ToolOutput search = flow.call("search_upgrades", flow.input().put("baseConfigId", INITIAL),
                "Caut cel mai ieftin pachet de upgrade care trece pragul");
        Map<String, Calc> byKey = new HashMap<>();
        search.calcs().forEach(c -> byKey.put(c.key(), c));
        List<UpgradeSelector.Candidate> candidates = new ArrayList<>();
        Map<String, List<String>> catalogIds = new HashMap<>();
        for (JsonNode candidate : search.result().path("candidates")) {
            String packageId = candidate.path("packageId").asText();
            String key = "cand." + packageId.substring("pkg_".length());
            Calc pct = byKey.get(key + ".pct");
            Calc cost = byKey.get(key + ".cost");
            if (pct == null || cost == null) {
                continue;
            }
            List<String> ids = new ArrayList<>();
            candidate.path("catalogIds").forEach(id -> ids.add(id.asText()));
            catalogIds.put(packageId, ids);
            candidates.add(new UpgradeSelector.Candidate(packageId, cost.value(), pct.value(),
                    "PASS".equals(candidate.path("thresholdResult").asText()),
                    candidate.path("meetsSafetyMargin").asBoolean()));
        }
        boolean percent = "MIN_PCT".equals(module.threshold().kind());
        JsonNode tiers = reference.pricing().path("greenTiers");
        return UpgradeSelector.select(candidates, percent ? module.threshold().value() : null,
                percent ? Params.value(tiers.path("verdePlusThresholdMultiplier"), "verdePlusThresholdMultiplier") : null,
                percent ? Params.value(tiers.path("verdePlusMaxExtraCostPct"), "verdePlusMaxExtraCostPct") : null)
                .map(pick -> new Pick(pick, catalogIds.get(pick.id())));
    }

    private ObjectNode assemble(ToolFlow flow, ModuleDefinition module, ModuleCalculator calculator, Run run,
                                ToolOutput baseline, String thresholdCalcId, String recommendedId, String type,
                                ToolOutput dnsh) {
        ObjectNode out = mapper.createObjectNode();
        out.put("moduleId", module.moduleId());
        out.put("indicator", module.indicator());
        ObjectNode threshold = out.putObject("threshold");
        threshold.put("thresholdCalcId", thresholdCalcId);
        threshold.put("sourceRo", cut(module.threshold().sourceRo(), 240));

        ObjectNode base = out.putObject("baseline");
        String source = baseline.result().path("dataSource").asText("NORMS");
        base.put("dataSource", "NORMS".equals(source) ? "NORM" : source);
        base.put("descriptionRo", cut("Situația actuală pe parcelele alese, din " + ("NORM".equals(
                base.path("dataSource").asText()) ? "norme și chestionar" : "facturi și norme"), 400));
        ArrayNode baseMetrics = base.putArray("metrics");
        calculator.baselineMetrics().forEach((key, metric) -> flow.idIfPresent(key).ifPresent(id ->
                baseMetrics.addObject().put("metric", metric).put("calcId", id)));

        ArrayNode configurations = out.putArray("configurations");
        for (Configuration cfg : workspaces.forRun(run.id()).configurations()) {
            if (configurations.size() >= 4) {
                break;
            }
            configurations.add(configuration(flow, calculator, cfg, recommendedId));
        }
        out.put("initialConfigId", INITIAL);
        out.put("recommendedConfigId", recommendedId);
        out.put("recommendationType", type);

        ArrayNode checks = out.putArray("dnshChecks");
        List<String> missing = new ArrayList<>();
        for (ModuleDefinition.DnshCheck check : module.dnsh()) {
            DnshRules.Outcome outcome = DnshRules.evaluate(check, dnsh.result());
            ObjectNode row = checks.addObject();
            row.put("objective", check.objective());
            row.put("status", outcome.status().name());
            ArrayNode evidence = row.putArray("evidence");
            outcome.evidence().forEach(evidence::add);
            row.put("noteRo", cut(outcome.noteRo(), 400));
        }
        out.set("sizingCheck", sizing(flow, recommendedId));
        out.set("missingFields", missingFields(run, dnsh.result()));

        Calc indicator = flow.calc(recommendedId + ".indicator").orElseThrow();
        out.put("summaryRo", cut("Investiția " + ("KEEP_INITIAL".equals(type) ? "cerută" : "recomandată")
                + " atinge " + indicator.display() + " din indicatorul verde ("
                + ("NO_FEASIBLE_UPGRADE".equals(type) ? "nu trece pragul, nu am găsit un upgrade" : "trece pragul") + ").", 800));
        out.put("farmerMessageRo", cut(farmerMessage(flow, module, type, indicator), 400));
        return out;
    }

    private ObjectNode configuration(ToolFlow flow, ModuleCalculator calculator, Configuration cfg, String recommendedId) {
        ObjectNode node = mapper.createObjectNode();
        String id = cfg.configId();
        node.put("configId", id);
        node.put("role", INITIAL.equals(id) ? "INITIAL" : id.equals(recommendedId) ? "RECOMMENDED" : "ALTERNATIVE");
        node.put("titleRo", cut(INITIAL.equals(id) ? "Investiția din ofertă" : "Investiția cu upgrade", 120));
        ArrayNode components = node.putArray("components");
        for (InvestmentComponent c : cfg.components()) {
            ObjectNode row = components.addObject();
            row.put("componentId", c.componentId());
            row.put("category", COMPONENT_CATEGORIES.contains(c.category()) ? c.category() : "OTHER");
            row.put("nameRo", cut(c.nameRo(), 160));
            row.put("source", "OFFER".equals(c.source()) ? "OFFER" : "CATALOG_UPGRADE");
            if (c.catalogId() != null) {
                row.put("catalogId", c.catalogId());
            }
            row.put("costCalcId", flow.id(id + ".cmp." + c.componentId() + ".cost"));
        }
        node.put("totalCostCalcId", flow.id(id + ".total_cost"));
        flow.idIfPresent(id + ".upgrade_cost").ifPresent(calc -> node.put("upgradeCostCalcId", calc));
        node.put("indicatorCalcId", flow.id(id + ".indicator"));
        node.put("thresholdResult", cfg.passesThreshold() ? "PASS" : "FAIL");
        ArrayNode impacts = node.putArray("impacts");
        calculator.impactMetrics().forEach((suffix, metric) -> flow.idIfPresent(id + "." + suffix).ifPresent(calc ->
                impacts.addObject().put("metric", metric).put("calcId", calc)));
        return node;
    }

    private ObjectNode sizing(ToolFlow flow, String configId) {
        ObjectNode node = mapper.createObjectNode();
        Optional<String> hp = flow.idIfPresent(configId + ".hp_per_ha");
        if (hp.isEmpty()) {
            node.put("status", "NOT_APPLICABLE");
            node.put("noteRo", "Modulul nu are regulă de dimensionare");
            return node;
        }
        boolean ok = workspaces.forRun(flow.run().id()).configuration(configId).passesThreshold();
        node.put("status", ok ? "PASS" : "FAIL");
        node.put("calcId", hp.get());
        node.put("noteRo", ok ? "Puterea pe hectar e în limita programului" : "Puterea pe hectar depășește limita");
        return node;
    }

    private ArrayNode missingFields(Run run, JsonNode dnshFacts) {
        ArrayNode fields = mapper.createArrayNode();
        for (String docType : run.missingDocuments()) {
            fields.addObject().put("fieldKey", docType.toLowerCase()).put("labelRo", "Document lipsă: " + docType)
                    .put("requiredFor", "DISBURSEMENT").put("docType", docType).put("blocking", false);
        }
        if (dnshFacts.has("permitPresent") && !dnshFacts.path("permitPresent").asBoolean()
                && run.missingDocuments().stream().noneMatch("WATER_PERMIT_ANAR"::equals)) {
            fields.addObject().put("fieldKey", "water_permit").put("labelRo", "Autorizația de gospodărire a apelor")
                    .put("requiredFor", "DNSH").put("docType", "WATER_PERMIT_ANAR").put("blocking", false);
        }
        return fields;
    }

    private static String farmerMessage(ToolFlow flow, ModuleDefinition module, String type, Calc indicator) {
        return switch (type) {
            case "KEEP_INITIAL" -> "Investiția cerută atinge " + indicator.display() + " și trece pragul verde.";
            case "UPGRADE_TO_PASS" -> "Investiția cerută nu atinge pragul verde. Cu upgrade-ul propus ajungi la "
                    + indicator.display() + ".";
            default -> "Investiția nu atinge pragul verde și nu am găsit un upgrade potrivit; poți continua cu creditul clasic.";
        };
    }

    static String cut(String text, int max) {
        return text == null ? "" : text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
