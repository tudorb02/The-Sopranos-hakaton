package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Month;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.finance.FinancialMath;
import ro.greenstruct.agro.engine.finance.Installment;
import ro.greenstruct.agro.engine.finance.LoanCalculator;
import ro.greenstruct.agro.engine.finance.LoanSchedule;
import ro.greenstruct.agro.engine.finance.ScenarioCost;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.technical.EquipmentAge;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.FinancingOption;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Repayment schedule and costs of one option over the module's horizon: equal monthly installments or
 * seasonal ones (only in the months the farm cashes in), interest, bridge interest, collateral costs and the
 * yearly savings of the financed configuration.
 */
@Component
public class BuildScenarioTool implements ToolHandler {

    private static final Map<String, Month> MONTHS = Map.ofEntries(
            Map.entry("JAN", Month.JANUARY), Map.entry("FEB", Month.FEBRUARY), Map.entry("MAR", Month.MARCH),
            Map.entry("APR", Month.APRIL), Map.entry("MAY", Month.MAY), Map.entry("JUN", Month.JUNE),
            Map.entry("JUL", Month.JULY), Map.entry("AUG", Month.AUGUST), Map.entry("SEP", Month.SEPTEMBER),
            Map.entry("OCT", Month.OCTOBER), Map.entry("NOV", Month.NOVEMBER), Map.entry("DEC", Month.DECEMBER));

    @Override
    public String name() {
        return "build_scenario";
    }

