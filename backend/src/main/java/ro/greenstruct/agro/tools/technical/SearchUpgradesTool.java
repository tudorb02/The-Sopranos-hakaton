package ro.greenstruct.agro.tools.technical;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

/**
 * Tries every combination of the catalog's indicator upgrades and alternatives (e.g. new tractors instead of
 * second-hand ones) on top of a configuration, plus compliance items it lacks (e.g. a water meter), and lists
 * them by cost, with PASS/FAIL against the threshold.
 */
@Component
public class SearchUpgradesTool implements ToolHandler {

    private static final int MAX_INDICATOR_ITEMS = 6;

    private record Candidate(String packageId, List<String> catalogIds, Configuration configuration) {
    }

    @Override
    public String name() {
        return "search_upgrades";
    }

    @Override
    public String description() {
        return "Lists upgrade packages from the module catalog for a configuration, cheapest first, each with its "
                + "indicator and PASS/FAIL. Use it when the offer fails the threshold or to find a greener option.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "required": ["baseConfigId"], "properties": {
                  "baseConfigId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$"}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.TECHNICAL_AUDITOR;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        Configuration base = context.workspace().configuration(Params.requiredText(input, "baseConfigId"));
        List<JsonNode> indicatorItems = new ArrayList<>(CatalogItems.withRole(context, "INDICATOR"));
        indicatorItems.addAll(CatalogItems.withRole(context, "ALTERNATIVE"));
        if (indicatorItems.size() > MAX_INDICATOR_ITEMS) {
            throw new IllegalStateException("Catalog too large for exhaustive search");
        }
        List<String> compliance = CatalogItems.withRole(context, "COMPLIANCE").stream()
                .filter(item -> base.components().stream()
                        .noneMatch(c -> c.category().equals(item.path("category").asText())))
                .map(item -> item.path("catalogId").asText())
                .toList();

        List<Candidate> candidates = new ArrayList<>();
        for (int mask = 1; mask < (1 << indicatorItems.size()); mask++) {
            List<String> ids = new ArrayList<>();
            Set<String> categories = new HashSet<>();
            boolean sameCategoryTwice = false;
            for (int i = 0; i < indicatorItems.size(); i++) {
                if ((mask & (1 << i)) != 0) {
                    ids.add(indicatorItems.get(i).path("catalogId").asText());
                    sameCategoryTwice |= !categories.add(indicatorItems.get(i).path("category").asText());
                }
            }
            if (sameCategoryTwice) {
                continue; // e.g. two sizes of the same installation: the second would only replace the first
            }
            String packageId = "pkg_" + String.join("_", ids.stream().map(UpgradePackages::shortName).toList());
            ids.addAll(compliance);
            List<InvestmentComponent> components;
            try {
                components = UpgradePackages.apply(context, base, ids, Map.of());
            } catch (IllegalArgumentException notCombinable) {
                continue;   // e.g. an item that needs another item the package does not contain
            }
            candidates.add(new Candidate(packageId, ids,
                    ConfigurationMetrics.build(context, "cfg_candidate", base.configId(), components)));
        }
        candidates.sort(Comparator.comparing(c -> c.configuration().totalCost()));

        ObjectNode result = context.newResult();
        ArrayNode list = result.putArray("candidates");
        for (Candidate candidate : candidates) {
            String key = "cand." + candidate.packageId().substring("pkg_".length());
            context.calc(key + ".pct", "Indicator cu pachetul " + candidate.packageId(),
                    candidate.configuration().metric("indicator_pct"), Unit.PCT).add();
            context.calc(key + ".cost", "Cost total cu pachetul " + candidate.packageId(),
                    candidate.configuration().totalCost(), Unit.EUR).add();
            ObjectNode node = list.addObject();
            node.put("packageId", candidate.packageId());
            node.set("catalogIds", context.mapper().valueToTree(candidate.catalogIds()));
            node.put("thresholdResult", candidate.configuration().passesThreshold() ? "PASS" : "FAIL");
            node.put("meetsSafetyMargin", ConfigurationMetrics.meetsSafetyMargin(context, candidate.configuration()));
        }
        long passing = candidates.stream().filter(c -> c.configuration().passesThreshold()).count();
        return context.ok(result, "Am găsit " + candidates.size() + " pachete de upgrade, " + passing + " trec pragul");
    }
}
