package ro.greenstruct.agro.agents.rules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.config.GreenStructProperties;
import ro.greenstruct.agro.modules.ModuleDefinition;
import ro.greenstruct.agro.modules.ModuleRegistry;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.orchestration.AgentContext;
import ro.greenstruct.agro.orchestration.AgentResult;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.orchestration.Run;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.ToolRegistry;
import ro.greenstruct.agro.tools.workspace.FinancingOption;
import ro.greenstruct.agro.tools.workspace.WorkspaceStore;

import static ro.greenstruct.agro.agents.rules.RuleBasedTechnicalAgent.cut;

/**
 * Agent 2 without a model: classic vs green credit (README §4 steps 5-8) built with the same tools as the Bedrock
 * agent. The grant option is added only when a grant programme is eligible in an open session.
 */
@Component
public class RuleBasedFundingAgent implements RuleAgent {

    private static final Map<String, String> SAVINGS_METRICS = Map.of("water_eur", "WATER_COST_SAVED_EUR",
            "energy_eur", "ENERGY_COST_SAVED_EUR", "fuel_eur", "FUEL_COST_SAVED_EUR", "inputs_eur",
            "INPUTS_COST_SAVED_EUR");
    private static final Map<String, String> DRIVERS = Map.of("grant", "GRANT", "investment", "INVESTMENT_DELTA",
            "interest", "INTEREST", "savings", "OPERATING_SAVINGS", "collateral", "COLLATERAL_COSTS");
    private static final Map<String, String> RATE_COMPONENTS = Map.of("funding_cost", "FUNDING_COST", "risk_cost",
            "RISK_COST", "capital_cost", "CAPITAL_COST", "operational_cost", "OPERATIONAL_COST", "target_profit",
            "TARGET_PROFIT", "program_subsidy", "PROGRAM_SUBSIDY", "tier_adjustment", "TIER_ADJUSTMENT");
    private static final List<String> RATE_ORDER = List.of("funding_cost", "risk_cost", "capital_cost",
            "operational_cost", "target_profit", "program_subsidy", "tier_adjustment");

    private record OptionPlan(String optionId, String variant, String kind, String configId, List<String> products,
                              String title) {
    }

    private final ToolRegistry tools;
    private final CalcStore calcs;
    private final ModuleRegistry modules;
    private final WorkspaceStore workspaces;
    private final ReferenceData reference;
    private final GreenStructProperties properties;
    private final ObjectMapper mapper;

