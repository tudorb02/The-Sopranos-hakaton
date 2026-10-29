package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.organic.OrganicCalculator;
import ro.greenstruct.agro.engine.organic.PhasingAdvice;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/**
 * README §6 category 6, step D: the full conversion (all hectares in the first year) against the phased one (parcel
 * by parcel, from the catalog alternative), with the margin against the conventional farm per year and the
 * first-year liquidity gap of each. The engine rule recommends phasing only when the full conversion's gap cannot be
 * covered by the grace period and the APIA pre-financing.
 */
@Component
public class CompareConversionPlansTool implements ToolHandler {

    @Override
    public String name() {
        return "compare_conversion_plans";
    }

    @Override
    public String description() {
        return "Organic module only: compares the full conversion with the phased one (catalog alternative) - margin "
                + "against the conventional farm per year, the first-year monthly liquidity gap and the APIA "
                + "pre-financing capacity - and says which plan to take. Call it after compute_baseline.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.EMPTY_OBJECT;
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        if (!"organic".equals(context.module().calculator())) {
            throw new IllegalArgumentException("This tool applies only to the Organic module");
        }
        OrganicPlans.Setup setup = OrganicPlans.setup(context);
        OrganicPlans.Phasing phased = phasedVariant(context);
        OrganicPlans.PlanFigures full = OrganicPlans.figures(setup, OrganicPlans.Phasing.full());
        OrganicPlans.PlanFigures staged = OrganicPlans.figures(setup, phased);

        List<BigDecimal> fullGap = OrganicPlans.monthlyGap(setup, full.tranches(), setup.startYear(),
                OrganicPlans.noInstalments());
        List<BigDecimal> phasedGap = OrganicPlans.monthlyGap(setup, staged.tranches(), setup.startYear(),
                OrganicPlans.noInstalments());
        BigDecimal fullCoverage = OrganicPlans.coverage(context, setup, full.tranches(), setup.startYear());
        BigDecimal phasedCoverage = OrganicPlans.coverage(context, setup, staged.tranches(), setup.startYear());
        PhasingAdvice advice = OrganicCalculator.advisePhasing(OrganicCalculator.total(fullGap), fullCoverage,
                OrganicCalculator.total(phasedGap), phasedCoverage);

        emitPlan(context, "plan.full", "full conversion", full, fullGap, fullCoverage);
        emitPlan(context, "plan.phased", "phased conversion", staged, phasedGap, phasedCoverage);
        context.calc("plan.benefit_delayed", "Gain deferred by phasing (cumulative margin full − phased)",
                full.marginTotalEur().subtract(staged.marginTotalEur()), Unit.EUR)
                .formula("cumulative margin over the horizon, full conversion minus phased").add();
        context.calc("plan.shortfall", "Part of the first-year gap not covered by APIA pre-financing",
                advice.shortfallEur(), Unit.EUR).formula("max(0, gap − pre-financing capacity), recommended plan").add();

        ObjectNode result = context.newResult();
        result.put("recommendedPlan", advice.choice().name());
        result.put("fullCovered", advice.fullCovered());
        result.put("phasedCovered", advice.phasedCovered());
        result.put("phasedCatalogId", phasedCatalogId(context));
        String message = advice.choice() == PhasingAdvice.Choice.FULL
                ? (advice.fullCovered()
                ? "Full conversion: the first-year gap is covered by the grace period and APIA pre-financing; it earns more"
                : "Full conversion, but the first-year gap is not fully covered; phasing would not reduce it")
                : "Phased conversion: the full conversion's first-year gap cannot be covered by the grace period and "
                + "APIA pre-financing";
        return context.ok(result, message);
    }

    private static void emitPlan(ToolContext context, String p, String label, OrganicPlans.PlanFigures figures,
                                 List<BigDecimal> gap, BigDecimal coverage) {
        for (int i = 0; i < figures.years().size(); i++) {
            context.calc(p + ".margin_y" + (i + 1), "Margin vs conventional, year " + figures.years().get(i).year()
                    + " (" + label + ")", figures.marginVsConventional(i), Unit.EUR_PER_YEAR).add();
        }
        context.calc(p + ".margin_total", "Cumulative margin vs conventional (" + label + ")", figures.marginTotalEur(),
                Unit.EUR).add();
        context.calc(p + ".gap_y1", "First-year liquidity gap (" + label + ")", OrganicCalculator.total(gap),
                Unit.EUR).formula("Σ monthly max(0, expenses + instalments − revenue − subsidies); no instalments in grace").add();
        context.calc(p + ".gap_peak", "Largest monthly gap in the first year (" + label + ")", OrganicCalculator.peak(gap),
                Unit.EUR_PER_MONTH).add();
        context.calc(p + ".coverage", "APIA pre-financing capacity in the first year (" + label + ")", coverage, Unit.EUR)
                .formula("advance percentage × (APIA subsidies today + first-year organic payments)")
                .source(context.paramSource("apiaPrefinancingAdvancePct")).add();
    }

    /** The phased plan is the catalog alternative that carries phasedFirstTranchePct. */
    private static OrganicPlans.Phasing phasedVariant(ToolContext context) {
        JsonNode item = phasedItem(context);
        JsonNode effect = item.path("effect");
        return new OrganicPlans.Phasing(true, effect.path(OrganicPlans.PHASED_FIRST_TRANCHE_PCT).decimalValue(),
                effect.path(OrganicPlans.PHASED_DELAY_YEARS).asInt(1));
    }

    private static String phasedCatalogId(ToolContext context) {
        return phasedItem(context).path("catalogId").asText();
    }

    private static JsonNode phasedItem(ToolContext context) {
        for (JsonNode item : CatalogItems.withRole(context, "ALTERNATIVE")) {
            if (item.path("effect").has(OrganicPlans.PHASED_FIRST_TRANCHE_PCT)) {
                return item;
            }
        }
        throw new IllegalStateException("The module catalog has no phased alternative");
    }
}
