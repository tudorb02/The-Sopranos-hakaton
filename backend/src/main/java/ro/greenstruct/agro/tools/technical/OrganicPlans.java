package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.time.Month;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.organic.CropPlan;
import ro.greenstruct.agro.engine.organic.OrganicCalculator;
import ro.greenstruct.agro.engine.organic.OrganicParameters;
import ro.greenstruct.agro.engine.organic.Tranche;
import ro.greenstruct.agro.engine.organic.YearResult;
import ro.greenstruct.agro.external.model.CashflowInfo;
import ro.greenstruct.agro.external.model.FarmInfo;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.fraction;

/**
 * Reads the organic conversion inputs (config, farm, questionnaire, baseline) into the engine's records and
 * runs the engine for a plan, full or phased. Shared by OrganicModule and the organic tools; no numbers are
 * computed here beyond calling engine/organic.
 */
public final class OrganicPlans {

    /** A catalog ALTERNATIVE with this attribute makes the plan phased (data/catalog/ecologic.json). */
    public static final String PHASED_FIRST_TRANCHE_PCT = "phasedFirstTranchePct";
    public static final String PHASED_DELAY_YEARS = "phasedDelayYears";

    private static final Map<String, Month> MONTHS = Map.ofEntries(
            Map.entry("JAN", Month.JANUARY), Map.entry("FEB", Month.FEBRUARY), Map.entry("MAR", Month.MARCH),
            Map.entry("APR", Month.APRIL), Map.entry("MAY", Month.MAY), Map.entry("JUN", Month.JUNE),
            Map.entry("JUL", Month.JULY), Map.entry("AUG", Month.AUGUST), Map.entry("SEP", Month.SEPTEMBER),
            Map.entry("OCT", Month.OCTOBER), Map.entry("NOV", Month.NOVEMBER), Map.entry("DEC", Month.DECEMBER));

    private OrganicPlans() {
    }

    /** The farm and the conversion as the baseline stored them, plus the config and the monthly profile. */
    public record Setup(OrganicParameters parameters, List<CropPlan> crops, BigDecimal farmHa, BigDecimal conversionHa,
                        int startYear, int horizonYears, BigDecimal existingApiaEur, MonthlyProfile profile) {
    }

    /** Shares of the 12 calendar months (January first) of the farm's inflows and outflows and of the APIA payments. */
    public record MonthlyProfile(List<BigDecimal> inflowShares, List<BigDecimal> outflowShares,
                                 List<BigDecimal> subsidyShares) {
    }

    /** How a plan is built: a single tranche, or two (phasedFirstTranchePct of the hectares first). */
    public record Phasing(boolean phased, BigDecimal firstTranchePct, int delayYears) {
        public static Phasing full() {
            return new Phasing(false, BigDecimal.valueOf(100), 0);
        }
    }

    /** What the engine says about one plan: years, the conventional farm, and the monthly gap without instalments. */
    public record PlanFigures(Phasing phasing, List<Tranche> tranches, YearResult conventional,
                              List<YearResult> years, BigDecimal marginTotalEur) {
        public BigDecimal marginVsConventional(int index) {
            return OrganicCalculator.marginVsConventional(years.get(index), conventional);
        }
    }

    public static OrganicParameters parameters(ToolContext context) {
        return new OrganicParameters(
                List.of(context.param("yieldPctConversionYear1"), context.param("yieldPctConversionYear2")),
                context.param("yieldPctCertified"), context.param("organicPricePremiumPct"),
                context.param("costEurPerHaConventional"), context.param("costEurPerHaOrganic"),
                context.param("conversionPaymentEurPerHa"), context.param("maintenancePaymentEurPerHa"));
    }

    /** Crops of the selected parcels: hectares from APIA, conventional yield from the farm's latest year, price from config. */
    public static List<CropPlan> crops(ToolContext context) {
        Map<String, BigDecimal> haByCrop = new LinkedHashMap<>();
        for (JsonNode parcel : FarmFacts.selectedParcels(context)) {
            haByCrop.merge(parcel.path("crop").asText(), parcel.path("areaHa").decimalValue(), BigDecimal::add);
        }
        JsonNode prices = context.module().parameters().path("cropPriceEurPerT").path("value");
        List<CropPlan> crops = new ArrayList<>();
        haByCrop.forEach((crop, ha) -> {
            FarmInfo.Crop latest = context.farm().farm().crops().stream()
                    .filter(c -> c.crop().equals(crop)).max(java.util.Comparator.comparingInt(FarmInfo.Crop::year))
                    .orElseThrow(() -> new IllegalArgumentException("Crop \"" + crop
                            + "\" has no historical yield at APIA"));
            if (!prices.path(crop).isNumber()) {
                throw new IllegalArgumentException("No reference price for crop \"" + crop
                        + "\" (config/modules/ecologic.json, cropPriceEurPerT)");
            }
            crops.add(new CropPlan(crop, ha, latest.yieldTPerHa(), prices.path(crop).decimalValue()));
        });
        return crops;
    }