    @Override
    public String description() {
        return "Computes the repayment schedule (EQUAL_MONTHLY or SEASONAL, paid only in the cash-in months), total "
                + "interest including the bridge loan, collateral costs, savings over the horizon and the net cost "
                + "of one option. Call build_funding_stack first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["optionId", "scheduleType"], "properties": {
                  "optionId": {"type": "string", "enum": ["A", "B", "C"]},
                  "scheduleType": {"type": "string", "enum": ["EQUAL_MONTHLY", "SEASONAL"]},
                  "termMonths": {"type": "integer", "minimum": 12, "maximum": 120,
                    "description": "Defaults to the farmer's answer loan_term, else the module default."},
                  "paymentMonths": {"type": "array", "items": {"type": "string",
                    "enum": ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]},
                    "description": "SEASONAL only; defaults to the questionnaire answer cashin_months."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        FinancingOption option = context.workspace().option(Params.requiredText(input, "optionId"));
        Configuration cfg = context.workspace().configuration(option.configId());
        JsonNode line = FinancingConfig.requireLine(context, option.mainLineId());
        int horizonYears = FinancingConfig.horizonYears(context);
        int termMonths = FinancingConfig.termMonths(context, input);
        checkTerm(context, line, cfg, termMonths);
        YearMonth firstMonth = YearMonth.from(context.today())
                .plusMonths(RuleValues.financingDefault(context, "firstInstallmentOffsetMonths").longValue());
        BigDecimal rate = context.workspace().pricing("A".equals(option.optionId()) ? "CLASIC" : "VERDE")
                .map(priced -> priced.ratePct())
                .orElseGet(() -> FinancingConfig.rate(line));
        String p = "option_" + option.optionId().toLowerCase() + ".";

        boolean seasonal = "SEASONAL".equals(Params.requiredText(input, "scheduleType"));
        // Module-specific grace (organic: sized by the liquidity gap of the conversion years); 0 for the other modules.
        int grace = line.path("green").asBoolean(false) ? context.calculator().graceMonths(context, cfg) : 0;
        if (grace > 0) {
            context.calc(p + "grace_months", "Perioadă de grație (fără rate)", BigDecimal.valueOf(grace), Unit.MONTHS)
                    .formula("până la ultima lună cu gol de lichiditate, maximum din config").add();
        }
        LoanSchedule schedule;
        Calc installment;
        if (!seasonal && grace > 0) {
            schedule = LoanCalculator.seasonal(option.mainLoanEur(), rate, termMonths, firstMonth,
                    EnumSet.allOf(Month.class), grace);
            installment = context.calc(p + "installment", "Rata lunară după grație", schedule.installmentEur(),
                    Unit.EUR_PER_MONTH).formula("rate egale după perioada de grație; VA la dobânda creditului = principalul")
                    .add();
        } else if (seasonal) {
            if (!contains(line.path("repayment"), "SEASONAL")) {
                throw new IllegalArgumentException("Linia " + option.mainLineId() + " nu permite rate sezoniere");
            }
            Set<Month> months = paymentMonths(input, context);
            schedule = LoanCalculator.seasonal(option.mainLoanEur(), rate, termMonths, firstMonth, months, grace);
            installment = context.calc(p + "installment", "Rata sezonieră", schedule.installmentEur(), Unit.EUR)
                    .formula("rate egale doar în lunile cu încasări; VA la dobânda creditului = principalul").add();
            context.calc(p + "grace", "Luni fără rată până la prima încasare",
                    BigDecimal.valueOf(monthsBeforeFirstPayment(schedule)), Unit.MONTHS).add();
        } else {
            schedule = LoanCalculator.monthly(option.mainLoanEur(), rate, termMonths, firstMonth);
            installment = context.calc(p + "installment", "Rata lunară", schedule.installmentEur(), Unit.EUR_PER_MONTH)
                    .formula("PMT = P · r / (1 − (1 + r)^−n)").add();
        }
        context.calc(p + "schedule", "Total plătit pe credit", schedule.totalPaidEur(), Unit.EUR)
                .series(series(schedule)).dependsOn(installment).add();

        BigDecimal interest = schedule.totalInterestEur().add(option.bridgeInterestEur());
        if (option.bridgeLoanEur().signum() > 0) {
            context.calc(p + "bridge.interest", "Dobânda creditului-punte", option.bridgeInterestEur(), Unit.EUR)
                    .formula("punte × dobândă × luni / 12").add();
        }
        BigDecimal totalPayments = schedule.totalPaidEur().add(option.bridgeLoanEur()).add(option.bridgeInterestEur());
        context.calc(p + "total_payments", "Total plăți (credit + punte)", totalPayments, Unit.EUR).add();
        context.calc(p + "total_interest", "Total dobânzi", interest, Unit.EUR).add();

        BigDecimal collateral = FinancialMath.recurringCost(line.path("collateralUpfrontEur").decimalValue(),
                line.path("collateralAnnualEur").decimalValue(), horizonYears);
        if (collateral.signum() > 0) {
            context.calc(p + "collateral_costs", "Costuri cu ipoteca", collateral, Unit.EUR)
                    .formula("cost inițial + cost anual × ani").add();
        }

        BigDecimal yearlySavings = BigDecimal.ZERO;
        for (Map.Entry<String, String> saving : savingsMetrics(context).entrySet()) {
            BigDecimal value = cfg.metricOrZero(saving.getKey());
            yearlySavings = yearlySavings.add(value);
            context.calc(p + "savings." + saving.getValue(), "Economie anuală (" + saving.getValue() + ")", value,
                    Unit.EUR_PER_YEAR).add();
        }
        BigDecimal horizonSavings = yearlySavings.multiply(BigDecimal.valueOf(horizonYears), MC);
        context.calc(p + "savings_horizon", "Economii pe " + horizonYears + " ani", horizonSavings, Unit.EUR).add();

        ScenarioCost cost = new ScenarioCost(option.optionId(), cfg.totalCost(), option.grantEur(), interest, collateral,
                horizonSavings);
        context.calc(p + "net_cost", "Cost net pe " + horizonYears + " ani", cost.netCostEur(), Unit.EUR)
                .formula("investiție − grant + dobânzi + costuri garanții − economii").add();

        Map<String, BigDecimal> totals = new HashMap<>();
        totals.put("capex", cfg.totalCost());
        totals.put("grant", option.grantEur());
        totals.put("interest", interest);
        totals.put("collateral", collateral);
        totals.put("savings_year", yearlySavings);
        totals.put("savings_horizon", horizonSavings);
        totals.put("net_cost", cost.netCostEur());
        context.workspace().putOption(option.withScenario(schedule, totals));

        ObjectNode result = context.newResult();
        result.put("optionId", option.optionId());
        result.put("scheduleType", seasonal ? "SEASONAL" : "EQUAL_MONTHLY");
        result.put("firstInstallmentMonth", schedule.installments().stream()
                .filter(i -> i.paymentEur().signum() > 0).findFirst().map(i -> i.month().toString()).orElse(null));
        return context.ok(result, "Scenariul " + option.optionId() + ": rată " + installment.display());
    }

