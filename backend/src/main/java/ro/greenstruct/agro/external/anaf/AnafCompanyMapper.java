package ro.greenstruct.agro.external.anaf;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;

import ro.greenstruct.agro.engine.sme.SmeRule;
import ro.greenstruct.agro.external.model.CompanyInfo;

/**
 * ANAF answers → CompanyInfo (Company in contracts/openapi.yaml).
 * The manager's age and installation date live at ONRC, which has no public API: they stay null.
 * Total assets = fixed assets + current assets + prepaid expenses, the balance-sheet total the SME rule uses.
 */
final class AnafCompanyMapper {

    private static final Locale RO = Locale.forLanguageTag("ro");

    private AnafCompanyMapper() {
    }

    /** A company plus, when ANAF says it cannot borrow (inactive, deregistered), the reason in English. */
    record AnafCompany(CompanyInfo info, String blockedReasonRo) {
    }

    /** balanceSheet is null when no balance sheet was filed in the last two years. */
    static AnafCompany map(JsonNode vatRecord, JsonNode balanceSheet, BigDecimal ronPerEur, SmeRule smeRule) {
        JsonNode general = vatRecord.path("date_generale");
        JsonNode seat = vatRecord.path("adresa_sediu_social");
        String name = general.path("denumire").asText();
        String caen = caen(general, balanceSheet);

        BigDecimal turnoverEur = null;
        BigDecimal netProfitEur = null;
        BigDecimal totalAssetsEur = null;
        int employees = 0;
        int financialYear = 0;
        if (balanceSheet != null) {
            turnoverEur = indicator(balanceSheet, "CIFRA DE AFACERI NETA").map(ron -> toEur(ron, ronPerEur)).orElse(null);
            BigDecimal profit = indicator(balanceSheet, "PROFIT NET").orElse(BigDecimal.ZERO)
                    .subtract(indicator(balanceSheet, "PIERDERE NETA").orElse(BigDecimal.ZERO));
            netProfitEur = toEur(profit, ronPerEur);
            employees = indicator(balanceSheet, "NUMAR MEDIU DE SALARIATI").map(BigDecimal::intValue).orElse(0);
            totalAssetsEur = totalAssets(balanceSheet).map(ron -> toEur(ron, ronPerEur)).orElse(null);
            financialYear = balanceSheet.path("an").asInt();
        }

        CompanyInfo info = new CompanyInfo(
                general.path("cui").asText(),
                name,
                legalForm(general.path("forma_juridica").asText(), name),
                caen,
                caenLabel(caen, balanceSheet),
                properCase(withCommaBelow(seat.path("sdenumire_Judet").asText())),
                locality(seat.path("sdenumire_Localitate").asText()),
                date(general.path("data_inregistrare").asText()),
                employees,
                turnoverEur,
                netProfitEur,
                totalAssetsEur,
                financialYear,
                vatRecord.path("inregistrare_scop_Tva").path("scpTVA").asBoolean(),
                smeRule.classify(employees, turnoverEur, totalAssetsEur),
                null);
        return new AnafCompany(info, blockedReason(general, vatRecord.path("stare_inactiv")));
    }

    /** Inactive taxpayers and deregistered companies cannot be financed; ANAF publishes both. */
    private static String blockedReason(JsonNode general, JsonNode inactive) {
        String deregistered = inactive.path("dataRadiere").asText();
        if (!deregistered.isBlank() || plain(general.path("stare_inregistrare").asText()).startsWith("RADIERE")) {
            return "Company " + general.path("denumire").asText() + " is deregistered at ANAF"
                    + (deregistered.isBlank() ? "" : " since " + deregistered) + " and cannot receive financing.";
        }
        if (inactive.path("statusInactivi").asBoolean()) {
            String since = inactive.path("dataInactivare").asText();
            return "Company " + general.path("denumire").asText() + " is declared tax-inactive by ANAF"
                    + (since.isBlank() ? "" : " since " + since) + ". Financing is possible only after reactivation.";
        }
        return null;
    }

    static String legalForm(String formaJuridica, String name) {
        String form = plain(formaJuridica);
        if (form.contains("RASPUNDERE LIMITATA")) {
            return "SRL";
        }
        if (form.contains("PE ACTIUNI")) {
            return "SA";
        }
        if (form.contains("PERSOANA FIZICA AUTORIZATA")) {
            return "PFA";
        }
        if (form.contains("INTREPRINDERE INDIVIDUALA")) {
            return "II";
        }
        if (form.contains("INTREPRINDERE FAMILIALA")) {
            return "IF";
        }
        if (form.contains("COOPERATIV")) {
            return "COOPERATIVA";
        }
        // Small taxpayers often have no forma_juridica; the name suffix is reliable for them.
        String plainName = plain(name).replace(".", "").trim();
        for (String suffix : new String[]{"SRL", "SA", "PFA", "II", "IF"}) {
            if (plainName.endsWith(" " + suffix)) {
                return suffix;
            }
        }
        return null;
    }

