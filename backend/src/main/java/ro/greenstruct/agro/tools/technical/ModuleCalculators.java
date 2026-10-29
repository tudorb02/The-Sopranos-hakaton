package ro.greenstruct.agro.tools.technical;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

/** All module calculators by id. */
@Component
public class ModuleCalculators {

    private final Map<String, ModuleCalculator> byId = new HashMap<>();

    public ModuleCalculators(List<ModuleCalculator> calculators) {
        for (ModuleCalculator calculator : calculators) {
            if (byId.putIfAbsent(calculator.id(), calculator) != null) {
                throw new IllegalStateException("Two calculators for " + calculator.id());
            }
        }
    }

    public ModuleCalculator require(String calculatorId) {
        ModuleCalculator calculator = calculatorId == null ? null : byId.get(calculatorId);
        if (calculator == null) {
            throw new IllegalArgumentException("The module has no calculator yet (" + calculatorId + ")");
        }
        return calculator;
    }
}
