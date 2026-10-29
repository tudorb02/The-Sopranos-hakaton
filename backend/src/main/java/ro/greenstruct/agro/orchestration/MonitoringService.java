package ro.greenstruct.agro.orchestration;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import ro.greenstruct.agro.engine.monitoring.ImpactMonitoring;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Unit;

/**
 * "Simulate 12 months" (README §13): after drawdown, simulated monitoring data gives the real impact; it is compared
 * with the estimate of the approved dossier and, when it confirms it, the green rate gets the impact bonus
 * (config/pricing.json, a product proposal). Figures come from the engine and the config; the deviation is simulated.
 */
@Service
public class MonitoringService {

    private static final String TOOL = "simulate_monitoring";
    private static final String SOURCE = "config/monitoring.json, config/pricing.json (demo parameters)";

    /**
     * Impact metrics where a higher measured value confirms the estimate. Consumption metrics (water used, pumping
     * energy, CO₂ emitted, ...) are reported but not monitored here: for them a higher value would be worse.
     */
    private static final Set<String> BENEFIT_METRICS = Set.of(
            "WATER_SAVING_PCT", "WATER_SAVED_M3", "ENERGY_SAVED_KWH", "GRID_ENERGY_REPLACED_KWH", "RENEWABLE_KWH",
            "FUEL_SAVING_PCT", "FUEL_SAVED_L", "NITROGEN_SAVED_KG", "PRECISION_SHARE_PCT", "CO2_AVOIDED_T",
            "WATER_COST_SAVED_EUR", "ENERGY_COST_SAVED_EUR", "FUEL_COST_SAVED_EUR", "INPUTS_COST_SAVED_EUR",
            "CERTIFIED_AREA_HA");

    private final RunStore store;
    private final CalcStore calcs;
    private final ReferenceData reference;
    private final ObjectMapper mapper;

    public MonitoringService(RunStore store, CalcStore calcs, ReferenceData reference, ObjectMapper mapper) {
        this.store = store;
        this.calcs = calcs;
        this.reference = reference;
        this.mapper = mapper;
    }

    public Run simulate(String runId) {
        Run run = store.find(runId).orElseThrow(() -> new RunNotFoundException(runId));
        if (run.status() != RunStatus.MONITORIZARE) {
            throw new IllegalStateException("Monitoring can only be simulated from status MONITORIZARE; it is now "
                    + run.status());
        }
        if (run.monitoring() != null) {
            throw new IllegalStateException("Monitoring has already been simulated for this dossier");
        }
        if (run.submission() == null || run.submission().variant() != Submission.Variant.VERDE) {
            throw new IllegalStateException("The dossier has a classic credit: there is no green impact to monitor");
        }
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        if (report == null || funding == null) {
            throw new IllegalStateException("The dossier has no green report to monitor");
        }

        BigDecimal deviation = Params.value(reference.monitoring().path("simulatedDeviationPct"), "simulatedDeviationPct");
        BigDecimal tolerance = Params.value(reference.monitoring().path("tolerancePct"), "tolerancePct");
        Calc deviationCalc = calcs.create(runId, TOOL, "monitoring.deviation", "Simulated deviation of the actual impact",
                deviation, Unit.PCT, "simulated value in the demo", SOURCE, List.of(), null);

        ArrayNode metrics = mapper.createArrayNode();
        boolean confirmed = true;
        for (JsonNode impact : report.path("impact")) {
            if (!"ANNUAL".equals(impact.path("period").asText())) {
                continue;
            }
            Calc estimated = calcs.find(runId, impact.path("calcId").asText()).orElseThrow(() ->
                    new IllegalStateException("Figure " + impact.path("calcId").asText() + " is missing"));
            String metric = impact.path("metric").asText();
            // a negative or zero "saving" is a cost increase or no effect: there is no benefit to confirm
            if (!BENEFIT_METRICS.contains(metric) || estimated.value().signum() <= 0) {
                continue;
            }
            ImpactMonitoring.Comparison comparison = ImpactMonitoring.compare(estimated.value(), deviation, tolerance);
            Calc actual = calcs.create(runId, TOOL, "monitoring." + metric + ".actual",
                    "Actual impact at 12 months: " + estimated.labelRo(), comparison.actual(), estimated.unit(),
                    "estimate × (1 + deviation)", SOURCE, List.of(estimated.calcId(), deviationCalc.calcId()), null);
            ObjectNode row = metrics.addObject();
            row.put("metric", metric);
            row.put("estimatedCalcId", estimated.calcId());
            row.put("actualCalcId", actual.calcId());
            row.put("deviationPctCalcId", deviationCalc.calcId());
            row.put("withinTolerance", comparison.withinTolerance());
            confirmed &= comparison.withinTolerance();
        }
        if (metrics.isEmpty()) {
            throw new IllegalStateException("The report has no annual impact to monitor");
        }

        Calc rateBefore = greenRate(runId, run, funding);
        BigDecimal bonus = Params.value(reference.pricing().path("green").path("impactBonusAdjustmentPp"),
                "impactBonusAdjustmentPp");
        Calc bonusCalc = calcs.create(runId, TOOL, "monitoring.bonus", "Impact bonus", confirmed ? bonus
                : BigDecimal.ZERO, Unit.PP, "bonus applied only if the actual impact confirms the estimate", SOURCE,
                List.of(), null);
        Calc rateAfter = calcs.create(runId, TOOL, "monitoring.rate_after", "Green interest rate after the impact bonus",
                ImpactMonitoring.rateAfterBonus(rateBefore.value(), bonus, confirmed), Unit.PCT,
                "green interest rate + bonus", SOURCE, List.of(rateBefore.calcId(), bonusCalc.calcId()), null);

        ObjectNode result = mapper.createObjectNode();
        result.put("months", 12);
        result.put("simulated", true);
        result.set("metrics", metrics);
        result.put("confirmed", confirmed);
        result.put("impactBonusApplied", confirmed);
        result.put("rateBeforeCalcId", rateBefore.calcId());
        result.put("rateAfterCalcId", rateAfter.calcId());
        result.put("bonusPpCalcId", bonusCalc.calcId());
        return store.update(runId, r -> r.withMonitoring(result));
    }

    /** The rate of the option the farmer chose. */
    private Calc greenRate(String runId, Run run, JsonNode funding) {
        for (JsonNode option : funding.path("options")) {
            if (option.path("optionId").asText().equals(run.submission().optionId())) {
                String calcId = option.path("rateBreakdown").path("rateCalcId").asText();
                return calcs.find(runId, calcId).orElseThrow(() ->
                        new IllegalStateException("Green interest rate " + calcId + " is missing"));
            }
        }
        throw new IllegalStateException("The dossier does not have the option chosen by the SME");
    }
}
