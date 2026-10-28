package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.GreenTier;
import ro.greenstruct.agro.engine.pricing.LoanPricing;
import ro.greenstruct.agro.engine.pricing.LoanPricingCalculator;
import ro.greenstruct.agro.engine.pricing.PricingParameters;
import ro.greenstruct.agro.engine.pricing.RateBreakdown;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

/**
 * The rate of each option's main loan by component (README §4 step 6), kept on the option for build_scenario. With
 * one classic and one green option, also the difference per component: why the green loan is cheaper.
 */
@Component
public class PriceLoanTool implements ToolHandler {

    private enum Kind { CLASSIC, GREEN, GUARANTEED }

    @Override
    public String name() {
        return "price_loan";
    }

    @Override
    public String description() {
        return "Prices the main loan of each option by component: rate = index + funding cost + PD x LGD x (1 - g) "
                + "+ effective risk weight x capital ratio x cost of capital + operational cost + target profit; a green "
                + "loan also gets the programme subsidy and the margin of its green tier. g is the coverage of the "
                + "option's guarantee. With one classic and one green option it also gives the difference per "
                + "component. Call build_funding_stack and determine_green_tier first; build_scenario uses these rates.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["optionIds"], "properties": {
                  "optionIds": {"type": "array", "minItems": 1, "maxItems": 3,
                    "items": {"type": "string", "enum": ["A", "B", "C"]}}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        PricingParameters parameters = PricingConfig.parameters(context);
        RateBreakdown classic = null;
        RateBreakdown green = null;
        ObjectNode result = context.newResult();
        ArrayNode options = result.putArray("options");
        for (String optionId : Params.textList(input, "optionIds")) {
            FinancingOption option = context.workspace().option(optionId);
            JsonNode line = FinancingConfig.requireLine(context, option.mainLineId());
            BigDecimal coverage = option.guaranteeId() == null ? BigDecimal.ZERO
                    : FinancingConfig.guarantee(context, option.guaranteeId()).orElseThrow()
                    .path("coveragePct").decimalValue();
            Kind kind = line.path("green").asBoolean(false) ? Kind.GREEN
                    : coverage.signum() > 0 ? Kind.GUARANTEED : Kind.CLASSIC;
            RateBreakdown rate = switch (kind) {
                case GREEN -> LoanPricingCalculator.green(parameters,
                        PricingConfig.green(context, coverage, greenTier(context, optionId)));
                case GUARANTEED -> LoanPricingCalculator.green(parameters, PricingConfig.guaranteedOnly(context, coverage));
                case CLASSIC -> LoanPricingCalculator.classic(parameters);
            };
            emit(context, "option_" + optionId.toLowerCase() + ".rate", rate, kind);
            context.workspace().putOption(option.withRate(rate.ratePct()));
            options.addObject().put("optionId", optionId).put("pricing", kind.name());
            if (kind == Kind.CLASSIC && classic == null) {
                classic = rate;
            } else if (kind == Kind.GREEN && green == null) {
                green = rate;
            }
        }
        if (classic != null && green != null) {
            difference(context, new LoanPricing(classic, green));
        }
        return context.ok(result, "Am calculat dobânda pe componente pentru " + options.size() + " opțiuni");
    }

    private static GreenTier greenTier(ToolContext context, String optionId) {
        GreenTier tier = context.workspace().greenTier().tier();
        if (tier == GreenTier.CLASIC) {
            throw new IllegalArgumentException("Nivelul verde e CLASIC: opțiunea " + optionId
                    + " nu poate primi creditul verde");
        }
        return tier;
    }

