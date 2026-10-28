package ro.greenstruct.agro.tools.technical;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import ro.greenstruct.agro.engine.livestock.EnergyUse;
import ro.greenstruct.agro.engine.livestock.LivestockCalculator;
import ro.greenstruct.agro.engine.livestock.MethaneComparison;
import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.RuleValues;
import ro.greenstruct.agro.tools.ToolContext;
import ro.greenstruct.agro.tools.ToolOutput;
import ro.greenstruct.agro.tools.Unit;
import ro.greenstruct.agro.tools.workspace.Configuration;
import ro.greenstruct.agro.tools.workspace.DocumentFacts;
import ro.greenstruct.agro.tools.workspace.InvestmentComponent;

import static ro.greenstruct.agro.engine.Decimals.MC;

/**
 * Livestock and biogas: methane reduction on manure management, with the manure valorised as energy or
 * fertiliser (README §6, category 4). Species and heads come from the ANSVSA register (FarmInfo.livestock), the
 * storage system from the questionnaire, the emission factors and prices from config.
 */
@Component
public class LivestockModule implements ModuleCalculator {

    private static final DateTimeFormatter RO_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    @Override
    public String id() {
        return "livestock";
    }

    @Override
    public ToolOutput baseline(JsonNode input, ToolContext context) {
        String storage = context.questionnaire().path("manure_storage").asText("");
        if (storage.isBlank()) {
            throw new IllegalArgumentException("Lipsește răspunsul „manure_storage” (cum stocați gunoiul de grajd azi)");
        }
        JsonNode register = context.farm().farm().livestock();
        if (register == null || !register.isArray() || register.isEmpty()) {
            throw new IllegalArgumentException("Registrul ANSVSA nu arată animale la această fermă");
        }
        BigDecimal heads = BigDecimal.ZERO;
        BigDecimal methane = BigDecimal.ZERO;
        BigDecimal energyNorm = BigDecimal.ZERO;
        BigDecimal nitrogenNorm = BigDecimal.ZERO;
        List<String> species = new ArrayList<>();
        for (JsonNode entry : register) {
            String kind = entry.path("species").asText();
            BigDecimal count = entry.path("heads").decimalValue();
            heads = heads.add(count);
            methane = methane.add(LivestockCalculator.methaneKg(count, perHead(context, "ch4KgPerHeadYear", kind, storage)));
            energyNorm = energyNorm.add(LivestockCalculator.energyKwh(count, perHead(context, "biogasKwhPerHead", kind, null)));
            nitrogenNorm = nitrogenNorm.add(LivestockCalculator.nitrogenKg(count,
                    perHead(context, "nitrogenKgPerHeadYear", kind, null)));
            species.add(kind);
        }
        BigDecimal gwp = RuleValues.factor(context, "methaneGwp");
        BigDecimal co2e = LivestockCalculator.co2eTonnes(methane, gwp);
        Optional<BigDecimal> invoiced = context.workspace().documentOfType("ENERGY_INVOICES")
                .flatMap(doc -> doc.number("ENERGY_KWH"));

        Calc headsCalc = context.calc("baseline.heads", "Animale în fermă (registrul ANSVSA)", heads, Unit.COUNT)
                .source("ANSVSA").add();
        Calc methaneCalc = context.calc("baseline.methane", "Metan din gunoiul de grajd azi", methane,
                Unit.KG_CH4_PER_YEAR).formula("capete × factor CH₄ (specie, sistem de stocare)")
                .source(context.paramSource("ch4KgPerHeadYear")).dependsOn(headsCalc).add();
        context.calc("baseline.co2", "Emisii de gunoi de grajd azi", co2e, Unit.T_CO2_PER_YEAR)
                .formula("kg CH₄ × GWP / 1000").dependsOn(methaneCalc).add();
        if (invoiced.isPresent()) {
            context.calc("baseline.farm_energy", "Energia electrică consumată la fermă", invoiced.get(),
                    Unit.KWH_PER_YEAR).formula("din facturile de energie pe 12 luni").add();
        }

        Map<String, BigDecimal> baseline = new HashMap<>();
        baseline.put("heads", heads);
        baseline.put("ch4_kg", methane);
        baseline.put("co2e_t", co2e);
        baseline.put("farm_energy_kwh", invoiced.orElse(BigDecimal.ZERO));
        baseline.put("energy_norm_kwh", energyNorm);
        baseline.put("nitrogen_norm_kg", nitrogenNorm);
        context.workspace().putBaseline(baseline);

        ObjectNode result = context.newResult();
        result.put("dataSource", invoiced.isPresent() ? "MIXED" : "NORMS");
        result.put("manureStorage", storage);
        result.set("species", context.mapper().valueToTree(species));
        List<String> warnings = new ArrayList<>();
        if (!context.questionnaire().path("livestock_confirmed").asBoolean(false)) {
            warnings.add("Numărul de animale din registrul ANSVSA nu a fost confirmat de fermier");
        }
        if (invoiced.isEmpty()) {
            warnings.add("Fără facturi de energie: toată energia produsă se consideră vândută în rețea");
        }
        if (!warnings.isEmpty()) {
            result.set("warnings", context.mapper().valueToTree(warnings));
        }
        return context.ok(result, "Situația actuală: " + methaneCalc.display() + " din " + heads.toPlainString()
                + " de animale");
    }

