package ro.greenstruct.agro.orchestration;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

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
 * "Simulează 12 luni" (README §13): after drawdown, simulated monitoring data gives the real impact; it is compared
 * with the estimate of the approved dossier and, when it confirms it, the green rate gets the impact bonus
 * (config/pricing.json, a product proposal). Figures come from the engine and the config; the deviation is simulated.
 */
@Service
public class MonitoringService {

    private static final String TOOL = "simulate_monitoring";
    private static final String SOURCE = "config/monitoring.json, config/pricing.json (parametri demo)";

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
            throw new IllegalStateException("Monitorizarea se simulează doar din starea MONITORIZARE; acum e în "
                    + run.status());
        }
        if (run.monitoring() != null) {
            throw new IllegalStateException("Monitorizarea a fost deja simulată pentru acest dosar");
        }
        if (run.submission() == null || run.submission().variant() != Submission.Variant.VERDE) {
            throw new IllegalStateException("Dosarul are credit clasic: nu are impact verde de monitorizat");
        }
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        if (report == null || funding == null) {
            throw new IllegalStateException("Dosarul nu are raport verde de monitorizat");
        }

        BigDecimal deviation = Params.value(reference.monitoring().path("simulatedDeviationPct"), "simulatedDeviationPct");
        BigDecimal tolerance = Params.value(reference.monitoring().path("tolerancePct"), "tolerancePct");
        Calc deviationCalc = calcs.create(runId, TOOL, "monitoring.deviation", "Abaterea simulată a impactului real",
                deviation, Unit.PCT, "valoare simulată în demo", SOURCE, List.of(), null);

        ArrayNode metrics = mapper.createArrayNode();
        boolean confirmed = true;
        for (JsonNode impact : report.path("impact")) {
            if (!"ANNUAL".equals(impact.path("period").asText())) {
                continue;
            }
            Calc estimated = calcs.find(runId, impact.path("calcId").asText()).orElseThrow(() ->
                    new IllegalStateException("Cifra " + impact.path("calcId").asText() + " lipsește"));
            String metric = impact.path("metric").asText();
            ImpactMonitoring.Comparison comparison = ImpactMonitoring.compare(estimated.value(), deviation, tolerance);
            Calc actual = calcs.create(runId, TOOL, "monitoring." + metric + ".actual",
                    "Impact real la 12 luni: " + estimated.labelRo(), comparison.actual(), estimated.unit(),
                    "estimare × (1 + abatere)", SOURCE, List.of(estimated.calcId(), deviationCalc.calcId()), null);
            ObjectNode row = metrics.addObject();
            row.put("metric", metric);
            row.put("estimatedCalcId", estimated.calcId());
            row.put("actualCalcId", actual.calcId());
            row.put("deviationPctCalcId", deviationCalc.calcId());
            row.put("withinTolerance", comparison.withinTolerance());
            confirmed &= comparison.withinTolerance();
        }
        if (metrics.isEmpty()) {
            throw new IllegalStateException("Raportul nu are impact anual de monitorizat");
        }

        Calc rateBefore = greenRate(runId, run, funding);
        BigDecimal bonus = Params.value(reference.pricing().path("green").path("impactBonusAdjustmentPp"),
                "impactBonusAdjustmentPp");
        Calc bonusCalc = calcs.create(runId, TOOL, "monitoring.bonus", "Bonusul de impact", confirmed ? bonus
                : BigDecimal.ZERO, Unit.PP, "bonus aplicat doar dacă impactul real confirmă estimarea", SOURCE,
                List.of(), null);
        Calc rateAfter = calcs.create(runId, TOOL, "monitoring.rate_after", "Dobânda verde după bonusul de impact",
                ImpactMonitoring.rateAfterBonus(rateBefore.value(), bonus, confirmed), Unit.PCT,
                "dobânda verde + bonus", SOURCE, List.of(rateBefore.calcId(), bonusCalc.calcId()), null);

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
                        new IllegalStateException("Dobânda verde " + calcId + " lipsește"));
            }
        }
        throw new IllegalStateException("Dosarul nu are opțiunea aleasă de IMM");
    }
}
