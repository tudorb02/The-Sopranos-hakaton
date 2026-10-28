package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/** The bank products this module can use: rates, guarantees, collateral costs, term and comparison horizon. */
@Component
public class ListFinancingLinesTool implements ToolHandler {

    @Override
    public String name() {
        return "list_financing_lines";
    }

    @Override
    public String description() {
        return "Lists the Raiffeisen financing lines and guarantees available for this module (standard, green, "
                + "co-financing, bridge), with rates, guarantee coverage, collateral costs, term and horizon.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.EMPTY_OBJECT;
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        ObjectNode result = context.newResult();
        ArrayNode lines = result.putArray("lines");
        for (String lineId : FinancingConfig.moduleLines(context)) {
            JsonNode line = FinancingConfig.requireLine(context, lineId);
            String key = "line." + FinancingConfig.shortId(lineId);
            context.calc(key + ".rate", "Dobândă " + line.path("nameRo").asText(), FinancingConfig.rate(line), Unit.PCT)
                    .source("config/financing-lines.json (demo)").add();
            BigDecimal upfront = line.path("collateralUpfrontEur").decimalValue();
            if (upfront.signum() > 0) {
                context.calc(key + ".collateral_initial", "Costuri inițiale ipotecă", upfront, Unit.EUR).add();
                context.calc(key + ".collateral_annual", "Costuri anuale ipotecă",
                        line.path("collateralAnnualEur").decimalValue(), Unit.EUR_PER_YEAR).add();
            }
            ObjectNode node = lines.addObject();
            node.put("lineId", lineId);
            node.put("kind", line.path("kind").asText());
            node.put("green", line.path("green").asBoolean());
            node.put("collateral", line.path("collateral").asText());
            node.set("repayment", line.path("repayment"));
            String guaranteeId = line.path("guaranteeId").asText(null);
            if (guaranteeId != null) {
                node.put("guaranteeId", guaranteeId);
                FinancingConfig.guarantee(context, guaranteeId).ifPresent(g -> context.calc(
                        "guarantee." + FinancingConfig.shortId(guaranteeId) + ".coverage", g.path("nameRo").asText(),
                        g.path("coveragePct").decimalValue(), Unit.PCT).source(g.path("sourceRo").asText()).add());
            }
        }
        context.calc("line.term", "Durata creditului", BigDecimal.valueOf(FinancingConfig.termMonths(context, input)),
                Unit.MONTHS).add();
        context.calc("line.horizon", "Orizontul comparației", BigDecimal.valueOf(FinancingConfig.horizonYears(context)),
                Unit.YEARS).add();
        context.calc("line.affordability_limit", "Limita ratelor față de cashflow",
                RuleValues.financingDefault(context, "affordabilityLimitPct"), Unit.PCT).add();
        return context.ok(result, "Am încărcat liniile de finanțare pentru modulul " + context.module().nameRo());
    }
}
