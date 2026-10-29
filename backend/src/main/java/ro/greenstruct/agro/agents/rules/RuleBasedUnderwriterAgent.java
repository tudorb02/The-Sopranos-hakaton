package ro.greenstruct.agro.agents.rules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.GreenTier;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.ToolRegistry;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

import static ro.greenstruct.agro.agents.rules.RuleBasedTechnicalAgent.cut;

/**
 * Agent 3 without a model: DNSH table, fund and its requirements ticked, bond category, conditions before drawdown
 * and monitoring KPIs (README §3, §5.3, §8). Every missing piece of information becomes a condition, not a rejection.
 */
@Component
public class RuleBasedUnderwriterAgent implements RuleAgent {

    private static final List<String> OBJECTIVES = List.of("CLIMATE_MITIGATION", "CLIMATE_ADAPTATION",
            "WATER_MARINE_RESOURCES", "CIRCULAR_ECONOMY", "POLLUTION_PREVENTION", "BIODIVERSITY");
    private static final Map<String, String> BASIS = Map.of("TAXONOMY_ALIGNED", "EU_TAXONOMY_ACTIVITY",
            "MARKET_GREEN", "LMA_GREEN_LOAN_PRINCIPLES", "TRANSITION", "BANK_GREEN_FRAMEWORK", "NONE", "LEGAL_MINIMUM_ONLY");
    private static final Map<String, String> KPI_SOURCE = Map.ofEntries(
            Map.entry("WATER_USE_M3", "WATER_METER"), Map.entry("WATER_SAVED_M3", "WATER_METER"),
            Map.entry("PUMPING_ENERGY_KWH", "SMART_METER"), Map.entry("ENERGY_SAVED_KWH", "INVOICES"),
            Map.entry("RENEWABLE_KWH", "SMART_METER"), Map.entry("GRID_ENERGY_REPLACED_KWH", "SMART_METER"),
            Map.entry("FUEL_USE_L", "INVOICES"), Map.entry("FUEL_SAVED_L", "INVOICES"),
            Map.entry("NITROGEN_SAVED_KG", "INVOICES"), Map.entry("NITROGEN_USE_KG", "INVOICES"),
            Map.entry("CO2_AVOIDED_T", "INVOICES"), Map.entry("CERTIFIED_AREA_HA", "APIA"),
            Map.entry("PRECISION_SHARE_PCT", "COMMISSIONING_REPORT"));
    private static final Set<String> KPI_METRICS = Set.of("WATER_SAVED_M3", "ENERGY_SAVED_KWH", "RENEWABLE_KWH",
            "FUEL_SAVED_L", "NITROGEN_SAVED_KG", "CO2_AVOIDED_T", "CERTIFIED_AREA_HA", "GRID_ENERGY_REPLACED_KWH");

    private final ToolRegistry tools;
    private final CalcStore calcs;
    private final ModuleRegistry modules;
    private final WorkspaceStore workspaces;
    private final ObjectMapper mapper;

