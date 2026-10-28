package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.impact.ImpactCalculator;
import ro.greenstruct.agro.engine.irrigation.CropArea;
import ro.greenstruct.agro.engine.irrigation.IrrigationCalculator;
import ro.greenstruct.agro.engine.irrigation.IrrigationSystem;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Today's situation on the selected parcels: water and pumping energy (irrigation) or diesel and nitrogen
 * (machinery). Norms from config, confirmed or replaced by the invoices already extracted.
 */
@Component
public class ComputeBaselineTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_baseline";
    }

    @Override
    public String description() {
        return "Computes today's consumption on the selected parcels (water and energy for irrigation, diesel and "
                + "nitrogen for machinery) from norms and the extracted invoices. Extract the invoices first.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "currentSystem": {"type": "string", "enum": ["ASPERSIE_VECHE", "ASPERSIE", "PICURARE", "BRAZDE"],
                    "description": "Irrigation only; defaults to the questionnaire answer irrigation_current."},
                  "currentFleet": {"type": "object", "additionalProperties": false,
                    "description": "Machinery only; defaults to the questionnaire (current_tractors, replaced_tractors, replaced_fleet_age).",
                    "properties": {
                      "totalCount": {"type": "integer", "minimum": 0},
                      "replacedCount": {"type": "integer", "minimum": 0},
                      "averageAgeYears": {"type": "integer", "minimum": 0}}}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        return context.calculator().baseline(input, context);
    }
}