    @Override
    public Map<String, BigDecimal> metrics(ToolContext context, List<InvestmentComponent> components) {
        Map<String, BigDecimal> baseline = context.workspace().baseline();
        BigDecimal reductionPct = LivestockCalculator.systemReductionPct(components.stream()
                .map(c -> c.attribute("methaneReductionPct")).filter(v -> v != null).toList());
        MethaneComparison methane = LivestockCalculator.methane(baseline.get("ch4_kg"), reductionPct);

        boolean digester = components.stream().anyMatch(c -> "DIGESTER".equals(c.category()));
        BigDecimal offered = components.stream().map(c -> c.attribute("energyKwh")).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Biogas becomes electricity only with a cogeneration unit: its data sheet gives the energy, else the norm.
        boolean cogeneration = components.stream().anyMatch(c -> "COGENERATION".equals(c.category()));
        BigDecimal produced = offered.signum() > 0 ? offered : cogeneration ? baseline.get("energy_norm_kwh")
                : BigDecimal.ZERO;
        // a gastight digestate cover with gas recovery feeds the residual biogas to the same cogeneration unit
        BigDecimal upliftPct = components.stream().map(c -> c.attribute("energyUpliftPct")).filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal energy = produced.multiply(BigDecimal.ONE.add(upliftPct.divide(BigDecimal.valueOf(100), MC), MC), MC);
        EnergyUse use = LivestockCalculator.energyUse(energy, baseline.get("farm_energy_kwh"));

        String digestateUse = context.questionnaire().path("digestate_use").asText("");
        boolean fertiliser = listParam(context, "fertiliserDigestateUses").contains(digestateUse);
        boolean valorising = listParam(context, "valorisingDigestateUses").contains(digestateUse);
        BigDecimal nitrogen = digester && fertiliser ? baseline.get("nitrogen_norm_kg") : BigDecimal.ZERO;

        Map<String, BigDecimal> m = new HashMap<>();
        m.put("indicator_pct", methane.reductionPct());
        m.put("ch4_new_kg", methane.newKg());
        m.put("ch4_saved_kg", methane.savedKg());
        m.put("co2_avoided_t", LivestockCalculator.co2eTonnes(methane.savedKg(), RuleValues.factor(context, "methaneGwp")));
        m.put("energy_kwh", use.producedKwh());
        m.put("energy_own_kwh", use.ownKwh());
        m.put("energy_sold_kwh", use.soldKwh());
        m.put("nitrogen_kg", nitrogen);
        m.put("manure_valorised", LivestockCalculator.isValorised(energy, valorising) ? BigDecimal.ONE : BigDecimal.ZERO);
        m.put("savings_energy_eur", LivestockCalculator.energyValueEur(use,
                RuleValues.price(context, "electricityEurPerKwh"), context.param("electricitySellEurPerKwh")));
        m.put("savings_fertiliser_eur", LivestockCalculator.fertiliserValueEur(nitrogen, context.param("nitrogenEurPerKg")));
        return m;
    }

    /** The green threshold also needs the manure to be valorised (README §6, category 4, C). */
    @Override
    public boolean sizingOk(ToolContext context, Map<String, BigDecimal> metrics) {
        return metrics.getOrDefault("manure_valorised", BigDecimal.ONE).signum() > 0;
    }

