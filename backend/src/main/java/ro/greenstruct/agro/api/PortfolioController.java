package ro.greenstruct.agro.api;

import java.time.Instant;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ro.greenstruct.agro.engine.portfolio.PortfolioAggregator;
import ro.greenstruct.agro.orchestration.PortfolioService;

/** GET /api/portfolio (Portfolio in contracts/openapi.yaml). */
@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final PortfolioService portfolio;

    public PortfolioController(PortfolioService portfolio) {
        this.portfolio = portfolio;
    }

    public record Portfolio(Instant generatedAt, int loanCount, java.math.BigDecimal totalAmountEur,
                            List<ModuleTotal> byModule, List<FundTotal> byFund, List<TierTotal> byTier, Impact impact,
                            Monitoring monitoring, boolean parametersDemo) {
    }

    public record ModuleTotal(String moduleId, int count, java.math.BigDecimal amountEur) {
    }

    public record FundTotal(String fundCode, String nameRo, int count, java.math.BigDecimal amountEur) {
    }

    public record TierTotal(String tier, int count) {
    }

    public record Impact(java.math.BigDecimal co2AvoidedT, java.math.BigDecimal energyMwh, java.math.BigDecimal waterM3,
                         java.math.BigDecimal fuelL, java.math.BigDecimal nitrogenKg, java.math.BigDecimal certifiedAreaHa) {
    }

    public record Monitoring(int monitoredCount, int confirmedCount) {
    }

    @GetMapping
    public Portfolio get() {
        PortfolioService.View view = portfolio.portfolio();
        PortfolioAggregator.Portfolio p = view.portfolio();
        PortfolioAggregator.Impact i = p.impact();
        return new Portfolio(view.generatedAt(), p.loanCount(), p.totalAmountEur(),
                p.byModule().stream().map(g -> new ModuleTotal(g.key(), g.count(), g.amountEur())).toList(),
                p.byFund().stream().map(g -> new FundTotal(g.key(), view.fundNames().getOrDefault(g.key(), g.key()),
                        g.count(), g.amountEur())).toList(),
                p.byTier().stream().map(g -> new TierTotal(g.key(), g.count())).toList(),
                new Impact(i.co2AvoidedT(), i.energyMwh(), i.waterM3(), i.fuelL(), i.nitrogenKg(), i.certifiedAreaHa()),
                new Monitoring(p.monitoredCount(), p.confirmedCount()), view.parametersDemo());
    }
}