    /**
     * The term must fit the line, and second-hand machines must not be older than the limit when the last
     * installment is paid (a 5-year-old tractor on a 7-year loan is 12 at maturity).
     */
    private static void checkTerm(ToolContext context, JsonNode line, Configuration cfg, int termMonths) {
        int maxTerm = line.path("maxTermMonths").asInt(Integer.MAX_VALUE);
        if (termMonths > maxTerm) {
            throw new IllegalArgumentException("Linia " + line.path("lineId").asText() + " permite cel mult "
                    + maxTerm + " luni");
        }
        int maxAge = RuleValues.financingDefault(context, "maxEquipmentAgeAtMaturityYears").intValue();
        for (var component : cfg.components()) {
            if (!EquipmentAge.isUsed(component)) {
                continue;
            }
            int ageAtMaturity = EquipmentAge.ageYears(context, component) + (termMonths + 11) / 12;
            if (ageAtMaturity > maxAge) {
                int maxYears = maxAge - EquipmentAge.ageYears(context, component);
                throw new IllegalArgumentException("Utilajul second-hand " + component.nameRo() + " ar avea "
                        + ageAtMaturity + " ani la ultima rată (maximum " + maxAge + "); creditul poate fi de cel mult "
                        + Math.max(0, maxYears) + " ani");
            }
        }
    }

    /** Which configuration metrics are yearly savings in EUR, per calculator. */
    private static Map<String, String> savingsMetrics(ToolContext context) {
        return context.calculator().savingsMetrics();
    }

    private static Set<Month> paymentMonths(JsonNode input, ToolContext context) {
        List<String> names = Params.textList(input, "paymentMonths");
        if (names.isEmpty()) {
            context.questionnaire().path("cashin_months").forEach(m -> names.add(m.asText()));
        }
        if (names.isEmpty()) {
            throw new IllegalArgumentException("Lipsesc lunile de încasare pentru ratele sezoniere");
        }
        Set<Month> months = EnumSet.noneOf(Month.class);
        for (String name : names) {
            Month month = MONTHS.get(name);
            if (month == null) {
                throw new IllegalArgumentException("Lună necunoscută: " + name);
            }
            months.add(month);
        }
        return months;
    }

    private static int monthsBeforeFirstPayment(LoanSchedule schedule) {
        int months = 0;
        for (Installment installment : schedule.installments()) {
            if (installment.paymentEur().signum() > 0) {
                return months;
            }
            months++;
        }
        return months;
    }

    private static List<Calc.SeriesPoint> series(LoanSchedule schedule) {
        List<Calc.SeriesPoint> points = new ArrayList<>();
        for (Installment i : schedule.installments()) {
            points.add(new Calc.SeriesPoint(i.month().toString(), Map.of(
                    "payment", round(i.paymentEur()), "interest", round(i.interestEur()),
                    "principal", round(i.principalEur()), "balance", round(i.balanceEur()))));
        }
        return points;
    }

    private static BigDecimal round(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    private static boolean contains(JsonNode array, String value) {
        for (JsonNode item : array) {
            if (value.equals(item.asText())) {
                return true;
            }
        }
        return false;
    }
}
