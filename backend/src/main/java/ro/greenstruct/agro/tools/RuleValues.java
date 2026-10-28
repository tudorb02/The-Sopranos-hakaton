package ro.greenstruct.agro.tools;

import java.math.BigDecimal;

import ro.greenstruct.agro.engine.machinery.MachineryCalculator;

/** Prices, emission factors and thresholds from config/, read the same way by every tool. */
public final class RuleValues {

    private RuleValues() {
    }

    public static BigDecimal factor(ToolContext context, String name) {
        return Params.value(context.reference().factors().path(name), "factors." + name);
    }

    public static String factorSource(ToolContext context, String name) {
        return context.reference().factors().path(name).path("sourceRo").asText(null);
    }

    public static BigDecimal price(ToolContext context, String name) {
        return Params.value(context.reference().prices().path(name), "prices." + name);
    }

    public static String priceSource(ToolContext context, String name) {
        return context.reference().prices().path(name).path("sourceRo").asText(null);
    }

    /** Net diesel cost for a VAT payer: pump price / (1 + VAT) − agricultural excise refund, in EUR. */
    public static BigDecimal dieselNetEurPerLitre(ToolContext context) {
        return MachineryCalculator.netDieselEurPerLitre(price(context, "dieselPumpLeiPerLitre"),
                factor(context, "vatPct"), price(context, "dieselExciseRefundLeiPerLitre"),
                factor(context, "ronPerEur"));
    }

    public static BigDecimal thresholdPct(ToolContext context) {
        return context.module().threshold().value();
    }

    public static BigDecimal safetyMarginPct(ToolContext context) {
        return context.module().parameters().has("safetyMarginPct") ? context.param("safetyMarginPct")
                : BigDecimal.ZERO;
    }

    public static BigDecimal financingDefault(ToolContext context, String name) {
        return Params.value(context.reference().financingLines().path("defaults").path(name), "defaults." + name);
    }
}