    private static void emit(ToolContext context, String p, RateBreakdown rate, Kind kind) {
        Calc index = context.calc(p + ".index", "Indice EURIBOR 3M", rate.indexPct(), Unit.PCT)
                .source(PricingConfig.sourceOf(context, null, "index")).add();
        Calc funding = context.calc(p + ".funding_cost", "Cost de finanțare", rate.fundingCostPct(), Unit.PCT)
                .source(PricingConfig.sourceOf(context, "classic", "fundingCostPct")).add();
        Calc risk = context.calc(p + ".risk_cost", "Cost de risc", rate.riskCostPct(), Unit.PCT)
                .formula("PD × LGD × (1 − g)").source(PricingConfig.sourceOf(context, "risk", "lgdPct")).add();
        Calc capital = context.calc(p + ".capital_cost", "Cost de capital", rate.capitalCostPct(), Unit.PCT)
                .formula("RW efectiv × rata de capital × costul capitalului")
                .source(PricingConfig.sourceOf(context, "risk", "capitalRatioPct")).add();
        Calc operational = context.calc(p + ".operational_cost", "Cost operațional", rate.operationalCostPct(), Unit.PCT)
                .source(PricingConfig.sourceOf(context, "classic", "operationalCostPct")).add();
        Calc profit = context.calc(p + ".target_profit", "Profit țintă", rate.targetProfitPct(), Unit.PCT)
                .source(PricingConfig.sourceOf(context, "classic", "targetProfitPct")).add();
        if (kind != Kind.CLASSIC) {
            context.calc(p + ".guarantee_coverage", "Partea acoperită de garanție (g)", rate.guaranteeCoveragePct(),
                    Unit.PCT).add();
            context.calc(p + ".effective_risk_weight", "Ponderea de risc efectivă", rate.effectiveRiskWeightPct(),
                    Unit.PCT).formula("RW client × (1 − g) + RW garant × g")
                    .source(PricingConfig.sourceOf(context, "risk", "riskWeightGuarantorPct")).add();
        }
        if (kind == Kind.GREEN) {
            context.calc(p + ".program_subsidy", "Subvenție sau comision redus pe program", rate.programSubsidyPct(),
                    Unit.PCT).source(PricingConfig.sourceOf(context, "green", "programSubsidyAdjustmentPp")).add();
            context.calc(p + ".tier_adjustment", "Ajustarea pentru nivelul verde", rate.tierAdjustmentPct(), Unit.PCT)
                    .source("config/pricing.json: greenTiers.marginAdjustmentPp").add();
        }
        Calc margin = context.calc(p + ".margin", "Marja", rate.marginPct(), Unit.PCT)
                .formula("finanțare + risc + capital + operațional + profit (+ subvenție + nivel verde)")
                .dependsOn(funding, risk, capital, operational, profit).add();
        context.calc(p, kind == Kind.GREEN ? "Dobânda creditului verde" : "Dobânda creditului", rate.ratePct(), Unit.PCT)
                .formula("indice + marjă").dependsOn(index, margin).add();
    }

    private static void difference(ToolContext context, LoanPricing pricing) {
        diff(context, "funding_cost", "cost de finanțare (obligațiuni verzi)", pricing.fundingCostDifferencePp());
        diff(context, "risk_cost", "cost de risc (garanția FEI și PD mai mic)", pricing.riskCostDifferencePp());
        diff(context, "capital_cost", "cost de capital (ponderea de risc a garantului)", pricing.capitalCostDifferencePp());
        diff(context, "operational_cost", "cost operațional (analiză automată)", pricing.operationalCostDifferencePp());
        diff(context, "program_subsidy", "subvenție pe program", pricing.programSubsidyDifferencePp());
        diff(context, "tier_adjustment", "nivelul verde", pricing.tierAdjustmentDifferencePp());
        context.calc("pricing.diff.rate", "Dobânda verde față de cea clasică", pricing.rateDifferencePp(), Unit.PCT)
                .formula("dobânda verde − dobânda clasică").add();
    }

    private static void diff(ToolContext context, String component, String labelRo, BigDecimal value) {
        context.calc("pricing.diff." + component, "Verde față de clasic: " + labelRo, value, Unit.PCT).add();
    }
}
