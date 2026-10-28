package ro.greenstruct.agro.tools.technical;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;

/** The facts DNSH needs: permits, water meter, protected or nitrate-vulnerable parcels, the old equipment's fate. */
@Component
public class CheckDnshInputsTool implements ToolHandler {

    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    @Override
    public String name() {
        return "check_dnsh_inputs";
    }

    @Override
    public String description() {
        return "Returns the facts needed for the DNSH check of a configuration: parcels in Natura 2000 or nitrate "
                + "vulnerable zones, drought risk, water permit and meter (irrigation), emission stage and the fate "
                + "of the old equipment.";
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
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration cfg = context.workspace().configuration(Params.requiredText(input, "configId"));
        ObjectNode result = context.newResult();
        result.set("natura2000Parcels", context.mapper().valueToTree(FarmFacts.parcelsWhere(context, "natura2000")));
        result.set("nitrateVulnerableParcels", context.mapper().valueToTree(FarmFacts.parcelsWhere(context, "nitrateVulnerable")));
        result.put("droughtRisk", FarmFacts.maxRisk(context, "droughtRisk"));
        result.put("oldEquipmentFate", context.questionnaire().path("old_equipment_fate").asText("NECUNOSCUT"));

        if ("irrigation".equals(context.module().calculator())) {
            result.put("waterMeterInConfig", cfg.components().stream().anyMatch(c -> "WATER_METER".equals(c.category())));
            context.workspace().documentOfType("WATER_PERMIT_ANAR").ifPresentOrElse(permit -> {
                String validUntil = permit.texts().get("PERMIT_VALID_UNTIL");
                result.put("permitPresent", true);
                result.put("permitValid", validUntil != null && !parseDate(validUntil).isBefore(context.today()));
            }, () -> result.put("permitPresent", false));
            result.put("waterSource", context.questionnaire().path("water_source").asText("NECUNOSCUT"));
        } else {
            var stages = result.putArray("emissionStages");
            context.workspace().documentOfType("OFFER").ifPresent(offer -> offer.lines().forEach(line -> {
                String stage = line.texts().get("EMISSION_STAGE");
                if (stage != null) {
                    stages.add(line.lineId() + ": " + stage);
                }
            }));
            result.put("tillage", context.questionnaire().path("tillage").asText("NECUNOSCUT"));
            var used = result.putArray("usedEquipment");
            cfg.components().stream().filter(EquipmentAge::isUsed).forEach(c -> used.addObject()
                    .put("componentId", c.componentId())
                    .put("ageYears", EquipmentAge.ageYears(context, c)));
        }
        return context.ok(result, "Am verificat datele pentru DNSH");
    }

    private static LocalDate parseDate(String raw) {
        try {
            return LocalDate.parse(raw.trim(), RO_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data „" + raw + "” din aviz nu are formatul zz.ll.aaaa");
        }
    }
}
