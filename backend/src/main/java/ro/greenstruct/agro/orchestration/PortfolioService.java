package ro.greenstruct.agro.orchestration;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import ro.greenstruct.agro.engine.portfolio.PortfolioAggregator;
import ro.greenstruct.agro.engine.portfolio.PortfolioAggregator.Loan;
import ro.greenstruct.agro.modules.ReferenceData;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;

/**
 * The bank's green portfolio (README §8 panel 7): the approved dossiers whose farmer chose the green loan. Figures are
 * the calcs of each dossier, added up by the engine; after "Simulează 12 luni" the measured impact replaces the estimate.
 */
@Service
public class PortfolioService {

    private final RunStore runs;
    private final CalcStore calcs;
    private final ReferenceData reference;

    public PortfolioService(RunStore runs, CalcStore calcs, ReferenceData reference) {
        this.runs = runs;
        this.calcs = calcs;
        this.reference = reference;
    }

    public record View(Instant generatedAt, PortfolioAggregator.Portfolio portfolio, Map<String, String> fundNames,
                       boolean parametersDemo) {
    }

    public View portfolio() {
        List<Loan> loans = new ArrayList<>();
        for (Run run : runs.all()) {
            if (run.status() == RunStatus.MONITORIZARE && run.submission() != null
                    && run.submission().variant() == Submission.Variant.VERDE) {
                loan(run).ifPresent(loans::add);
            }
        }
        Map<String, String> fundNames = new HashMap<>();
        reference.funds().path("funds").forEach(f -> fundNames.put(f.path("fundId").asText(), f.path("nameRo").asText()));
        return new View(Instant.now(), PortfolioAggregator.aggregate(loans), fundNames, true);
    }

    private Optional<Loan> loan(Run run) {
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        if (funding == null || report == null) {
            return Optional.empty();
        }
        BigDecimal amount = loanAmount(run, funding);
        Map<String, BigDecimal> impact = impact(run, report);
        boolean monitored = run.monitoring() != null;
        return Optional.of(new Loan(run.request().moduleId(), report.path("fund").path("fundId").asText("F1"),
                funding.path("greenTier").path("tier").asText("VERDE"), amount,
                impact.getOrDefault("CO2_AVOIDED_T", BigDecimal.ZERO),
                impact.containsKey("RENEWABLE_KWH") ? impact.get("RENEWABLE_KWH")
                        : impact.getOrDefault("ENERGY_SAVED_KWH", BigDecimal.ZERO),
                impact.getOrDefault("WATER_SAVED_M3", BigDecimal.ZERO), impact.getOrDefault("FUEL_SAVED_L", BigDecimal.ZERO),
                impact.getOrDefault("NITROGEN_SAVED_KG", BigDecimal.ZERO),
                impact.getOrDefault("CERTIFIED_AREA_HA", BigDecimal.ZERO), monitored,
                monitored && run.monitoring().path("confirmed").asBoolean()));
    }

    private BigDecimal loanAmount(Run run, JsonNode funding) {
        for (JsonNode option : funding.path("options")) {
            if (!option.path("optionId").asText().equals(run.submission().optionId())) {
                continue;
            }
            for (JsonNode item : option.path("fundingStack")) {
                String type = item.path("type").asText();
                if ("GREEN_LOAN".equals(type) || "CO_FINANCING_LOAN".equals(type)) {
                    return calcs.find(run.id(), item.path("amountCalcId").asText()).map(Calc::value).orElse(BigDecimal.ZERO);
                }
            }
        }
        return BigDecimal.ZERO;
    }

    /** Annual impact by metric; the measured value replaces the estimate when the monitoring was simulated. */
    private Map<String, BigDecimal> impact(Run run, JsonNode report) {
        Map<String, String> measured = new HashMap<>();
        if (run.monitoring() != null) {
            run.monitoring().path("metrics").forEach(m ->
                    measured.put(m.path("estimatedCalcId").asText(), m.path("actualCalcId").asText()));
        }
        Map<String, BigDecimal> byMetric = new HashMap<>();
        for (JsonNode entry : report.path("impact")) {
            if (!"ANNUAL".equals(entry.path("period").asText())) {
                continue;
            }
            String calcId = measured.getOrDefault(entry.path("calcId").asText(), entry.path("calcId").asText());
            calcs.find(run.id(), calcId).ifPresent(calc -> byMetric.merge(entry.path("metric").asText(), calc.value(),
                    BigDecimal::add));
        }
        return byMetric;
    }
}