    /** Needs the baseline (conversion hectares and start year) from compute_baseline. */
    public static Setup setup(ToolContext context) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        if (!baseline.containsKey("conversion_ha")) {
            throw new IllegalArgumentException("Run compute_baseline first");
        }
        List<CropPlan> crops = crops(context);
        BigDecimal farmHa = crops.stream().map(CropPlan::ha).reduce(BigDecimal.ZERO, BigDecimal::add);
        FarmInfo farm = context.farm().farm();
        return new Setup(parameters(context), crops, farmHa, baseline.get("conversion_ha"),
                baseline.get("start_year").intValueExact(), FinancingConfig.horizonYears(context),
                farm.apiaSubsidiesEur() == null ? BigDecimal.ZERO : farm.apiaSubsidiesEur(), profile(context));
    }

    public static Phasing phasing(List<InvestmentComponent> components) {
        for (InvestmentComponent component : components) {
            BigDecimal first = component.attribute(PHASED_FIRST_TRANCHE_PCT);
            if (first != null) {
                BigDecimal delay = component.attribute(PHASED_DELAY_YEARS);
                return new Phasing(true, first, delay == null ? 1 : delay.intValueExact());
            }
        }
        return Phasing.full();
    }

    public static List<Tranche> tranches(Setup setup, Phasing phasing) {
        BigDecimal share = setup.conversionHa().divide(setup.farmHa(), MC);
        if (!phasing.phased()) {
            return List.of(new Tranche(share, setup.startYear()));
        }
        BigDecimal first = share.multiply(fraction(phasing.firstTranchePct()), MC);
        return List.of(new Tranche(first, setup.startYear()),
                new Tranche(share.subtract(first), setup.startYear() + phasing.delayYears()));
    }

    public static PlanFigures figures(Setup setup, Phasing phasing) {
        List<Tranche> tranches = tranches(setup, phasing);
        YearResult conventional = OrganicCalculator.conventional(setup.crops(), setup.startYear(), setup.parameters());
        List<YearResult> years = OrganicCalculator.plan(setup.crops(), tranches, setup.startYear(),
                setup.horizonYears(), setup.parameters());
        return new PlanFigures(phasing, tranches, conventional, years,
                OrganicCalculator.totalMarginVsConventional(years, conventional));
    }

    /**
     * Monthly gap of one calendar year, from the flows the conversion changes against the conventional farm:
     * revenue and expenses change by the yearly difference spread like the farm's Open Banking inflows and outflows;
     * the organic payments arrive in the months of config (subsidyPaymentSharePct); instalments are those of the loan.
     */
    public static List<BigDecimal> monthlyGap(Setup setup, List<Tranche> tranches, int year,
                                              List<BigDecimal> instalmentsByMonth) {
        YearResult conventional = OrganicCalculator.conventional(setup.crops(), year, setup.parameters());
        YearResult plan = OrganicCalculator.year(setup.crops(), tranches, year, setup.parameters());
        return OrganicCalculator.monthlyGap(
                OrganicCalculator.spread(plan.expensesEur().subtract(conventional.expensesEur()),
                        setup.profile().outflowShares()),
                instalmentsByMonth,
                OrganicCalculator.spread(plan.revenueEur().subtract(conventional.revenueEur()),
                        setup.profile().inflowShares()),
                OrganicCalculator.spread(plan.subsidiesEur(), setup.profile().subsidyShares()));
    }

    public static List<BigDecimal> noInstalments() {
        return java.util.Collections.nCopies(12, BigDecimal.ZERO);
    }

    /** What the APIA pre-financing can advance for a plan in a year: share × (APIA subsidies today + organic payments). */
    public static BigDecimal coverage(ToolContext context, Setup setup, List<Tranche> tranches, int year) {
        YearResult plan = OrganicCalculator.year(setup.crops(), tranches, year, setup.parameters());
        return OrganicCalculator.prefinancingCapacity(context.param("apiaPrefinancingAdvancePct"),
                setup.existingApiaEur().add(plan.subsidiesEur(), MC));
    }

    private static MonthlyProfile profile(ToolContext context) {
        CashflowInfo cashflow = context.farm().cashflow();
        if (cashflow == null) {
            throw new IllegalArgumentException("Without Open Banking consent we cannot compute the monthly liquidity gap");
        }
        BigDecimal[] in = zeros();
        BigDecimal[] out = zeros();
        for (CashflowInfo.MonthFlow flow : cashflow.months()) {
            int m = flow.month().getMonthValue() - 1;
            in[m] = in[m].add(flow.inflowEur());
            out[m] = out[m].add(flow.outflowEur());
        }
        BigDecimal[] subsidies = zeros();
        JsonNode schedule = context.module().parameters().path("subsidyPaymentSharePct").path("value");
        BigDecimal total = BigDecimal.ZERO;
        for (var entry : (Iterable<Map.Entry<String, JsonNode>>) schedule::fields) {
            Month month = MONTHS.get(entry.getKey());
            if (month == null) {
                throw new IllegalStateException("subsidyPaymentSharePct: unknown month " + entry.getKey());
            }
            subsidies[month.getValue() - 1] = entry.getValue().decimalValue();
            total = total.add(entry.getValue().decimalValue());
        }
        if (total.compareTo(BigDecimal.valueOf(100)) != 0) {
            throw new IllegalStateException("subsidyPaymentSharePct must add up to 100, got " + total);
        }
        List<BigDecimal> subsidyShares = java.util.Arrays.stream(subsidies).map(v -> fraction(v)).toList();
        return new MonthlyProfile(OrganicCalculator.monthlyShares(List.of(in)),
                OrganicCalculator.monthlyShares(List.of(out)), subsidyShares);
    }

    private static BigDecimal[] zeros() {
        BigDecimal[] values = new BigDecimal[12];
        java.util.Arrays.fill(values, BigDecimal.ZERO);
        return values;
    }
}
