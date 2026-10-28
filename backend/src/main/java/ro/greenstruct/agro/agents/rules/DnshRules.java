package ro.greenstruct.agro.agents.rules;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.greentier.DnshStatus;
import ro.greenstruct.agro.modules.ModuleDefinition;

/**
 * DNSH statuses from the facts of check_dnsh_inputs, by the evidence key of each check in the module config. Missing
 * information never rejects a loan: it becomes PASS_WITH_CONDITIONS or MISSING_DATA, i.e. a condition before drawdown
 * (README §5.3). A key the rules do not know yet is a condition too, not a pass. PARCEL_RISK passes: the facts carry
 * only the drought risk, which for irrigation is the reason for the investment, and there are no flood or hail
 * facts yet.
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
            case "NITRATE_PARCELS" -> nitrate(check, facts);
            case "DIGESTATE_USE" -> digestate(check, facts);
            case "ENVIRONMENTAL_PERMIT" -> permit(check, facts);
            case "REFRIGERANT_GWP" -> refrigerant(check, facts);
            case "WATER_USE" -> facts.path("mountingEligible").asBoolean(true)
                    ? new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo())
                    : conditional(check, "OFFER");
            case "NITROGEN_AVOIDED" -> facts.path("conversionPlanPresent").asBoolean()
                    ? new Outcome(DnshStatus.PASS, List.of("BUSINESS_PLAN"), check.checkRo())
                    : new Outcome(DnshStatus.MISSING_DATA, List.of("BUSINESS_PLAN"),
                            "Planul de conversie nu e încărcat; se cere înainte de tragere.");
            case "EMISSION_STAGE" -> emissionStage(check, facts);
            case "PUMPING_ENERGY", "PARCEL_RISK", "TILLAGE" -> new Outcome(DnshStatus.PASS,
                    List.of("OFFER"), check.checkRo());
            default -> conditional(check, "OFFER");
        };
    }

    /** Machinery: a tractor with a known engine stage below Stage V fails; an unknown stage is a condition. */
    private static Outcome emissionStage(ModuleDefinition.DnshCheck check, JsonNode facts) {
        if (facts.has("stageV") && !facts.path("stageV").asBoolean()) {
            return new Outcome(DnshStatus.FAIL, List.of("OFFER"),
                    "Motorul tractorului ofertat nu respectă norma Stage V: " + facts.path("emissionStages"));
        }
        if (facts.path("tractorsWithoutStage").size() > 0) {
            return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("OFFER"),
                    "Oferta nu indică norma de emisii a tractorului; fișa tehnică Stage V se cere înainte de tragere.");
        }
        return new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo());
    }

    /** A key the rules cannot check from the facts: a condition before drawdown, not a pass. */
    private static Outcome conditional(ModuleDefinition.DnshCheck check, String evidence) {
        return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of(evidence),
                check.checkRo() + " De confirmat înainte de tragere.");
    }

    private static Outcome nitrate(ModuleDefinition.DnshCheck check, JsonNode facts) {
        JsonNode parcels = facts.path("nitrateVulnerableParcels");
        if (!parcels.isEmpty() && facts.path("fertilisationPlan").asBoolean(false)) {
            return new Outcome(DnshStatus.PASS, List.of("OFFER"), parcels.size()
                    + " parcele sunt în zone vulnerabile la nitrați; fermierul declară un plan de fertilizare.");
        }
        return parcels(check, parcels, "zone vulnerabile la nitrați",
                "Plan de fertilizare pentru parcelele din zone vulnerabile la nitrați");
    }

    private static Outcome digestate(ModuleDefinition.DnshCheck check, JsonNode facts) {
        boolean valorised = facts.path("manureValorised").asBoolean(false);
        String use = facts.path("digestateUse").asText("NECUNOSCUT");
        if (valorised && !"NECUNOSCUT".equals(use)) {
            return new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo());
        }
        return valorised
                ? conditional(check, "OFFER")
                : new Outcome(DnshStatus.MISSING_DATA, List.of("OFFER"),
                        "Nu știm cum se valorifică gunoiul de grajd; dovada se cere înainte de tragere.");
    }

    private static Outcome permit(ModuleDefinition.DnshCheck check, JsonNode facts) {
        if (!facts.path("permitPresent").asBoolean(false)) {
            return new Outcome(DnshStatus.MISSING_DATA, List.of("ENVIRONMENTAL_PERMIT"),
                    "Autorizația de mediu lipsește; se cere înainte de tragere.");
        }
        if (!facts.path("permitValid").asBoolean(true)) {
            return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("ENVIRONMENTAL_PERMIT"),
                    "Autorizația de mediu a expirat; reînnoirea se cere înainte de tragere.");
        }
        boolean covered = facts.path("digestateCoverInConfig").asBoolean(false)
                || facts.path("manureStorage").asText("").startsWith("ACOPERIT");
        return covered
                ? new Outcome(DnshStatus.PASS, List.of("ENVIRONMENTAL_PERMIT"), check.checkRo())
                : new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("ENVIRONMENTAL_PERMIT"),
                        "Autorizația există, dar digestatul se stochează descoperit; acoperirea bazinului se cere înainte de tragere.");
    }

    private static Outcome refrigerant(ModuleDefinition.DnshCheck check, JsonNode facts) {
        if (facts.path("refrigerantLowGwp").asBoolean(false)) {
            return new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo());
        }
        return facts.has("refrigerantGwp")
                ? new Outcome(DnshStatus.FAIL, List.of("OFFER"), "Agentul frigorific depășește GWP-ul maxim ("
                        + facts.path("maxRefrigerantGwp").asText("?") + ").")
                : new Outcome(DnshStatus.MISSING_DATA, List.of("OFFER"),
                        "Oferta nu precizează agentul frigorific; fișa tehnică se cere înainte de tragere.");
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