    /** The VAT register's CAEN; the balance sheet's when the register leaves it empty (common for small firms). */
    private static String caen(JsonNode general, JsonNode balanceSheet) {
        String code = general.path("cod_CAEN").asText();
        if (!code.isBlank()) {
            return code;
        }
        int fromSheet = balanceSheet == null ? 0 : balanceSheet.path("caen").asInt();
        return fromSheet > 0 ? String.format("%04d", fromSheet) : null;
    }

    private static String caenLabel(String caen, JsonNode balanceSheet) {
        if (balanceSheet != null && caen != null && Integer.parseInt(caen) == balanceSheet.path("caen").asInt()) {
            return withCommaBelow(balanceSheet.path("den_caen").asText());
        }
        return caen == null ? "Unknown CAEN code" : "CAEN code " + caen;
    }

    /** Indicators are matched by their label: the I-numbers differ between company and bank balance sheets. */
    private static Optional<BigDecimal> indicator(JsonNode balanceSheet, String label) {
        for (JsonNode item : balanceSheet.path("i")) {
            if (plain(item.path("val_den_indicator").asText()).trim().equals(label)) {
                return Optional.of(item.path("val_indicator").decimalValue());
            }
        }
        return Optional.empty();
    }

    /** Empty when the balance sheet gives none of the three totals. */
    private static Optional<BigDecimal> totalAssets(JsonNode balanceSheet) {
        Optional<BigDecimal> fixed = indicatorStartingWith(balanceSheet, "ACTIVE IMOBILIZATE");
        Optional<BigDecimal> current = indicatorStartingWith(balanceSheet, "ACTIVE CIRCULANTE");
        Optional<BigDecimal> prepaid = indicatorStartingWith(balanceSheet, "CHELTUIELI IN AVANS");
        if (fixed.isEmpty() && current.isEmpty() && prepaid.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(fixed.orElse(BigDecimal.ZERO).add(current.orElse(BigDecimal.ZERO)).add(prepaid.orElse(BigDecimal.ZERO)));
    }

    /** For the totals ANAF labels with a suffix, e.g. "ACTIVE CIRCULANTE - TOTAL, din care". */
    private static Optional<BigDecimal> indicatorStartingWith(JsonNode balanceSheet, String prefix) {
        for (JsonNode item : balanceSheet.path("i")) {
            if (plain(item.path("val_den_indicator").asText()).trim().startsWith(prefix)) {
                return Optional.of(item.path("val_indicator").decimalValue());
            }
        }
        return Optional.empty();
    }

    private static BigDecimal toEur(BigDecimal ron, BigDecimal ronPerEur) {
        return ron.divide(ronPerEur, 0, RoundingMode.HALF_UP);
    }

    private static LocalDate date(String text) {
        return text.isBlank() ? null : LocalDate.parse(text);
    }

    /** ANAF writes "Sector 1 Mun. Bucureşti" but also all-caps names; only the latter are re-cased. */
    private static String locality(String text) {
        String fixed = withCommaBelow(text);
        return fixed.equals(fixed.toUpperCase(RO)) ? properCase(fixed) : fixed;
    }

    /** "BISTRIŢA-NĂSĂUD" → "Bistrița-Năsăud". */
    static String properCase(String text) {
        StringBuilder out = new StringBuilder(text.length());
        boolean startOfWord = true;
        for (char c : text.toLowerCase(RO).toCharArray()) {
            out.append(startOfWord ? Character.toUpperCase(c) : c);
            startOfWord = c == ' ' || c == '-';
        }
        return out.toString();
    }

    /** ANAF still uses the cedilla letters ş/ţ; Romanian text elsewhere in the app uses ș/ț. */
    static String withCommaBelow(String text) {
        return text.replace('ş', 'ș').replace('Ş', 'Ș').replace('ţ', 'ț').replace('Ţ', 'Ț');
    }

    /** Upper case without diacritics, for comparing ANAF labels whatever their spelling. */
    private static String plain(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toUpperCase(Locale.ROOT);
    }
}
