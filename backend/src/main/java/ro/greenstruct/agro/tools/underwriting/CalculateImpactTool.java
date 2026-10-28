package ro.greenstruct.agro.tools.underwriting;

import java.math.BigDecimal;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.funding.FinancingConfig;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;
import static ro.greenstruct.agro.engine.Decimals.toPct;

/** How much of the loan is green, transition or neither, and the environmental impact over the horizon. */
@Component
public class CalculateImpactTool implements ToolHandler {

    @Override
    public String name() {
        return "calculate_impact";
    }

    @Override
    public String description() {
        return "For a configuration: amounts labelled green (Taxonomy + market) and transition, the green share, "
                + "and the water, energy or diesel and CO₂ saved over the comparison horizon.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["configId"], "properties": {
                  "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.GREEN_UNDERWRITER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration cfg = context.workspace().configuration(Params.requiredText(input, "configId"));
        BigDecimal green = BigDecimal.ZERO;
        BigDecimal taxonomy = BigDecimal.ZERO;
        BigDecimal transition = BigDecimal.ZERO;
        for (InvestmentComponent component : cfg.components()) {
            String label = ComponentLabels.label(context, cfg, component);
            if (ComponentLabels.isGreen(label)) {
                green = green.add(component.costEur());
            }
            if ("TAXONOMY_ALIGNED".equals(label)) {
                taxonomy = taxonomy.add(component.costEur());
            }
            if ("TRANSITION".equals(label)) {
                transition = transition.add(component.costEur());
            }
        }
        context.calc("label.green_amount", "Sumă etichetată verde", green, Unit.EUR).add();
        context.calc("label.taxonomy_amount", "Din care aliniată la Taxonomia UE", taxonomy, Unit.EUR).add();
        context.calc("label.transition_amount", "Sumă etichetată tranziție", transition, Unit.EUR).add();
        context.calc("label.green_share", "Ponderea verde a investiției", toPct(green.divide(cfg.totalCost(), MC)),
                Unit.PCT).formula("sumă verde / investiție totală").add();

        BigDecimal years = BigDecimal.valueOf(FinancingConfig.horizonYears(context));
        if ("irrigation".equals(context.module().calculator())) {
            context.calc("impact.water_horizon", "Apă economisită pe orizont",
                    cfg.metric("water_saved_m3").multiply(years, MC), Unit.M3).add();
            context.calc("impact.energy_horizon", "Energie economisită pe orizont",
                    cfg.metric("energy_saved_kwh").multiply(years, MC), Unit.KWH).add();
        } else {
            context.calc("impact.fuel_horizon", "Motorină economisită pe orizont",
                    cfg.metric("fuel_saved_l").multiply(years, MC), Unit.L).add();
        }
        context.calc("impact.co2_horizon", "CO₂ evitat pe orizont", cfg.metric("co2_avoided_t").multiply(years, MC),
                Unit.T_CO2).add();
        return context.ok(context.newResult().put("configId", cfg.configId()),
                "Am calculat impactul configurației " + cfg.configId());
    }
}
