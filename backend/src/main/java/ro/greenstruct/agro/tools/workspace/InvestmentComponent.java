package ro.greenstruct.agro.tools.workspace;

import java.math.BigDecimal;
import java.util.Map;

/**
 * One line of an investment configuration: from the farmer's offer (source OFFER) or from the upgrade
 * catalog (source CATALOG). attributes hold the technical facts the calculators need (efficiencyPct, hp,
 * pvKwp, fuelSavingPct, ...), all already parsed into numbers.
 */
public record InvestmentComponent(
        String componentId,
        String category,
        String nameRo,
        String source,
        String catalogId,
        BigDecimal quantity,
        BigDecimal costEur,
        Map<String, BigDecimal> attributes) {

    public InvestmentComponent {
        attributes = Map.copyOf(attributes);
    }

    public BigDecimal attribute(String name) {
        return attributes.get(name);
    }
}