    @Override
    public List<Calc> emit(ToolContext context, Configuration cfg) {
        String p = cfg.configId() + ".";
        List<Calc> calcs = new ArrayList<>();
        calcs.add(context.calc(p + "methane_reduction_pct", "Reducerea emisiilor de metan", cfg.metric("indicator_pct"),
                Unit.PCT).formula("1 − CH₄ nou / CH₄ azi").add());
        calcs.add(context.calc(p + "methane_new", "Metan după investiție", cfg.metric("ch4_new_kg"),
                Unit.KG_CH4_PER_YEAR).formula("CH₄ azi × (1 − reducerea sistemului)").add());
        calcs.add(context.calc(p + "methane_saved", "Metan evitat pe an", cfg.metric("ch4_saved_kg"),
                Unit.KG_CH4_PER_YEAR).add());
        if (cfg.metricOrZero("energy_kwh").signum() > 0) {
            calcs.add(context.calc(p + "energy_produced", "Energie electrică produsă din biogaz",
                    cfg.metric("energy_kwh"), Unit.KWH_PER_YEAR).formula("din fișa ofertei, altfel capete × kWh pe cap")
                    .add());
            calcs.add(context.calc(p + "energy_own", "Energie folosită la fermă", cfg.metric("energy_own_kwh"),
                    Unit.KWH_PER_YEAR).formula("min(energie produsă, consumul fermei)").add());
            calcs.add(context.calc(p + "energy_sold", "Energie vândută în rețea", cfg.metric("energy_sold_kwh"),
                    Unit.KWH_PER_YEAR).formula("energie produsă − energie folosită la fermă").add());
        }
        if (cfg.metricOrZero("nitrogen_kg").signum() > 0) {
            calcs.add(context.calc(p + "nitrogen_digestate", "Azot din digestat care înlocuiește îngrășământul mineral",
                    cfg.metric("nitrogen_kg"), Unit.KG_N_PER_YEAR).formula("capete × kg N pe cap").add());
        }
        calcs.add(context.calc(p + "savings_energy", "Valoarea energiei pe an", cfg.metric("savings_energy_eur"),
                Unit.EUR_PER_YEAR).formula("kWh la fermă × preț + kWh vânduți × preț de vânzare").add());
        calcs.add(context.calc(p + "savings_fertiliser", "Valoarea azotului din digestat pe an",
                cfg.metric("savings_fertiliser_eur"), Unit.EUR_PER_YEAR).formula("kg N × preț azot").add());
        return calcs;
    }

    @Override
    public Map<String, String> impactMetrics() {
        return Map.of("energy_produced", "RENEWABLE_KWH", "co2_avoided", "CO2_AVOIDED_T");
    }

    @Override
    public Map<String, String> baselineMetrics() {
        return Map.of("baseline.co2", "CO2_EMITTED_T");
    }

    @Override
    public Map<String, String> savingsMetrics() {
        return Map.of("savings_energy_eur", "energy_eur", "savings_fertiliser_eur", "fertiliser_eur");
    }

    @Override
    public void describeRules(ToolContext context) {
        var module = context.module();
        context.calc("rules.threshold.methane_reduction", "Pragul verde: reducerea emisiilor de metan",
                RuleValues.thresholdPct(context), Unit.PCT).source(module.threshold().sourceRo()).add();
        context.calc("rules.factor.gwp_methane", "GWP al metanului (100 de ani)", RuleValues.factor(context, "methaneGwp"),
                Unit.COUNT).source(RuleValues.factorSource(context, "methaneGwp")).add();
        String storage = context.questionnaire().path("manure_storage").asText("");
        JsonNode register = context.farm().farm().livestock();
        if (!storage.isBlank() && register != null && register.isArray() && !register.isEmpty()) {
            String species = register.get(0).path("species").asText();
            context.calc("rules.factor.ch4_per_head", "Factor de emisie CH₄ pe cap și an (" + species + ", " + storage + ")",
                    perHead(context, "ch4KgPerHeadYear", species, storage), Unit.KG_CH4_PER_YEAR)
                    .source(context.paramSource("ch4KgPerHeadYear")).add();
            context.calc("rules.energy.kwh_per_head", "Energie electrică din biogaz pe cap și an",
                    perHead(context, "biogasKwhPerHead", species, null), Unit.KWH_PER_YEAR)
                    .source(context.paramSource("biogasKwhPerHead")).add();
        }
        context.calc("rules.price.electricity", "Prețul energiei electrice", RuleValues.price(context, "electricityEurPerKwh"),
                Unit.EUR_PER_KWH).source(RuleValues.priceSource(context, "electricityEurPerKwh")).add();
        context.calc("rules.price.electricity_sell", "Prețul de vânzare a energiei în rețea",
                context.param("electricitySellEurPerKwh"), Unit.EUR_PER_KWH)
                .source(context.paramSource("electricitySellEurPerKwh")).add();
        context.calc("rules.price.nitrogen", "Prețul azotului mineral înlocuit", context.param("nitrogenEurPerKg"),
                Unit.EUR_PER_KG_N).source(context.paramSource("nitrogenEurPerKg")).add();
    }

