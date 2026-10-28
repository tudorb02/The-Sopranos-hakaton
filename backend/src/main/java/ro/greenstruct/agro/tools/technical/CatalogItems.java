package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;

/** Upgrade catalog items (data/catalog/&lt;module&gt;.json) turned into configuration components. */
public final class CatalogItems {

    private CatalogItems() {
    }

    public static List<JsonNode> withRole(ToolContext context, String role) {
        List<JsonNode> items = new ArrayList<>();
        context.catalog().path("items").forEach(item -> {
            if (role.equals(item.path("role").asText())) {
                items.add(item);
            }
        });
        return items;
    }

    public static JsonNode item(ToolContext context, String catalogId) {
        for (JsonNode item : context.catalog().path("items")) {
            if (catalogId.equals(item.path("catalogId").asText())) {
                return item;
            }
        }
        throw new IllegalArgumentException("Articolul " + catalogId + " nu există în catalogul modulului "
                + context.module().moduleId());
    }

    /** A new machine with the same power and quantity as the offered one, priced per horsepower. */
    public static InvestmentComponent newEquivalent(JsonNode item, InvestmentComponent offered, int currentYear) {
        BigDecimal hp = offered.attribute("hp");
        if (hp == null) {
            throw new IllegalArgumentException("Componenta " + offered.componentId() + " nu are puterea în CP");
        }
        Map<String, BigDecimal> attributes = new HashMap<>();
        attributes.put("hp", hp);
        attributes.put(EquipmentAge.MANUFACTURE_YEAR, BigDecimal.valueOf(currentYear));
        attributes.put(EquipmentAge.USED, BigDecimal.ZERO);
        attributes.put(EquipmentAge.STAGE_V, BigDecimal.ONE);
        BigDecimal cost = item.path("costEurPerHp").decimalValue().multiply(hp, MC).multiply(offered.quantity(), MC);
        return new InvestmentComponent(offered.componentId().replace("cmp_offer_", "cmp_new_"), offered.category(),
                item.path("nameRo").asText() + " (" + hp.toPlainString() + " CP)", "CATALOG",
                item.path("catalogId").asText(), offered.quantity(), cost, attributes);
    }

    /** Per-tractor items are multiplied by the number of tractors in the configuration. */
    public static InvestmentComponent toComponent(JsonNode item, BigDecimal tractorCount) {
        boolean perTractor = item.has("costEurPerTractor");
        BigDecimal quantity = perTractor ? tractorCount : BigDecimal.ONE;
        BigDecimal cost = perTractor
                ? item.path("costEurPerTractor").decimalValue().multiply(tractorCount, MC)
                : item.path("costEur").decimalValue();
        Map<String, BigDecimal> attributes = new HashMap<>();
        item.path("effect").fields().forEachRemaining(e -> attributes.put(e.getKey(), e.getValue().decimalValue()));
        String catalogId = item.path("catalogId").asText();
        return new InvestmentComponent("cmp_" + catalogId.replace('.', '_'), item.path("category").asText(),
                item.path("nameRo").asText(), "CATALOG", catalogId, quantity, cost, attributes);
    }
}
