package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.greentier.GreenTierResult;
import ro.greenstruct.agro.engine.pricing.LoanPricing;
import ro.greenstruct.agro.engine.pricing.LoanPricingCalculator;
import ro.greenstruct.agro.engine.pricing.PricingParameters;
import ro.greenstruct.agro.engine.pricing.RateBreakdown;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/**
 * README §4 step 6: the classic and the green rate by component (index + funding + risk + capital + operational +
 * profit, minus the green reductions) and the difference of each component. The rates are kept in the workspace;
 * build_scenario then uses them instead of the flat rate of the financing line.
 */
@Component
public class PriceLoanTool implements ToolHandler {

    private static final String SOURCE = "config/pricing.json, config/funds.json (parametri demo până răspund mentorii)";

    @Override
    public String name() {
        return "price_loan";
    }

    @Override
    public String description() {
        return "Computes the classic and the green interest rate by component (funding cost, risk cost PD×LGD×(1−g), "
                + "capital cost, operational cost, profit, programme subsidy, tier adjustment) and the difference of "
                + "each component. Call determine_green_tier first, then this, then build_scenario.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        GreenTierResult tier = context.workspace().tier();
        if (!tier.tier().isGreen()) {
            throw new IllegalArgumentException("Nivelul este CLASIC: nu există credit verde de calculat");
        }
        PricingParameters parameters = PricingSupport.parameters(context);
        LoanPricing pricing = LoanPricingCalculator.price(parameters, PricingSupport.green(context, tier.tier()));
        context.workspace().putPricing("CLASIC", pricing.classic());
        context.workspace().putPricing("VERDE", pricing.green());

        Calc index = context.calc("pricing.index", "Indicele EURIBOR 3M", parameters.indexPct(), Unit.PCT)
                .source(context.reference().pricing().path("index").path("sourceRo").asText(null)).add();
        emit(context, "classic", pricing.classic(), index);
        emit(context, "green", pricing.green(), index);
        diff(context, "funding_cost", "Cost de finanțare", pricing.fundingCostDifferencePp());
        diff(context, "risk_cost", "Cost de risc", pricing.riskCostDifferencePp());
        diff(context, "capital_cost", "Cost de capital", pricing.capitalCostDifferencePp());
        diff(context, "operational_cost", "Cost operațional", pricing.operationalCostDifferencePp());
        diff(context, "program_subsidy", "Subvenție sau comision redus pe program", pricing.programSubsidyDifferencePp());
        diff(context, "tier_adjustment", "Ajustarea nivelului verde", pricing.tierAdjustmentDifferencePp());
        context.calc("pricing.diff.total", "Dobânda verde față de cea clasică", pricing.rateDifferencePp(), Unit.PP)
                .formula("dobândă verde − dobândă clasică = suma diferențelor pe componente").source(SOURCE).add();

        ObjectNode result = context.newResult();
        result.put("tier", tier.tier().name());
        result.put("parametersDemo", true);
        return context.ok(result, "Dobânda clasică și cea verde, pe componente");
    }

    private static void emit(ToolContext context, String variant, RateBreakdown rate, Calc index) {
        String p = "pricing." + variant + ".";
        String label = "classic".equals(variant) ? "clasic" : "verde";
        component(context, p + "funding_cost", "Cost de finanțare (" + label + ")", rate.fundingCostPct(),
                "cost de finanțare al băncii");
        component(context, p + "risk_cost", "Cost de risc (" + label + ")", rate.riskCostPct(), "PD × LGD × (1 − g)");
        component(context, p + "capital_cost", "Cost de capital (" + label + ")", rate.capitalCostPct(),
                "RW efectiv × rata de capital × costul capitalului");
        component(context, p + "operational_cost", "Cost operațional (" + label + ")", rate.operationalCostPct(),
                "analiza și administrarea dosarului");
        component(context, p + "target_profit", "Profit țintă (" + label + ")", rate.targetProfitPct(), "profit țintă");
        if ("green".equals(variant)) {
            component(context, p + "program_subsidy", "Subvenție sau comision redus pe program",
                    rate.programSubsidyPct(), "ajustare de program");
            component(context, p + "tier_adjustment", "Ajustarea nivelului verde", rate.tierAdjustmentPct(),
                    "ajustare pe nivel verde");
        }
        Calc margin = context.calc(p + "margin", "Marja (" + label + ")", rate.marginPct(), Unit.PCT)
                .formula("suma componentelor de mai sus").source(SOURCE).add();
        context.calc(p + "rate", "Dobânda " + label, rate.ratePct(), Unit.PCT).formula("indice + marjă")
                .dependsOn(index, margin).source(SOURCE).add();
    }

    private static void component(ToolContext context, String key, String label, BigDecimal value, String formula) {
        context.calc(key, label, value, Unit.PCT).formula(formula).source(SOURCE).add();
    }

    private static void diff(ToolContext context, String component, String label, BigDecimal valuePp) {
        context.calc("pricing.diff." + component, label + ": verde − clasic", valuePp, Unit.PP)
                .formula("componenta verde − componenta clasică").source(SOURCE).add();
    }
}