    public RuleBasedUnderwriterAgent(ToolRegistry tools, CalcStore calcs, ModuleRegistry modules,
                                     WorkspaceStore workspaces, ObjectMapper mapper) {
        this.tools = tools;
        this.calcs = calcs;
        this.modules = modules;
        this.workspaces = workspaces;
        this.mapper = mapper;
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public AgentResult run(Run run, AgentContext context) {
        ToolFlow flow = new ToolFlow(run, context, tools, calcs, mapper);
        ModuleDefinition module = modules.require(run.request().moduleId());
        JsonNode technical = run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        String configId = technical.path("recommendedConfigId").asText();
        GreenTier tier = workspaces.forRun(run.id()).greenTier().tier();
        boolean hasGreenOption = tier.isGreen() && workspaces.forRun(run.id()).hasOption("B");

        ToolOutput labels = flow.call("get_labeling_rules", flow.input().put("configId", configId),
                "Labelling the configuration's components");
        flow.call("get_dnsh_criteria", flow.input(), "Loading the DNSH criteria");
        String optionId = hasGreenOption ? "B" : funding.path("recommendedOptionId").asText("A");
        ToolOutput fund = flow.call("select_fund", flow.input().put("optionId", optionId),
                "Selecting the fund that finances the credit");
        String fundCode = fund.result().path("fundId").asText();
        ToolOutput requirements = flow.call("check_fund_requirements",
                flow.input().put("fundId", fundCode).put("optionId", optionId), "Checking the requirements of fund " + fundCode);
        flow.call("calculate_impact", flow.input().put("configId", configId), "Calculating the environmental impact");
        ToolOutput bond = hasGreenOption
                ? flow.call("get_bond_category", flow.input(), "Selecting the green bond category")
                : null;

        Configuration cfg = workspaces.forRun(run.id()).configuration(configId);
        ObjectNode out = mapper.createObjectNode();
        List<ObjectNode> conditions = new ArrayList<>();
        ArrayNode dnsh = dnsh(module, technical, conditions);
        out.put("moduleId", module.moduleId());
        out.put("recommendedOptionId", funding.path("recommendedOptionId").asText());
        out.set("criterion", criterion(flow, module, technical, cfg, configId));
        out.set("componentLabels", componentLabels(flow, labels.result(), configId));
        ObjectNode share = out.putObject("greenShare");
        share.put("greenAmountCalcId", flow.id("label.green_amount"));
        share.put("transitionAmountCalcId", flow.id("label.transition_amount"));
        share.put("greenSharePctCalcId", flow.id("label.green_share"));
        out.set("greenBond", greenBond(flow, bond));
        out.set("fund", fund(flow, fund.result(), requirements.result(), conditions));
        out.put("substantialContribution", module.substantialContribution());
        out.set("dnsh", dnsh);
        ArrayNode impact = impact(flow, technical, configId);
        out.set("impact", impact);
        addGenericConditions(technical, tier, conditions);
        ArrayNode conditionsNode = out.putArray("conditionsPrecedent");
        conditions.stream().limit(15).forEach(conditionsNode::add);
        out.set("monitoringKpis", monitoringKpis(impact));
        out.set("risks", risks(run, dnsh));

        String decision = !tier.isGreen() ? "NOT_ELIGIBLE" : conditions.isEmpty() ? "ELIGIBLE_GREEN" : "ELIGIBLE_WITH_CONDITIONS";
        out.put("decision", decision);
        out.put("committeeSummaryRo", cut(summary(flow, tier, fundCode, fund.result(), decision, conditions.size()), 1500));
        ArrayNode steps = out.putArray("farmerNextSteps");
        for (ObjectNode condition : conditions.stream().limit(10).toList()) {
            steps.addObject().put("stepRo", cut(condition.path("descriptionRo").asText(), 240))
                    .put("conditionId", condition.path("conditionId").asText());
        }
        if (steps.isEmpty()) {
            steps.addObject().put("stepRo", "Wait for the bank's decision; we do not need any more documents.");
        }
        return new AgentResult(reorder(out), "LIVE", flow.iterations());
    }

    private ObjectNode reorder(ObjectNode node) {
        return node;
    }

    private ObjectNode criterion(ToolFlow flow, ModuleDefinition module, JsonNode technical, Configuration cfg, String configId) {
        ObjectNode node = mapper.createObjectNode();
        node.put("indicator", module.indicator());
        node.put("valueCalcId", flow.id(configId + ".indicator"));
        node.put("thresholdCalcId", technical.path("threshold").path("thresholdCalcId").asText());
        node.put("result", cfg.passesThreshold() ? "PASS" : "FAIL");
        node.put("sourceRo", cut(module.threshold().sourceRo(), 300));
        return node;
    }

    private ArrayNode componentLabels(ToolFlow flow, JsonNode rules, String configId) {
        ArrayNode labels = mapper.createArrayNode();
        for (JsonNode rule : rules.path("rules")) {
            String label = rule.path("label").asText("NONE");
            ObjectNode node = labels.addObject();
            node.put("componentId", rule.path("componentId").asText());
            node.put("label", label);
            node.put("basis", BASIS.getOrDefault(label, "NONE"));
            if ("TAXONOMY_ALIGNED".equals(label) && rule.has("taxonomyActivity")) {
                node.put("taxonomyActivity", rule.path("taxonomyActivity").asText());
            }
            flow.idIfPresent(configId + ".cmp." + rule.path("componentId").asText() + ".cost")
                    .ifPresent(id -> node.put("amountCalcId", id));
            node.put("rationaleRo", switch (label) {
                case "TAXONOMY_ALIGNED" -> "Activity aligned with the EU Taxonomy";
                case "MARKET_GREEN" -> "Green under market principles (LMA), through measurable savings";
                case "TRANSITION" -> "Transition component";
                default -> "Component without a green label; financed without a green benefit";
            });
        }
        return labels;
    }

    private ObjectNode greenBond(ToolFlow flow, ToolOutput bond) {
        ObjectNode node = mapper.createObjectNode();
        if (bond == null) {
            node.put("category", "NONE");
            node.put("status", "NOT_ELIGIBLE");
            node.put("noteRo", "No green credit, so no allocation to green bonds");
            return node;
        }
        node.put("category", bond.result().path("proposed").asText("NONE"));
        node.put("status", "TO_CONFIRM");
        node.put("noteRo", "Classification proposed by the application from the names in the bank's public framework; "
                + "the bank makes the final classification.");
        return node;
    }

    private ObjectNode fund(ToolFlow flow, JsonNode selected, JsonNode requirements, List<ObjectNode> conditions) {
        ObjectNode node = mapper.createObjectNode();
        node.put("fundId", selected.path("fundId").asText());
        node.put("role", selected.path("role").asText("PRIMARY"));
        ArrayNode rows = node.putArray("requirements");
        for (JsonNode requirement : requirements.path("requirements")) {
            ObjectNode row = rows.addObject();
            String id = requirement.path("requirementId").asText();
            String status = requirement.path("status").asText();
            row.put("requirementId", id);
            row.put("level", requirement.path("level").asText());
            row.put("status", status);
            if ("TO_CONFIRM".equals(status)) {
                String conditionId = "cp_" + id.toLowerCase();
                row.put("conditionId", conditionId);
                conditions.add(condition(conditionId, "OTHER", "OTHER", "Fund requirement to be confirmed with the bank ("
                        + id + "): " + requirement.path("reasonRo").asText(), "BEFORE_SIGNING", false));
            }
            row.put("noteRo", cut(requirement.path("reasonRo").asText(), 300));
        }
        ArrayNode alternatives = node.putArray("alternatives");
        for (JsonNode alternative : selected.path("alternatives")) {
            alternatives.addObject().put("fundId", alternative.path("fundId").asText())
                    .put("status", alternative.path("status").asText("TO_CONFIRM"))
                    .put("noteRo", cut(alternative.path("nameRo").asText(), 300));
        }
        return node;
    }

    private ArrayNode dnsh(ModuleDefinition module, JsonNode technical, List<ObjectNode> conditions) {
        Map<String, JsonNode> byObjective = new LinkedHashMap<>();
        technical.path("dnshChecks").forEach(c -> byObjective.put(c.path("objective").asText(), c));
        ArrayNode rows = mapper.createArrayNode();
        for (String objective : OBJECTIVES) {
            if (objective.equals(module.substantialContribution())) {
                continue;
            }
            JsonNode check = byObjective.get(objective);
            ObjectNode row = rows.addObject();
            row.put("objective", objective);
            String status = check == null ? "MISSING_DATA" : check.path("status").asText();
            row.put("status", status);
            row.put("justificationRo", cut(check == null ? "The objective was not checked; evidence is required before drawdown"
                    : check.path("noteRo").asText(), 500));
            ArrayNode evidence = row.putArray("evidence");
            if (check != null) {
                check.path("evidence").forEach(evidence::add);
            }
            if (!"PASS".equals(status)) {
                String conditionId = "cp_dnsh_" + objective.toLowerCase();
                row.put("conditionId", conditionId);
                conditions.add(condition(conditionId, "DOCUMENT", evidence.isEmpty() ? "OTHER" : evidence.get(0).asText(),
                        "DNSH " + objective + ": " + cut(row.path("justificationRo").asText(), 330),
                        "BEFORE_FIRST_DISBURSEMENT", "FAIL".equals(status)));
            }
        }
        return rows;
    }

    private ArrayNode impact(ToolFlow flow, JsonNode technical, String configId) {
        ArrayNode impact = mapper.createArrayNode();
        for (JsonNode cfg : technical.path("configurations")) {
            if (configId.equals(cfg.path("configId").asText())) {
                for (JsonNode i : cfg.path("impacts")) {
                    if (impact.size() < 9) {
                        impact.addObject().put("metric", i.path("metric").asText()).put("calcId", i.path("calcId").asText())
                                .put("period", "ANNUAL");
                    }
                }
            }
        }
        flow.idIfPresent("impact.co2_horizon").ifPresent(id -> impact.addObject().put("metric", "CO2_AVOIDED_T")
                .put("calcId", id).put("period", "HORIZON"));
        return impact;
    }

    private void addGenericConditions(JsonNode technical, GreenTier tier, List<ObjectNode> conditions) {
        if (!tier.isGreen()) {
            return;
        }
        if (!"KEEP_INITIAL".equals(technical.path("recommendationType").asText())) {
            conditions.add(condition("cp_updated_offer", "DOCUMENT", "OFFER", "Updated supplier offer for the "
                    + "investment with upgrade; the credit amount is adjusted to it", "BEFORE_SIGNING", true));
        }
        for (JsonNode missing : technical.path("missingFields")) {
            conditions.add(condition("cp_missing_" + missing.path("fieldKey").asText().toLowerCase().replaceAll("[^a-z0-9_]", "_"),
                    "DOCUMENT", missing.path("docType").asText("OTHER"), cut(missing.path("labelRo").asText(), 400),
                    "BEFORE_FIRST_DISBURSEMENT", missing.path("blocking").asBoolean()));
        }
        conditions.add(condition("cp_final_invoice", "INVOICE_MATCH", "FINAL_INVOICE",
                "Final invoice, matching the approved investment (including the upgrade)", "BEFORE_FINAL_DISBURSEMENT", true));
        conditions.add(condition("cp_commissioning", "DOCUMENT", "COMMISSIONING_REPORT",
                "Commissioning report and geotagged photos", "AFTER_INSTALLATION", false));
    }

    private ObjectNode condition(String id, String type, String docType, String description, String timing, boolean blocking) {
        ObjectNode node = mapper.createObjectNode();
        node.put("conditionId", id.length() > 43 ? id.substring(0, 43) : id);
        node.put("type", type);
        node.put("documentType", docType);
        node.put("descriptionRo", cut(description, 400));
        node.put("timing", timing);
        node.put("blocking", blocking);
        return node;
    }

    private ArrayNode monitoringKpis(ArrayNode impact) {
        ArrayNode kpis = mapper.createArrayNode();
        for (JsonNode i : impact) {
            String metric = i.path("metric").asText();
            if (!"ANNUAL".equals(i.path("period").asText()) || !KPI_METRICS.contains(metric) || kpis.size() >= 10) {
                continue;
            }
            ObjectNode kpi = kpis.addObject();
            kpi.put("kpiId", "kpi_" + metric.toLowerCase());
            kpi.put("metric", metric);
            kpi.put("targetCalcId", i.path("calcId").asText());
            kpi.put("frequency", "ANNUAL");
            kpi.put("firstDue", "MONTH_12");
            kpi.put("dataSource", KPI_SOURCE.getOrDefault(metric, "INVOICES"));
            kpi.put("descriptionRo", "Actual impact at 12 months against the dossier estimate");
        }
        if (kpis.isEmpty() && !impact.isEmpty()) {
            JsonNode first = impact.get(0);
            ObjectNode kpi = kpis.addObject();
            kpi.put("kpiId", "kpi_" + first.path("metric").asText().toLowerCase());
            kpi.put("metric", first.path("metric").asText());
            kpi.put("targetCalcId", first.path("calcId").asText());
            kpi.put("frequency", "ANNUAL");
            kpi.put("firstDue", "MONTH_12");
            kpi.put("dataSource", "INVOICES");
            kpi.put("descriptionRo", "Actual impact at 12 months against the dossier estimate");
        }
        return kpis;
    }

    private ArrayNode risks(Run run, ArrayNode dnsh) {
        ArrayNode risks = mapper.createArrayNode();
        String drought = "LOW";
        for (JsonNode feature : run.farmProfile().parcels().path("features")) {
            if (run.request().parcelIds().contains(feature.path("id").asText())) {
                String level = feature.path("properties").path("droughtRisk").asText("LOW");
                if (rank(level) > rank(drought)) {
                    drought = level;
                }
            }
        }
        if (rank(drought) >= 2) {
            risks.addObject().put("category", "CLIMATE_DROUGHT").put("severity", rank(drought) >= 3 ? "HIGH" : "MEDIUM")
                    .put("descriptionRo", "The parcels have a " + (rank(drought) >= 3 ? "high" : "medium") + " drought risk")
                    .put("mitigationRo", "The investment reduces water dependence; crop insurance is also recommended");
        }
        for (JsonNode row : dnsh) {
            if ("BIODIVERSITY".equals(row.path("objective").asText()) && !"PASS".equals(row.path("status").asText())) {
                risks.addObject().put("category", "NATURA_2000").put("severity", "MEDIUM")
                        .put("descriptionRo", cut(row.path("justificationRo").asText(), 300))
                        .put("mitigationRo", "Environmental approval before drawdown");
            }
            if ("POLLUTION_PREVENTION".equals(row.path("objective").asText()) && !"PASS".equals(row.path("status").asText())) {
                risks.addObject().put("category", "NITRATE_ZONE").put("severity", "MEDIUM")
                        .put("descriptionRo", cut(row.path("justificationRo").asText(), 300))
                        .put("mitigationRo", "Fertilisation plan in line with the code of good agricultural practice");
            }
        }
        risks.addObject().put("category", "PRICE").put("severity", "LOW")
                .put("descriptionRo", "The upgrade price is estimated from the catalogue")
                .put("mitigationRo", "Updated supplier offer, before signing");
        return risks;
    }

    private static int rank(String level) {
        return switch (level) {
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    private String summary(ToolFlow flow, GreenTier tier, String fundCode, JsonNode fund, String decision, int conditions) {
        Calc rate = flow.calc("pricing.green.rate").orElse(null);
        return "Decision: " + decision + ". Green tier: " + tier + ". Proposed fund: " + fundCode + " ("
                + fund.path("nameRo").asText() + "). "
                + (rate == null ? "" : "Green rate: " + rate.display() + " (demo parameters). ")
                + conditions + " conditions precedent to drawdown.";
    }
}
