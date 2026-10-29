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
            case "NATURA_2000_PARCELS" -> parcels(check, facts.path("natura2000Parcels"), "Natura 2000 areas",
                    "Environmental approval for the parcels in Natura 2000 areas");
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
                            "The conversion plan has not been uploaded; it is required before drawdown.");
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
                    "The engine of the offered tractor does not meet Stage V: " + facts.path("emissionStages"));
        }
        if (facts.path("tractorsWithoutStage").size() > 0) {
            return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("OFFER"),
                    "The offer does not state the tractor's emission stage; the Stage V technical data sheet is required before drawdown.");
        }
        return new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo());
    }

    /** A key the rules cannot check from the facts: a condition before drawdown, not a pass. */
    private static Outcome conditional(ModuleDefinition.DnshCheck check, String evidence) {
        return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of(evidence),
                check.checkRo() + " To be confirmed before drawdown.");
    }

    private static Outcome nitrate(ModuleDefinition.DnshCheck check, JsonNode facts) {
        JsonNode parcels = facts.path("nitrateVulnerableParcels");
        if (!parcels.isEmpty() && facts.path("fertilisationPlan").asBoolean(false)) {
            return new Outcome(DnshStatus.PASS, List.of("OFFER"), parcels.size()
                    + " parcels are in nitrate vulnerable zones; the farmer declares a fertilisation plan.");
        }
        return parcels(check, parcels, "nitrate vulnerable zones",
                "Fertilisation plan for the parcels in nitrate vulnerable zones");
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
                        "We do not know how the manure is used; evidence is required before drawdown.");
    }

    private static Outcome permit(ModuleDefinition.DnshCheck check, JsonNode facts) {
        if (!facts.path("permitPresent").asBoolean(false)) {
            return new Outcome(DnshStatus.MISSING_DATA, List.of("ENVIRONMENTAL_PERMIT"),
                    "The environmental permit is missing; it is required before drawdown.");
        }
        if (!facts.path("permitValid").asBoolean(true)) {
            return new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("ENVIRONMENTAL_PERMIT"),
                    "The environmental permit has expired; renewal is required before drawdown.");
        }
        boolean covered = facts.path("digestateCoverInConfig").asBoolean(false)
                || facts.path("manureStorage").asText("").startsWith("ACOPERIT");
        return covered
                ? new Outcome(DnshStatus.PASS, List.of("ENVIRONMENTAL_PERMIT"), check.checkRo())
                : new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("ENVIRONMENTAL_PERMIT"),
                        "The permit exists, but the digestate is stored uncovered; covering the tank is required before drawdown.");
    }

    private static Outcome refrigerant(ModuleDefinition.DnshCheck check, JsonNode facts) {
        if (facts.path("refrigerantLowGwp").asBoolean(false)) {
            return new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo());
        }
        return facts.has("refrigerantGwp")
                ? new Outcome(DnshStatus.FAIL, List.of("OFFER"), "The refrigerant exceeds the maximum GWP ("
                        + facts.path("maxRefrigerantGwp").asText("?") + ").")
                : new Outcome(DnshStatus.MISSING_DATA, List.of("OFFER"),
                        "The offer does not state the refrigerant; the technical data sheet is required before drawdown.");
    }

    private static Outcome equipmentFate(ModuleDefinition.DnshCheck check, String fate) {
        return switch (fate) {
            case "CASARE", "VANZARE", "NU_E_CAZUL", "RECICLARE" -> new Outcome(DnshStatus.PASS,
                    List.of("CURRENT_EQUIPMENT"), check.checkRo());
            case "NECUNOSCUT" -> new Outcome(DnshStatus.MISSING_DATA, List.of("CURRENT_EQUIPMENT"),
                    "We do not know what happens to the old equipment; evidence is required before drawdown.");
            default -> new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("CURRENT_EQUIPMENT"),
                    "The old equipment stays on the farm as a backup; evidence of its use is required before drawdown.");
        };
    }

    private static Outcome parcels(ModuleDefinition.DnshCheck check, JsonNode parcels, String what, String condition) {
        return parcels.isEmpty()
                ? new Outcome(DnshStatus.PASS, List.of("OFFER"), check.checkRo())
                : new Outcome(DnshStatus.PASS_WITH_CONDITIONS, List.of("OFFER"),
                        parcels.size() + " parcels are in " + what + ". " + condition + ".");
    }
}
