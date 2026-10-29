package ro.greenstruct.agro.agents.rules;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.upgrade.UpgradeSelector;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ReferenceData;
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
public class RuleBasedTechnicalAgent implements RuleAgent {

    private static final String INITIAL = "cfg_initial";
    private static final String RECOMMENDED = "cfg_recommended";
    private static final Set<String> COMPONENT_CATEGORIES = Set.of("IRRIGATION_SPRINKLER", "IRRIGATION_DRIP",
            "SOIL_MOISTURE_SENSORS", "PUMP", "SOLAR_PUMP", "WATER_METER", "PIPES", "PV_SYSTEM", "TRACTOR", "COMBINE",
            "PRECISION_PACKAGE", "PRECISION_GUIDANCE", "PRECISION_SECTION_CONTROL", "PRECISION_VARIABLE_RATE",
            "IMPLEMENT", "BUILDING", "INSTALLATION_WORKS", "DIGESTER", "COGENERATION", "DIGESTATE_COVER",
            "REFRIGERATION_UNIT", "INSULATION_PANELS", "HEAT_RECOVERY", "DRYER", "GREENHOUSE_SCREEN", "OTHER");

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
    public AgentResult run(Run run, AgentContext context) {
        ToolFlow flow = new ToolFlow(run, context, tools, calcs, mapper);
        ModuleDefinition module = modules.require(run.request().moduleId());
        ModuleCalculator calculator = calculators.require(module.calculator());

        ToolOutput rules = flow.call("get_module_rules", flow.input(), "Loading the module rules: " + module.nameRo());
        String thresholdCalcId = thresholdCalc(rules);

        String offerId = null;
        for (StoredDocument document : run.request().documents()) {
            flow.call("extract_document", flow.input().put("documentId", document.documentId()),
                    "Reading document " + document.fileName());
            if (offerId == null && "OFFER".equals(document.docType())) {
                offerId = document.documentId();
            }
        }
        if (offerId == null) {
            throw new AgentFailureException("OFFER_MISSING", "The dossier does not contain the investment offer", false, null);
        }

        ToolOutput baseline = flow.call("compute_baseline", flow.input(), "Calculating the current situation");
        ToolOutput initial = flow.call("compute_indicator", flow.input().put("configId", INITIAL)
                .put("documentId", offerId), "Calculating the indicator of the requested investment");

        // Organic: full against phased conversion, the guidance moment of the category (README §6, cat. 6).
        ToolOutput plans = "organic".equals(module.calculator()) && tools.find("compare_conversion_plans").isPresent()
                ? flow.tryCall("compare_conversion_plans", flow.input(), "Comparing full and phased conversion")
                : null;
        boolean phased = plans != null && plans.ok() && "PHASED".equals(plans.result().path("recommendedPlan").asText());

        Map<String, String> sizing = new HashMap<>();
        sizing.put(INITIAL, initial.result().path("sizing").asText(""));
        String recommendedId = INITIAL;
        String type = "KEEP_INITIAL";
        if (phased) {
            ObjectNode simulate = flow.input().put("baseConfigId", INITIAL).put("configId", RECOMMENDED);
            simulate.putArray("add").add(plans.result().path("phasedCatalogId").asText());
            ToolOutput simulated = flow.call("simulate_upgrade_package", simulate, "Simulating phased conversion");
            sizing.put(RECOMMENDED, simulated.result().path("sizing").asText(""));
            if ("PASS".equals(simulated.result().path("thresholdResult").asText())) {
                recommendedId = RECOMMENDED;
                type = "UPGRADE_BEYOND_REQUEST";
            }
        } else if (!"PASS".equals(initial.result().path("thresholdResult").asText())) {
            Optional<Pick> pick = searchUpgrade(flow, module);
            if (pick.isPresent()) {
                ObjectNode simulate = flow.input().put("baseConfigId", INITIAL).put("configId", RECOMMENDED);
                ArrayNode addNode = simulate.putArray("add");
                pick.get().catalogIds().forEach(addNode::add);
                ToolOutput simulated = flow.call("simulate_upgrade_package", simulate,
                        "Simulating upgrade package " + pick.get().candidate().id());
                sizing.put(RECOMMENDED, simulated.result().path("sizing").asText(""));
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
                "Checking the DNSH data");

        ObjectNode output = assemble(flow, module, calculator, run, baseline, thresholdCalcId, recommendedId, type, dnsh,
                sizing.get(recommendedId), plans != null && plans.ok() ? plans.result() : null);
        flow.thought("Technical assessment ready: " + output.path("summaryRo").asText());
        return new AgentResult(output, "LIVE", flow.iterations());
    }

    /**
     * The calc the output cites as the green threshold: rules.threshold.* when the module has a numeric threshold, the
     * sizing limit for a BY_NATURE module (energy), else the first published rule (README §6).
     */
    private static String thresholdCalc(ToolOutput rules) {
        return Stream.of("rules.threshold", "rules.sizing", "rules.")
                .flatMap(prefix -> rules.calcs().stream().filter(c -> c.key().startsWith(prefix)).limit(1))
                .map(Calc::calcId).findFirst().orElseThrow(() -> new AgentFailureException("AGENT_MISSING_CALC",
                        "The module does not publish the green threshold (rules.threshold.*)", false, null));
    }

    private record Pick(UpgradeSelector.Candidate candidate, List<String> catalogIds) {
    }

    private Optional<Pick> searchUpgrade(ToolFlow flow, ModuleDefinition module) {
        ToolOutput search = flow.call("search_upgrades", flow.input().put("baseConfigId", INITIAL),
                "Searching for the cheapest upgrade package that passes the threshold");
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
                                ToolOutput dnsh, String sizingResult, JsonNode plans) {
        ObjectNode out = mapper.createObjectNode();
        out.put("moduleId", module.moduleId());
        out.put("indicator", module.indicator());
        ObjectNode threshold = out.putObject("threshold");
        threshold.put("thresholdCalcId", thresholdCalcId);
        threshold.put("sourceRo", cut(module.threshold().sourceRo(), 240));

        ObjectNode base = out.putObject("baseline");
        String source = baseline.result().path("dataSource").asText("NORMS");
        base.put("dataSource", "NORMS".equals(source) ? "NORM" : source);
        base.put("descriptionRo", cut("Current situation on the selected parcels, from " + ("NORM".equals(
                base.path("dataSource").asText()) ? "norms and the questionnaire" : "invoices and norms"), 400));
        ArrayNode baseMetrics = base.putArray("metrics");
        calculator.baselineMetrics().forEach((key, metric) -> flow.calc(key).filter(c -> c.value().signum() != 0)
                .ifPresent(c -> baseMetrics.addObject().put("metric", metric).put("calcId", c.calcId())));
        if (baseMetrics.isEmpty()) {
            calculator.baselineMetrics().forEach((key, metric) -> flow.idIfPresent(key).ifPresent(id ->
                    baseMetrics.addObject().put("metric", metric).put("calcId", id)));
        }

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
        out.set("sizingCheck", sizing(flow, recommendedId, sizingResult));
        out.set("missingFields", missingFields(run, dnsh.result()));

        Calc indicator = flow.calc(recommendedId + ".indicator").orElseThrow();
        out.put("summaryRo", cut("The " + ("KEEP_INITIAL".equals(type) ? "requested" : "recommended")
                + " investment reaches " + indicator.display() + " on the green indicator ("
                + ("NO_FEASIBLE_UPGRADE".equals(type) ? "fails the threshold, no upgrade found" : "passes the threshold") + ").", 800));
        String farmerMessage = farmerMessage(flow, module, type, indicator);
        if (plans != null) {
            String plan = planComparison(flow, type, plans.path("fullCovered").asBoolean());
            out.put("summaryRo", cut(out.path("summaryRo").asText() + " " + plan, 800));
            farmerMessage = plan;
        }
        out.put("farmerMessageRo", cut(farmerMessage, 400));
        return out;
    }

    private ObjectNode configuration(ToolFlow flow, ModuleCalculator calculator, Configuration cfg, String recommendedId) {
        ObjectNode node = mapper.createObjectNode();
        String id = cfg.configId();
        node.put("configId", id);
        node.put("role", INITIAL.equals(id) ? "INITIAL" : id.equals(recommendedId) ? "RECOMMENDED" : "ALTERNATIVE");
        node.put("titleRo", cut(INITIAL.equals(id) ? "Investment as offered" : "Investment with upgrade", 120));
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
        calculator.impactMetrics().forEach((suffix, metric) -> flow.calc(id + "." + suffix)
                .filter(c -> c.value().signum() != 0)
                .ifPresent(c -> impacts.addObject().put("metric", metric).put("calcId", c.calcId())));
        return node;
    }

    /** Calc shown for the sizing rule, by module: power per hectare (machinery), share sold to the grid (energy). */
    private static final List<String> SIZING_CALCS = List.of("hp_per_ha", "export_share");

    private ObjectNode sizing(ToolFlow flow, String configId, String result) {
        ObjectNode node = mapper.createObjectNode();
        Optional<String> shown = SIZING_CALCS.stream().map(suffix -> flow.idIfPresent(configId + "." + suffix))
                .flatMap(Optional::stream).findFirst();
        if (shown.isEmpty() || result == null || result.isEmpty()) {
            node.put("status", "NOT_APPLICABLE");
            node.put("noteRo", "The module has no sizing rule");
            return node;
        }
        boolean ok = "PASS".equals(result);
        node.put("status", ok ? "PASS" : "FAIL");
        node.put("calcId", shown.get());
        node.put("noteRo", ok ? "Sizing is within the programme limit" : "Sizing exceeds the programme limit or the engine does not meet Stage V");
        return node;
    }

    private ArrayNode missingFields(Run run, JsonNode dnshFacts) {
        ArrayNode fields = mapper.createArrayNode();
        for (String docType : run.missingDocuments()) {
            fields.addObject().put("fieldKey", docType.toLowerCase()).put("labelRo", "Missing document: " + docType)
                    .put("requiredFor", "DISBURSEMENT").put("docType", docType).put("blocking", false);
        }
        if (dnshFacts.has("permitPresent") && !dnshFacts.path("permitPresent").asBoolean()
                && run.missingDocuments().stream().noneMatch("WATER_PERMIT_ANAR"::equals)) {
            fields.addObject().put("fieldKey", "water_permit").put("labelRo", "Water management permit")
                    .put("requiredFor", "DNSH").put("docType", "WATER_PERMIT_ANAR").put("blocking", false);
        }
        return fields;
    }

    /** Full against phased conversion in words, with the figures of compare_conversion_plans as calc displays. */
    private static String planComparison(ToolFlow flow, String type, boolean fullCovered) {
        boolean phased = "UPGRADE_BEYOND_REQUEST".equals(type);
        String fullMargin = display(flow, "plan.full.margin_total");
        String phasedMargin = display(flow, "plan.phased.margin_total");
        String gap = display(flow, "plan.full.gap_y1");
        String coverage = display(flow, "plan.full.coverage");
        String phasedGap = display(flow, "plan.phased.gap_y1");
        return phased
                ? "We recommend phased conversion: full conversion leaves a liquidity gap of " + gap + " in the first year, "
                + "above the APIA pre-financing of " + coverage + "; phased, the gap falls to " + phasedGap
                + ". Cumulative margin over the horizon: " + fullMargin + " full, " + phasedMargin + " phased."
                : "We recommend full conversion: the first-year liquidity gap (" + gap
                + (fullCovered ? ") fits within" : ") exceeds")
                + " the APIA pre-financing of " + coverage
                + (fullCovered ? "" : ", but phasing would not cover it better") + "; the cumulative margin over the horizon is "
                + fullMargin + ", against " + phasedMargin + " for phased conversion.";
    }

    private static String display(ToolFlow flow, String key) {
        return flow.calc(key).map(Calc::display).orElse("?");
    }

    private static String farmerMessage(ToolFlow flow, ModuleDefinition module, String type, Calc indicator) {
        return switch (type) {
            case "KEEP_INITIAL" -> "The investment you asked for reaches " + indicator.display() + " and passes the green threshold.";
            case "UPGRADE_TO_PASS" -> "The investment you asked for does not reach the green threshold. With the proposed upgrade you reach "
                    + indicator.display() + ".";
            default -> "The investment does not reach the green threshold and we found no suitable upgrade; you can go ahead with the classic credit.";
        };
    }

    static String cut(String text, int max) {
        return text == null ? "" : text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
