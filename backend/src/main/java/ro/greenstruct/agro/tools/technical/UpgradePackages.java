package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * Applies catalog items to a configuration. An added item with replacesCategories removes the components of
 * those categories (drip replaces the offered sprinkler, pipes and installation); an item with mirrorsCategory
 * swaps each component of that category for a new one of the same size (new tractors instead of second-hand
 * ones); replace swaps one named component explicitly.
 */
public final class UpgradePackages {

    private UpgradePackages() {
    }

    public static List<InvestmentComponent> apply(ToolContext context, Configuration base, List<String> add,
                                                  Map<String, String> replace) {
        BigDecimal tractors = base.metrics().getOrDefault("tractor_count", BigDecimal.ONE);
        List<InvestmentComponent> components = new ArrayList<>(base.components());

        replace.forEach((componentId, catalogId) -> {
            boolean removed = components.removeIf(c -> c.componentId().equals(componentId));
            if (!removed) {
                throw new IllegalArgumentException("Component " + componentId + " does not exist in " + base.configId());
            }
            JsonNode item = CatalogItems.item(context, catalogId);
            // a complete system (the 100 kWp PV at 72,000 EUR) also replaces the rest of the offered system:
            // swapping only the panels line would keep the 300 kWp inverters, structure and works
            item.path("replacesCategories").forEach(category ->
                    components.removeIf(c -> category.asText().equals(c.category())));
            components.add(CatalogItems.toComponent(item, tractors));
        });
        for (String catalogId : add) {
            if (components.stream().anyMatch(c -> catalogId.equals(c.catalogId()))) {
                continue;
            }
            JsonNode item = CatalogItems.item(context, catalogId);
            if (item.has("mirrorsCategory")) {
                boolean anyUsed = components.stream().anyMatch(c -> c.category().equals(item.path("mirrorsCategory")
                        .asText()) && EquipmentAge.isUsed(c));
                if (!anyUsed) {
                    throw new IllegalArgumentException(item.path("nameRo").asText() + " only replaces second-hand machinery");
                }
                components.replaceAll(c -> c.category().equals(item.path("mirrorsCategory").asText())
                        && EquipmentAge.isUsed(c)
                        ? CatalogItems.newEquivalent(item, c, context.today().getYear()) : c);
                continue;
            }
            item.path("replacesCategories").forEach(category ->
                    components.removeIf(c -> category.asText().equals(c.category())));
            components.add(CatalogItems.toComponent(item, tractors));
        }
        for (String catalogId : add) {
            requireCompanions(CatalogItems.item(context, catalogId), components);
        }
        return components;
    }

    /** An item may need a component of one of the categories in requiresCategories (e.g. sensors need drip). */
    private static void requireCompanions(JsonNode item, List<InvestmentComponent> components) {
        JsonNode required = item.path("requiresCategories");
        if (!required.isArray() || required.isEmpty()) {
            return;
        }
        for (JsonNode category : required) {
            if (components.stream().anyMatch(c -> category.asText().equals(c.category()))) {
                return;
            }
        }
        throw new IllegalArgumentException(item.path("nameRo").asText() + " can only be installed together with: " + required);
    }

    /** The configuration chain ends at the configuration built from the offer (no base). */
    public static Configuration root(ToolContext context, Configuration configuration) {
        Configuration current = configuration;
        while (current.baseConfigId() != null) {
            current = context.workspace().configuration(current.baseConfigId());
        }
        return current;
    }

    /** "irg.drip.surface_veg" → "drip": the short name used in package ids and calc keys. */
    public static String shortName(String catalogId) {
        String[] parts = catalogId.split("\\.");
        return parts.length > 1 ? parts[1] : catalogId;
    }
}
