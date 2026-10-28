package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/** Builds the initial configuration from the extracted offer and checks it against the green threshold. */
@Component
public class ComputeIndicatorTool implements ToolHandler {

    @Override
    public String name() {
        return "compute_indicator";
    }

    @Override
    public String description() {
        return "Builds the configuration described by the farmer's offer (configId, usually cfg_initial) and computes "
                + "the module indicator against today's baseline: PASS or FAIL against the green threshold.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["documentId"], "properties": {
                  "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$", "default": "cfg_initial"},
                  "documentId": {"type": "string", "description": "The extracted OFFER document."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        String configId = input.path("configId").asText("cfg_initial");
        String documentId = Params.requiredText(input, "documentId");
        DocumentFacts offer = context.workspace().document(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Extrage întâi documentul " + documentId));

        Configuration cfg = ConfigurationMetrics.build(context, configId, null,
                offerComponents(offer, context.today().getYear(), context.calculator()));
        context.workspace().putConfiguration(cfg);
        ConfigurationMetrics.emit(context, cfg, cfg);

        ObjectNode result = context.newResult();
        result.put("configId", configId);
        result.put("thresholdResult", cfg.passesThreshold() ? "PASS" : "FAIL");
        result.put("meetsSafetyMargin", ConfigurationMetrics.meetsSafetyMargin(context, cfg));
        if (cfg.metrics().containsKey("hp_per_ha")) {
            result.put("sizing", ConfigurationMetrics.sizingOk(context, cfg.metrics()) ? "PASS" : "FAIL");
        }
        ArrayNode components = result.putArray("components");
        cfg.components().forEach(c -> components.addObject().put("componentId", c.componentId())
                .put("category", c.category()).put("nameRo", c.nameRo()));
        return context.ok(result, "Oferta inițială: " + (cfg.passesThreshold() ? "trece" : "nu trece")
                + " pragul verde");
    }

    /**
     * One component per offer line; document-level technical fields go to the matching component, and
     * every line records whether it is second-hand and its manufacture year.
     */
    static List<InvestmentComponent> offerComponents(DocumentFacts offer, int currentYear, ModuleCalculator calculator) {
        List<InvestmentComponent> components = new ArrayList<>();
        for (DocumentFacts.LineFacts line : offer.lines()) {
            BigDecimal price = line.numbers().get("LINE_PRICE_NET");
            if (price == null) {
                continue;
            }
            Map<String, BigDecimal> attributes = new HashMap<>(EquipmentAge.fromOfferLine(line, currentYear));
            BigDecimal quantity = line.numbers().getOrDefault("QUANTITY", BigDecimal.ONE);
            calculator.offerAttributes(line, offer, attributes);
            components.add(new InvestmentComponent("cmp_offer_" + line.lineId(), line.category(), line.descriptionRo(),
                    "OFFER", null, quantity, price, attributes));
        }
        if (components.isEmpty()) {
            throw new IllegalArgumentException("Oferta " + offer.documentId() + " nu are poziții cu preț");
        }
        return components;
    }
}
