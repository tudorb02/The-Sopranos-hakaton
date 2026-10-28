package ro.greenstruct.agro.tools.funding;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.external.model.CompanyInfo;
import ro.greenstruct.agro.orchestration.AgentSlot;
import ro.greenstruct.agro.tools.Params;
import ro.greenstruct.agro.tools.Schemas;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolHandler;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.technical.EquipmentAge;
import ro.greenstruct.agro.tools.workspace.Configuration;

/**
 * Checks the farm against the EU programmes and guarantee schemes of the module, rule by rule from
 * config/funding-programs.json, and says honestly whether a session is open on the analysis date.
 */
@Component
public class CheckProgramEligibilityTool implements ToolHandler {

    @Override
    public String name() {
        return "check_program_eligibility";
    }

    @Override
    public String description() {
        return "Checks each EU programme or guarantee scheme (default: the module's list) against the farm: legal "
                + "form, manager age, years since installation, standard output, required components. Returns "
                + "ELIGIBLE / NOT_ELIGIBLE with reasons and whether a session is open.";
    }

    @Override
    public JsonNode inputSchema() {
        return Schemas.parse("""
                {"type": "object", "additionalProperties": false, "properties": {
                  "programs": {"type": "array", "items": {"type": "string"}},
                  "configId": {"type": "string", "pattern": "^cfg_[a-z0-9_]{2,40}$",
                    "description": "Configuration to check component rules and scoring against."}}}
                """);
    }

    @Override
    public AgentSlot agent() {
        return AgentSlot.FUNDING_OPTIMIZER;
    }

    @Override
    public ToolOutput execute(JsonNode input, ToolContext context) {
        List<String> codes = Params.textList(input, "programs");
        if (codes.isEmpty()) {
            codes = context.module().fundingPrograms();
        }
        Configuration cfg = input.has("configId")
                ? context.workspace().configuration(input.path("configId").asText()) : null;

        ObjectNode result = context.newResult();
        ArrayNode programs = result.putArray("programs");
        for (String code : codes) {
            JsonNode program = FinancingConfig.program(context, code)
                    .orElseThrow(() -> new IllegalArgumentException("Programul " + code + " nu e în config"));
            ObjectNode check = evaluate(context, program, cfg);
            context.workspace().putProgramCheck(code, check);
            programs.add(check);
        }
        return context.ok(result, "Am verificat " + codes.size() + " programe de finanțare");
    }

