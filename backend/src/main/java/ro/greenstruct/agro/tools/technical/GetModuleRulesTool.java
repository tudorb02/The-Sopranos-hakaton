package ro.greenstruct.agro.tools.technical;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.Decimals;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

/** The module's green threshold, norms, prices and factors, each as a calc with its source. */
@Component
public class GetModuleRulesTool implements ToolHandler {

    @Override
    public String name() {
        return "get_module_rules";
    }

    @Override
    public String description() {
        return "Returns the green threshold of the dossier's module, the norms, prices and emission factors used "
                + "by the calculations, and the upgrade catalog (ids, categories, roles). Call it first.";
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
        var module = context.module();
        if ("irrigation".equals(module.calculator())) {
            context.calc("rules.threshold.water_saving", "Pragul verde: economie de apă",
                    RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
            context.calc("rules.need_net", "Necesarul net de apă", context.param("netNeedM3PerHa"), Unit.M3_PER_HA)
                    .source(context.paramSource("netNeedM3PerHa")).add();
            context.calc("rules.price.water", "Prețul apei", context.param("waterPriceEurPerM3"), Unit.EUR_PER_M3)
                    .source(context.paramSource("waterPriceEurPerM3")).add();
            context.calc("rules.price.electricity", "Prețul energiei electrice",
                    RuleValues.price(context, "electricityEurPerKwh"), Unit.EUR_PER_KWH)
                    .source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
            context.calc("rules.factor.grid", "Factor de emisie al rețelei",
                    RuleValues.factor(context, "gridKgCo2PerKwh"), Unit.KG_CO2_PER_KWH)
                    .source(RuleValues.factorSource(context, "gridKgCo2PerKwh")).add();
            context.calc("rules.pv_yield", "Producția specifică a panourilor", context.param("pvYieldKwhPerKwp"),
                    Unit.KWH_PER_KWP).source(context.paramSource("pvYieldKwhPerKwp")).add();
        } else if ("machinery".equals(module.calculator())) {
            context.calc("rules.threshold.fuel_saving", "Pragul verde: economie de motorină",
                    RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
            context.calc("rules.norm.l_per_ha", "Norma de motorină", context.param("baselineLitresPerHa"), Unit.L_PER_HA)
                    .source(context.paramSource("baselineLitresPerHa")).add();
            context.calc("rules.saving.new_vs_old", "Economie tractor nou față de unul de peste 15 ani",
                    EquipmentAge.savingFraction(context, 0, 20).multiply(Decimals.HUNDRED), Unit.PCT)
                    .formula("1 − g/kWh tractor nou / g/kWh tractor vechi")
                    .source(context.paramSource("specificFuelByAge")).add();
            context.calc("rules.price.fuel_net", "Costul net al motorinei", RuleValues.dieselNetEurPerLitre(context),
                    Unit.EUR_PER_L).formula("(preț la pompă / (1 + TVA) − acciză rambursată) / curs EUR")
                    .source(RuleValues.priceSource(context, "dieselExciseRefundLeiPerLitre")).add();
            context.calc("rules.factor.diesel", "Factor de emisie motorină",
                    RuleValues.factor(context, "dieselKgCo2PerLitre"), Unit.KG_CO2_PER_L)
                    .source(RuleValues.factorSource(context, "dieselKgCo2PerLitre")).add();
            context.calc("rules.sizing.max_hp_ha", "Putere maximă pe hectar", context.param("maxHpPerHa"),
                    Unit.HP_PER_HA).source(context.paramSource("maxHpPerHa")).add();
        } else {
            throw new IllegalArgumentException("Modulul " + module.moduleId() + " nu e încă disponibil în demo");
        }

        ObjectNode result = context.newResult();
        result.put("indicator", module.indicator());
        result.put("calculator", module.calculator());
        result.put("thresholdKind", module.threshold().kind());
        ArrayNode catalog = result.putArray("catalog");
        context.catalog().path("items").forEach(item -> catalog.addObject()
                .put("catalogId", item.path("catalogId").asText())
                .put("category", item.path("category").asText())
                .put("role", item.path("role").asText())
                .put("nameRo", item.path("nameRo").asText()));
        return context.ok(result, "Regulile modulului " + module.nameRo() + " sunt încărcate");
    }
}
