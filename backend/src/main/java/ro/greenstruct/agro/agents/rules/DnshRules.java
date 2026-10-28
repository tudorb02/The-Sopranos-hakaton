package ro.greenstruct.agro.agents.rules;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.modules.ModuleDefinition;

/**
 * DNSH statuses from the facts of check_dnsh_inputs, by the evidence key of each check in the module config. Missing
 * information never rejects a loan: it becomes PASS_WITH_CONDITIONS or MISSING_DATA, i.e. a condition before drawdown
 * (README §5.3). A key the rules do not know yet is a condition too, not a pass.
 */
final class DnshRules {

    private DnshRules() {
    }

    record Outcome(DnshStatus status, List<String> evidence, String noteRo) {
    }

    static Outcome evaluate(ModuleDefinition.DnshCheck check, JsonNode facts) {
        return switch (check.evidence()) {
            case "OLD_EQUIPMENT_FATE" -> equipmentFate(check, facts.path("oldEquipmentFate").asText("NECUNOSCUT"));
            case "NATURA_2000_PARCELS" -> parcels(check, facts.path("natura2000Parcels"), "arii Natura 2000",
                    "Aviz de mediu pentru parcelele din arii Natura 2000");
            case "NITRATE_PARCELS" -> parcels(check, facts.path("nitrateVulnerableParcels"), "zone vulnerabile la nitrați",
                    "Plan de fertilizare pentru parcelele din zone vulnerabile la nitrați");
            case "PUMPING_ENERGY", "PARCEL_RISK", "TILLAGE", "EMISSION_STAGE" -> new Outcome(DnshStatus.PASS,
                    List.of("OFFER"), check.checkRo());
            default -> new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("OFFER"),
                    check.checkRo() + " De confirmat înainte de tragere.");
        };
    }

    private static Outcome equipmentFate(ModuleDefinition.DnshCheck check, String fate) {
        return switch (fate) {
            case "CASARE", "VANZARE", "NU_E_CAZUL", "RECICLARE" -> new Outcome(DnshStatus.PASS,
                    List.of("CURRENT_EQUIPMENT"), check.checkRo());
            case "NECUNOSCUT" -> new Outcome(DnshStatus.MISSING_DATA, List.of("CURRENT_EQUIPMENT"),
                    "Nu știm ce se întâmplă cu echipamentul vechi; dovada se cere înainte de tragere.");
            default -> new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("CURRENT_EQUIPMENT"),
                    "Echipamentul vechi rămâne în fermă ca rezervă; dovada folosirii se cere înainte de tragere.");
        };
    }

    private static Outcome parcels(ModuleDefinition.DnshCheck check, JsonNode parcels, String what, String condition) {
        return parcels.isEmpty()
                ? new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo())
                : new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("OFFER"),
                        parcels.size() + " parcele sunt în " + what + ". " + condition + ".");
    }
}