    private ObjectNode evaluate(ToolContext context, JsonNode program, Configuration cfg) {
        String code = program.path("programCode").asText();
        JsonNode rules = program.path("eligibility");
        CompanyInfo company = context.farm().company();
        List<String> reasons = new ArrayList<>();
        List<String> conditions = new ArrayList<>();

        if (rules.has("legalForms") && !contains(rules.path("legalForms"), company.legalForm())) {
            reasons.add("Forma juridică " + company.legalForm() + " nu e eligibilă");
        }
        if (company.manager() == null) {
            // Companies looked up live at ANAF: the manager's data is at ONRC, which has no public API.
            if (rules.has("maxManagerAge") || rules.has("maxYearsSinceInstallation")) {
                conditions.add("Vârsta administratorului și data instalării trebuie confirmate din extrasul ONRC");
            }
        } else if (rules.has("maxManagerAge") && company.manager().age() > rules.path("maxManagerAge").asInt()) {
            reasons.add("Administratorul are " + company.manager().age() + " de ani (maximum "
                    + rules.path("maxManagerAge").asInt() + ")");
        }
        if (rules.has("maxYearsSinceInstallation") && company.manager() != null
                && company.manager().installedAt() != null) {
            int years = Period.between(company.manager().installedAt(), context.today()).getYears();
            if (years >= rules.path("maxYearsSinceInstallation").asInt()) {
                reasons.add("Instalat de " + years + " ani (maximum " + rules.path("maxYearsSinceInstallation").asInt() + ")");
            }
        }
        BigDecimal so = context.farm().farm().standardOutputEur();
        if (rules.has("minStandardOutputEur") && so.compareTo(rules.path("minStandardOutputEur").decimalValue()) < 0) {
            reasons.add("Dimensiunea economică (SO) e sub minimul programului");
        }
        if (rules.has("maxStandardOutputEur") && so.compareTo(rules.path("maxStandardOutputEur").decimalValue()) > 0) {
            reasons.add("Dimensiunea economică (SO) depășește maximul programului");
        }
        if (rules.has("caenAnyOf") && !contains(rules.path("caenAnyOf"), company.caen())) {
            reasons.add("Codul CAEN " + company.caen() + " nu e acoperit de program");
        }
        if (rules.has("requiresComponentAnyOf") && cfg != null && cfg.components().stream()
                .noneMatch(c -> contains(rules.path("requiresComponentAnyOf"), c.category()))) {
            reasons.add("Configurația nu conține componentele finanțate de program");
        }
        if (rules.path("requiresGreenConfig").asBoolean(false) && cfg != null && !cfg.passesThreshold()) {
            reasons.add("Configurația nu trece pragul verde");
        }
        if (rules.path("newEquipmentOnly").asBoolean(false)) {
            if (cfg == null) {
                conditions.add("Programul finanțează doar utilaje noi");
            } else {
                List<String> used = cfg.components().stream().filter(EquipmentAge::isUsed)
                        .map(c -> c.nameRo()).toList();
                if (!used.isEmpty()) {
                    reasons.add("Programul finanțează doar utilaje noi; second-hand: " + String.join(", ", used));
                }
            }
        }
        if (rules.path("requiresWaterMeter").asBoolean(false) && (cfg == null || cfg.components().stream()
                .noneMatch(c -> "WATER_METER".equals(c.category())))) {
            conditions.add("Contor de apă inclus în investiție");
        }

        ObjectNode check = context.newResult();
        check.put("programCode", code);
        check.put("type", program.path("type").asText());
        check.put("result", reasons.isEmpty() ? "ELIGIBLE" : "NOT_ELIGIBLE");
        check.put("session", sessionStatus(program.path("session"), context.today()));
        check.set("reasonsRo", context.mapper().valueToTree(reasons));
        check.set("conditionsRo", context.mapper().valueToTree(conditions));
        check.put("sourceRo", program.path("sourceRo").asText());

        if (reasons.isEmpty() && "GRANT".equals(program.path("type").asText()) && program.has("capEur")) {
            BigDecimal intensity = intensity(context, program.path("intensity"),
                    company.manager() == null ? null : company.manager().age());
            String key = code.toLowerCase();
            context.calc(key + ".intensity", "Intensitatea grantului " + code, intensity, Unit.PCT)
                    .source(program.path("sourceRo").asText()).add();
            context.calc(key + ".cap", "Plafonul grantului " + code, program.path("capEur").decimalValue(), Unit.EUR)
                    .source(program.path("sourceRo").asText()).add();
            check.put("intensityPct", intensity);
            check.put("capEur", program.path("capEur").decimalValue());
            check.put("monthsUntilPaid", program.path("monthsUntilPaid").asInt(12));
            precisionPoints(context, program, cfg).ifPresent(points -> {
                context.calc(key + ".precision_points", "Puncte pentru agricultură de precizie", points, Unit.POINTS)
                        .add();
                check.put("precisionBonus", points.signum() > 0);
            });
        }
        return check;
    }

    private static String sessionStatus(JsonNode session, LocalDate today) {
        String status = session.path("status").asText("UNKNOWN");
        if (!"OPEN".equals(status)) {
            return status;
        }
        if (session.has("opens") && today.isBefore(LocalDate.parse(session.path("opens").asText()))) {
            return "NOT_OPEN";
        }
        if (session.has("closes") && today.isAfter(LocalDate.parse(session.path("closes").asText()))) {
            return "CLOSED";
        }
        return "OPEN";
    }

    /** The highest intensity whose conditions the manager meets (age, agricultural competences). */
    /** age is null until ONRC confirms it; tiers that need a young manager are then left out (conservative). */
    private static BigDecimal intensity(ToolContext context, JsonNode tiers, Integer age) {
        boolean competences = context.questionnaire().path("manager_competences").asBoolean(false);
        BigDecimal best = BigDecimal.ZERO;
        for (JsonNode tier : tiers) {
            boolean ageOk = !tier.has("maxManagerAge") || age != null && age <= tier.path("maxManagerAge").asInt();
            boolean skillsOk = !tier.path("requiresCompetences").asBoolean(false) || competences;
            if (ageOk && skillsOk) {
                best = best.max(tier.path("intensityPct").decimalValue());
            }
        }
        return best;
    }

    private static Optional<BigDecimal> precisionPoints(ToolContext context, JsonNode program, Configuration cfg) {
        JsonNode scoring = program.path("scoring");
        if (cfg == null || !scoring.has("precisionMinSharePct")) {
            return Optional.empty();
        }
        boolean qualifies = cfg.metricOrZero("precision_share_pct")
                .compareTo(scoring.path("precisionMinSharePct").decimalValue()) >= 0;
        return Optional.of(qualifies ? scoring.path("precisionPoints").decimalValue() : BigDecimal.ZERO);
    }

    private static boolean contains(JsonNode array, String value) {
        for (JsonNode item : array) {
            if (item.asText().equals(value)) {
                return true;
            }
        }
        return false;
    }
}