    @Override
    public void dnshInputs(ToolContext context, Configuration cfg, ObjectNode result) {
        context.workspace().documentOfType("ENVIRONMENTAL_PERMIT").ifPresentOrElse(permit -> {
            String validUntil = permit.texts().get("PERMIT_VALID_UNTIL");
            result.put("permitPresent", true);
            // A permit without an end date (e.g. "subject to the annual visa") is treated as valid.
            result.put("permitValid", validUntil == null || validUntil.isBlank()
                    || !parseDate(validUntil).isBefore(context.today()));
            if (validUntil != null && !validUntil.isBlank()) {
                result.put("permitValidUntil", validUntil);
            }
        }, () -> result.put("permitPresent", false));
        result.put("manureStorage", context.questionnaire().path("manure_storage").asText("NECUNOSCUT"));
        result.put("digestateUse", context.questionnaire().path("digestate_use").asText("NECUNOSCUT"));
        result.put("fertilisationPlan", context.questionnaire().path("fertilisation_plan").asText("NECUNOSCUT"));
        result.put("digesterInConfig", cfg.components().stream().anyMatch(c -> "DIGESTER".equals(c.category())));
        result.put("digestateCoverInConfig", cfg.components().stream().anyMatch(c -> "DIGESTATE_COVER".equals(c.category())));
        result.put("manureValorised", cfg.metricOrZero("manure_valorised").signum() > 0);
        result.put("methaneReductionPct", cfg.metric("indicator_pct"));
    }

    @Override
    public void horizonImpact(ToolContext context, Configuration cfg, BigDecimal years) {
        context.calc("impact.energy_horizon", "Energie produsă din biogaz pe orizont",
                cfg.metric("energy_kwh").multiply(years, MC), Unit.KWH).add();
    }

    @Override
    public void offerAttributes(DocumentFacts.LineFacts line, DocumentFacts offer, Map<String, BigDecimal> attributes) {
        switch (line.category()) {
            case "DIGESTER" -> {
                BigDecimal reduction = line.numbers().getOrDefault("METHANE_REDUCTION_PCT",
                        offer.numbers().get("METHANE_REDUCTION_PCT"));
                if (reduction != null) {
                    attributes.put("methaneReductionPct", reduction);
                }
            }
            case "COGENERATION" -> {
                BigDecimal energy = line.numbers().getOrDefault("ENERGY_KWH", offer.numbers().get("ENERGY_KWH"));
                if (energy != null) {
                    attributes.put("energyKwh", energy);
                }
                BigDecimal power = line.numbers().getOrDefault("ENGINE_POWER_KW", offer.numbers().get("ENGINE_POWER_KW"));
                if (power != null) {
                    attributes.put("powerKw", power);
                }
            }
            default -> {
            }
        }
    }

    /** parameters.&lt;name&gt;.value.&lt;species&gt;[.&lt;storage&gt;] as a number; a species without a factor is an input error. */
    private static BigDecimal perHead(ToolContext context, String name, String species, String storage) {
        JsonNode node = context.module().parameters().path(name).path("value").path(species);
        if (storage != null) {
            node = node.path(storage);
        }
        if (!node.isNumber()) {
            throw new IllegalArgumentException("Config-ul „" + name + "” nu are valoare pentru specia " + species
                    + (storage == null ? "" : " și stocarea " + storage));
        }
        return node.decimalValue();
    }

    private static List<String> listParam(ToolContext context, String name) {
        List<String> values = new ArrayList<>();
        context.module().parameters().path(name).path("value").forEach(v -> values.add(v.asText()));
        return values;
    }

    private static LocalDate parseDate(String raw) {
        try {
            return LocalDate.parse(raw.trim(), RO_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Data „" + raw + "” din autorizație nu are formatul zz.ll.aaaa");
        }
    }
}
