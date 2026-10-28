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
            throw new IllegalArgumentException("Unealta se aplică doar modulului Ecologic");
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

        emitPlan(context, "plan.full", "conversie integrală", full, fullGap, fullCoverage);
        emitPlan(context, "plan.phased", "conversie etapizată", staged, phasedGap, phasedCoverage);
        context.calc("plan.benefit_delayed", "Câștig amânat prin etapizare (marja cumulată integral − etapizat)",
                full.marginTotalEur().subtract(staged.marginTotalEur()), Unit.EUR)
                .formula("marja cumulată pe orizont, conversia integrală minus cea etapizată").add();
        context.calc("plan.shortfall", "Cât din golul din primul an rămâne neacoperit de prefinanțarea APIA",
                advice.shortfallEur(), Unit.EUR).formula("max(0, gol − capacitate de prefinanțare), planul recomandat").add();

        ObjectNode result = context.newResult();
        result.put("recommendedPlan", advice.choice().name());
        result.put("fullCovered", advice.fullCovered());
        result.put("phasedCovered", advice.phasedCovered());
        result.put("phasedCatalogId", phasedCatalogId(context));
        String message = advice.choice() == PhasingAdvice.Choice.FULL
                ? (advice.fullCovered()
                ? "Conversia integrală: golul din primul an e acoperit de grație și prefinanțarea APIA; câștigă mai mult"
                : "Conversia integrală, dar golul din primul an nu e acoperit complet; etapizarea nu l-ar micșora")
                : "Conversia etapizată: golul din primul an al celei integrale nu poate fi acoperit de grație și "
                + "prefinanțarea APIA";
        return context.ok(result, message);
    }

    private static void emitPlan(ToolContext context, String p, String label, OrganicPlans.PlanFigures figures,
                                 List<BigDecimal> gap, BigDecimal coverage) {
        for (int i = 0; i < figures.years().size(); i++) {
            context.calc(p + ".margin_y" + (i + 1), "Marja față de convențional, anul " + figures.years().get(i).year()
                    + " (" + label + ")", figures.marginVsConventional(i), Unit.EUR_PER_YEAR).add();
        }
        context.calc(p + ".margin_total", "Marja cumulată față de convențional (" + label + ")", figures.marginTotalEur(),
                Unit.EUR).add();
        context.calc(p + ".gap_y1", "Golul de lichiditate din primul an (" + label + ")", OrganicCalculator.total(gap),
                Unit.EUR).formula("Σ lunar max(0, cheltuieli + rate − venituri − subvenții); fără rate în grație").add();
        context.calc(p + ".gap_peak", "Cel mai mare gol lunar din primul an (" + label + ")", OrganicCalculator.peak(gap),
                Unit.EUR_PER_MONTH).add();
        context.calc(p + ".coverage", "Capacitatea de prefinanțare APIA în primul an (" + label + ")", coverage, Unit.EUR)
                .formula("procent de avans × (subvenții APIA azi + plăți bio din primul an)")
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
        throw new IllegalStateException("Catalogul modulului nu are alternativa etapizată");
    }
}