    public RuleBasedFundingAgent(ToolRegistry tools, CalcStore calcs, ModuleRegistry modules,
                                 WorkspaceStore workspaces, ReferenceData reference, GreenStructProperties properties,
                                 ObjectMapper mapper) {
        this.tools = tools;
        this.calcs = calcs;
        this.modules = modules;
        this.workspaces = workspaces;
        this.reference = reference;
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public AgentSlot slot() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public AgentResult run(Run run, AgentContext context) {
        ToolFlow flow = new ToolFlow(run, context, tools, calcs, mapper);
        ModuleDefinition module = modules.require(run.request().moduleId());
        JsonNode technical = run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        String initialId = technical.path("initialConfigId").asText();
        String recommendedId = technical.path("recommendedConfigId").asText();
        boolean recommendedPasses = workspaces.forRun(run.id()).configuration(recommendedId).passesThreshold();
        ModuleDefinition.Financing financing = module.financing();

        flow.call("list_financing_lines", flow.input(), "Încarc liniile de finanțare ale modulului");
        ToolOutput programs = flow.call("check_program_eligibility", flow.input().put("configId", recommendedId),
                "Verific eligibilitatea pe programele de finanțare");
        Optional<JsonNode> grant = openGrant(programs.result());

        List<OptionPlan> plans = new ArrayList<>();
        plans.add(new OptionPlan("A", "CLASIC", "STANDARD", initialId, List.of(financing.standardLine()),
                "Credit clasic"));
        if (recommendedPasses) {
            plans.add(new OptionPlan("B", "VERDE", "GREEN_PACKAGE", recommendedId, List.of(financing.greenLine()),
                    "Credit verde Raiffeisen"));
            if (grant.isPresent() && financing.cofinancingLine() != null && financing.bridgeLine() != null) {
                plans.add(new OptionPlan("C", "VERDE", "GREEN_PACKAGE_WITH_GRANT", recommendedId,
                        List.of(financing.cofinancingLine(), grant.get().path("programCode").asText(),
                                financing.bridgeLine()), "Credit verde cu grant " + grant.get().path("programCode")
                        .asText().replace('_', '-')));
            }
        }
        ObjectNode stackInput = flow.input();
        ArrayNode optionsInput = stackInput.putArray("options");
        for (OptionPlan plan : plans) {
            ObjectNode node = optionsInput.addObject().put("optionId", plan.optionId()).put("configId", plan.configId());
            plan.products().forEach(node.putArray("products")::add);
        }
        flow.call("build_funding_stack", stackInput, "Construiesc structura de finanțare pe variante");

        flow.call("determine_green_tier", flow.input().put("acceptUpgrade", true), "Stabilesc nivelul verde");
        flow.call("price_loan", flow.input(), "Calculez dobânda clasică și pe cea verde, pe componente");

        Map<String, ObjectNode> schedules = new LinkedHashMap<>();
        for (OptionPlan plan : plans) {
            schedules.put(plan.optionId(), schedule(flow, run, plan));
        }
        List<String> optionIds = plans.stream().map(OptionPlan::optionId).toList();
        ObjectNode both = flow.input();
        optionIds.forEach(both.putArray("optionIds")::add);
        ToolOutput affordability = flow.call("check_affordability", both, "Verific capacitatea de plată");
        ObjectNode dscrInput = flow.input();
        optionIds.forEach(dscrInput.putArray("optionIds")::add);
        flow.call("compute_dscr", dscrInput, "Calculez DSCR-ul");
        boolean green = optionIds.contains("B");
        if (green) {
            ObjectNode compare = flow.input();
            compare.putArray("optionIds").add("A").add("B");
            flow.call("compare_scenarios", compare, "Compar creditul clasic cu cel verde");
        }

        ObjectNode output = assemble(flow, module, plans, schedules, affordability.result(), programs.result(), grant,
                green);
        return new AgentResult(output, "LIVE", flow.iterations());
    }

    /** Seasonal repayment when the line allows it and the farmer gave cash-in months; equal instalments otherwise. */
    private ObjectNode schedule(ToolFlow flow, Run run, OptionPlan plan) {
        ObjectNode seasonal = flow.input().put("optionId", plan.optionId()).put("scheduleType", "SEASONAL");
        boolean hasMonths = run.request().questionnaire().path("cashin_months").isArray()
                && !run.request().questionnaire().path("cashin_months").isEmpty();
        if (!"A".equals(plan.optionId()) && hasMonths) {
            ToolOutput out = flow.tryCall("build_scenario", seasonal, "Rate după încasări, varianta " + plan.optionId());
            if (out.ok()) {
                return seasonal;
            }
        }
        ObjectNode equal = flow.input().put("optionId", plan.optionId()).put("scheduleType", "EQUAL_MONTHLY");
        flow.call("build_scenario", equal, "Rate lunare egale, varianta " + plan.optionId());
        return equal;
    }

    private Optional<JsonNode> openGrant(JsonNode programs) {
        JsonNode best = null;
        for (JsonNode program : programs.path("programs")) {
            if ("GRANT".equals(program.path("type").asText()) && "ELIGIBLE".equals(program.path("result").asText())
                    && "OPEN".equals(program.path("session").asText()) && program.has("intensityPct")
                    && (best == null || program.path("intensityPct").decimalValue()
                    .compareTo(best.path("intensityPct").decimalValue()) > 0)) {
                best = program;
            }
        }
        return Optional.ofNullable(best);
    }

    private ObjectNode assemble(ToolFlow flow, ModuleDefinition module, List<OptionPlan> plans,
                                Map<String, ObjectNode> schedules, JsonNode affordability, JsonNode programs,
                                Optional<JsonNode> grant, boolean green) {
        ObjectNode out = mapper.createObjectNode();
        ArrayNode options = out.putArray("options");
        Map<String, String> affordabilityStatus = new LinkedHashMap<>();
        for (OptionPlan plan : plans) {
            String verdict = affordability.path(plan.optionId()).path("result").asText("PASS");
            affordabilityStatus.put(plan.optionId(), verdict);
            options.add(option(flow, plan, schedules.get(plan.optionId()), verdict, affordability.path(plan.optionId())));
        }
        out.put("recommendedOptionId", "A");

        boolean netPositive = false;
        if (green) {
            netPositive = flow.calc("compare.net_advantage").map(c -> c.value().signum() > 0).orElse(false);
        }
        boolean affordable = !"FAIL".equals(affordabilityStatus.get("B"));
        ObjectNode basis = out.putObject("recommendationBasis");
        basis.put("greenEligible", green);
        basis.put("netAdvantagePositive", netPositive);
        basis.put("affordabilityPassed", green ? affordable : !"FAIL".equals(affordabilityStatus.get("A")));
        if (green && netPositive && affordable) {
            out.put("recommendedOptionId", "B");
        }

        out.set("programChecks", programChecks(programs));
        out.set("grantOutlook", grantOutlook(programs, grant));
        out.set("comparison", comparison(flow, green));
        out.put("farmerExplanationRo", cut(farmerExplanation(flow, green, netPositive), 700));
        out.put("officerNotesRo", cut(officerNotes(flow, green), 1000));
        return out;
    }

    private ObjectNode option(ToolFlow flow, OptionPlan plan, ObjectNode schedule, String affordabilityVerdict,
                              JsonNode affordabilityNode) {
        String p = "option_" + plan.optionId().toLowerCase() + ".";
        FinancingOption facts = workspaces.forRun(flow.run().id()).option(plan.optionId());
        boolean classic = "A".equals(plan.optionId());
        ObjectNode node = mapper.createObjectNode();
        node.put("optionId", plan.optionId());
        node.put("variant", plan.variant());
        node.put("kind", plan.kind());
        node.put("configId", plan.configId());
        node.put("titleRo", plan.title());
        node.put("investmentCalcId", flow.id(plan.configId() + ".total_cost"));

        ArrayNode stack = node.putArray("fundingStack");
        String loanItem = "fs_" + plan.optionId().toLowerCase() + "_loan";
        ObjectNode loan = stack.addObject();
        loan.put("itemId", loanItem);
        loan.put("type", classic ? "STANDARD_LOAN" : "B".equals(plan.optionId()) ? "GREEN_LOAN" : "CO_FINANCING_LOAN");
        loan.put("productId", facts.mainLineId());
        loan.put("amountCalcId", flow.id(p + "loan.amount"));
        loan.put("rateCalcId", flow.id(classic || !flow.calc("pricing.green.rate").isPresent()
                ? "pricing.classic.rate" : "pricing.green.rate"));
        loan.put("termCalcId", flow.id("line.term"));
        ObjectNode repayment = loan.putObject("repayment");
        boolean seasonal = "SEASONAL".equals(schedule.path("scheduleType").asText());
        repayment.put("scheduleType", seasonal ? "SEASONAL" : "EQUAL_MONTHLY");
        repayment.put("installmentCalcId", flow.id(p + "installment"));
        repayment.put("scheduleCalcId", flow.id(p + "schedule"));
        if (seasonal) {
            flow.idIfPresent(p + "grace").ifPresent(id -> repayment.put("graceCalcId", id));
            ArrayNode months = repayment.putArray("paymentMonths");
            flow.run().request().questionnaire().path("cashin_months").forEach(m -> months.add(m.asText()));
        }
        loan.put("status", "AVAILABLE");
        loan.put("noteRo", classic ? "Rate lunare egale, cu ipotecă acolo unde linia o cere"
                : seasonal ? "Rate după calendarul încasărilor, cu grație până la prima încasare"
                : "Rate lunare egale");

        if (facts.guaranteeEur().signum() > 0 && facts.guaranteeId() != null) {
            ObjectNode guarantee = stack.addObject();
            guarantee.put("itemId", "fs_" + plan.optionId().toLowerCase() + "_guarantee");
            guarantee.put("type", "GUARANTEE");
            guarantee.put("productId", facts.guaranteeId());
            guarantee.put("amountCalcId", flow.id(p + "guarantee.amount"));
            flow.idIfPresent("guarantee." + shortId(facts.guaranteeId()) + ".coverage")
                    .ifPresent(id -> guarantee.put("coverageCalcId", id));
            guarantee.put("guaranteesItemId", loanItem);
            guarantee.put("status", "AVAILABLE");
            guarantee.put("noteRo", "Garanție europeană în locul ipotecii");
        }
        if (facts.grantEur().signum() > 0) {
            ObjectNode grantItem = stack.addObject();
            grantItem.put("itemId", "fs_" + plan.optionId().toLowerCase() + "_grant");
            grantItem.put("type", "GRANT");
            grantItem.put("productId", facts.grantProgram());
            grantItem.put("programCode", facts.grantProgram());
            grantItem.put("amountCalcId", flow.id(p + "grant.amount"));
            grantItem.put("status", "OPEN_CALL");
            grantItem.put("noteRo", "Grant nerambursabil, în sesiunea deschisă");
        }
        if (facts.bridgeLoanEur().signum() > 0) {
            ObjectNode bridge = stack.addObject();
            bridge.put("itemId", "fs_" + plan.optionId().toLowerCase() + "_bridge");
            bridge.put("type", "BRIDGE_LOAN");
            bridge.put("productId", facts.bridgeLineId());
            bridge.put("amountCalcId", flow.id(p + "bridge.amount"));
            bridge.put("status", "AVAILABLE");
            bridge.put("noteRo", "Credit-punte până la încasarea grantului");
        }
        node.put("headlineInstallmentCalcId", flow.id(p + "installment"));
        ArrayNode collateral = node.putArray("collateral");
        collateral(facts).forEach(collateral::add);

        ObjectNode totals = node.putObject("totals");
        totals.put("totalPaymentsCalcId", flow.id(p + "total_payments"));
        totals.put("totalInterestCalcId", flow.id(p + "total_interest"));
        flow.idIfPresent(p + "collateral_costs").ifPresent(id -> totals.put("collateralCostsCalcId", id));
        totals.put("savingsOverHorizonCalcId", flow.id(p + "savings_horizon"));
        totals.put("netCostCalcId", flow.id(p + "net_cost"));

        ArrayNode savings = node.putArray("annualSavings");
        SAVINGS_METRICS.forEach((short_, metric) -> flow.idIfPresent(p + "savings." + short_).ifPresent(id ->
                savings.addObject().put("metric", metric).put("calcId", id)));
        ObjectNode afford = node.putObject("affordability");
        afford.put("status", affordabilityVerdict);
        afford.put("ratioCalcId", flow.id(p + "affordability_ratio"));
        afford.put("limitCalcId", flow.id("line.affordability_limit"));
        afford.put("noteRo", "FAIL".equals(affordabilityVerdict) ? "Ratele depășesc limita din cashflow"
                : "PASS_WITH_WARNING".equals(affordabilityVerdict) ? "Ratele depășesc cashflow-ul în unele luni"
                : "Ratele încap în cashflow-ul net");
        node.put("greenEligible", !classic);
        node.put("greenTier", classic ? "CLASIC" : greenTier(flow));
        node.set("rateBreakdown", rateBreakdown(flow, classic));
        node.put("dscrCalcId", flow.id(p + "dscr"));
        return node;
    }

    private String greenTier(ToolFlow flow) {
        return workspaces.forRun(flow.run().id()).greenTier().tier().name();
    }

    private ObjectNode rateBreakdown(ToolFlow flow, boolean classic) {
        String prefix = classic || flow.calc("pricing.green.rate").isEmpty() ? "pricing.classic." : "pricing.green.";
        ObjectNode node = mapper.createObjectNode();
        node.put("indexCalcId", flow.id("pricing.index"));
        ArrayNode components = node.putArray("components");
        for (String key : RATE_ORDER) {
            flow.idIfPresent(prefix + key).ifPresent(id -> components.addObject()
                    .put("component", RATE_COMPONENTS.get(key)).put("calcId", id));
        }
        node.put("marginCalcId", flow.id(prefix + "margin"));
        node.put("rateCalcId", flow.id(prefix + "rate"));
        return node;
    }

    private List<String> collateral(FinancingOption facts) {
        JsonNode line = reference.financingLines().path("lines");
        String kind = "NONE";
        for (JsonNode l : line) {
            if (facts.mainLineId().equals(l.path("lineId").asText())) {
                kind = l.path("collateral").asText("NONE");
            }
        }
        List<String> values = new ArrayList<>();
        switch (kind) {
            case "MORTGAGE" -> values.add("MORTGAGE");
            case "ASSET_PLEDGE" -> values.add("PLEDGE_EQUIPMENT");
            case "GRANT_ASSIGNMENT" -> values.add("GRANT_ASSIGNMENT");
            case "GUARANTEE" -> values.add("fgcr.cofinancing".equals(facts.guaranteeId()) ? "GUARANTEE_FGCR"
                    : "GUARANTEE_INVESTEU_FEI");
            default -> values.add("NONE");
        }
        if (facts.grantEur().signum() > 0 && !values.contains("GRANT_ASSIGNMENT")) {
            values.add("GRANT_ASSIGNMENT");
        }
        return values;
    }

    private ArrayNode programChecks(JsonNode programs) {
        ArrayNode checks = mapper.createArrayNode();
        String today = properties.today().toString();
        for (JsonNode program : programs.path("programs")) {
            if (checks.size() >= 12) {
                break;
            }
            String code = program.path("programCode").asText();
            JsonNode config = null;
            for (JsonNode p : reference.fundingPrograms().path("programs")) {
                if (code.equals(p.path("programCode").asText())) {
                    config = p;
                }
            }
            ObjectNode row = checks.addObject();
            row.put("programCode", code);
            row.put("result", program.path("result").asText());
            String session = program.path("session").asText("UNKNOWN");
            row.put("session", List.of("OPEN", "NOT_OPEN", "CLOSED", "NO_BUDGET", "PERMANENT").contains(session)
                    ? session : "NOT_OPEN");
            if (config != null && config.path("session").has("closes") && "OPEN".equals(session)) {
                row.put("deadline", config.path("session").path("closes").asText() + "T16:00:00+02:00");
            }
            row.put("checkedAt", today);
            row.put("sourceUrl", config == null ? "https://www.afir.ro" : config.path("sourceUrl").asText("https://www.afir.ro"));
            row.putArray("criteria");
            List<String> notes = new ArrayList<>();
            program.path("reasonsRo").forEach(n -> notes.add(n.asText()));
            program.path("conditionsRo").forEach(n -> notes.add(n.asText()));
            row.put("noteRo", cut(notes.isEmpty() ? "Criteriile programului sunt îndeplinite" : String.join("; ", notes), 400));
        }
        return checks;
    }

    private ObjectNode grantOutlook(JsonNode programs, Optional<JsonNode> grant) {
        ObjectNode node = mapper.createObjectNode();
        String today = properties.today().toString();
        node.put("checkedAt", today);
        if (grant.isPresent()) {
            String code = grant.get().path("programCode").asText();
            node.put("status", "GRANT_IN_STACK");
            node.put("programCode", code);
            node.put("messageRo", "Grantul " + code.replace('_', '-') + " este în sesiune deschisă și ferma este eligibilă; "
                    + "îl includem în varianta cu grant, cu credit-punte până la încasare.");
            return node;
        }
        boolean anyGrantClosed = false;
        for (JsonNode program : programs.path("programs")) {
            if ("GRANT".equals(program.path("type").asText()) && "ELIGIBLE".equals(program.path("result").asText())) {
                anyGrantClosed = true;
            }
        }
        node.put("status", anyGrantClosed ? "NO_OPEN_SESSION" : "NOT_ELIGIBLE");
        node.put("messageRo", anyGrantClosed ? "Nu există o sesiune deschisă pentru un grant potrivit; reverificăm la următoarea sesiune."
                : "Ferma sau investiția nu îndeplinesc condițiile granturilor verificate.");
        return node;
    }

    private ObjectNode comparison(ToolFlow flow, boolean green) {
        ObjectNode node = mapper.createObjectNode();
        node.put("horizonCalcId", flow.id("line.horizon"));
        ArrayNode drivers = node.putArray("drivers");
        ArrayNode differences = node.putArray("rateDifference");
        if (!green) {
            node.put("netAdvantageCalcId", flow.id("option_a.net_cost"));
            node.put("rateDifferenceCalcId", flow.id("pricing.classic.rate"));
            drivers.addObject().put("driver", "OPERATING_SAVINGS").put("calcId", flow.id("option_a.savings_horizon"));
            differences.addObject().put("component", "FUNDING_COST").put("deltaCalcId", flow.id("pricing.classic.funding_cost"));
            return node;
        }
        node.put("netAdvantageCalcId", flow.id("compare.net_advantage"));
        flow.idIfPresent("compare.upgrade_payback").ifPresent(id -> node.put("upgradePaybackCalcId", id));
        DRIVERS.forEach((key, driver) -> flow.idIfPresent("compare.driver." + key).ifPresent(id ->
                drivers.addObject().put("driver", driver).put("calcId", id)));
        if (drivers.isEmpty()) {
            drivers.addObject().put("driver", "OPERATING_SAVINGS").put("calcId", flow.id("compare.net_advantage"));
        }
        for (String key : RATE_ORDER) {
            flow.idIfPresent("pricing.diff." + key).ifPresent(id -> differences.addObject()
                    .put("component", RATE_COMPONENTS.get(key)).put("deltaCalcId", id));
        }
        node.put("rateDifferenceCalcId", flow.id("pricing.diff.total"));
        return node;
    }

    private String farmerExplanation(ToolFlow flow, boolean green, boolean netPositive) {
        if (!green) {
            return "Investiția cerută nu atinge pragul verde, așa că vă propunem creditul clasic. Puteți relua analiza cu o investiție mai eficientă.";
        }
        String gain = flow.calc("compare.net_advantage").map(Calc::display).orElse("");
        return netPositive
                ? "Câștigi " + gain + " alegând creditul verde, față de cel clasic, pe toată durata creditului."
                : "Creditul verde nu iese mai avantajos decât cel clasic pe durata analizată.";
    }

    private String officerNotes(ToolFlow flow, boolean green) {
        if (!green) {
            return "Fără credit verde: configurația nu trece pragul. Parametrii dobânzii sunt demo.";
        }
        String classic = flow.calc("pricing.classic.rate").map(Calc::display).orElse("?");
        String verde = flow.calc("pricing.green.rate").map(Calc::display).orElse("?");
        return "Dobânda clasică " + classic + ", dobânda verde " + verde + ". Parametrii dobânzii (PD, LGD, ponderi de risc, "
                + "cost de finanțare, subvenție) sunt demo, de confirmat cu Raiffeisen.";
    }

    private static String shortId(String id) {
        return id.substring(id.lastIndexOf('.') + 1);
    }
}
