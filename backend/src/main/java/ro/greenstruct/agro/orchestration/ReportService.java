package ro.greenstruct.agro.orchestration;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import ro.greenstruct.agro.tools.Calc;
import ro.greenstruct.agro.tools.CalcStore;

/**
 * The green report as a PDF, generated when the officer approves (README §8): decision, green tier, criterion and
 * threshold, DNSH, fund and its requirements, bond category, rate by component, conditions, risks. Every figure is the
 * display of a calc; the text of the agents is printed as written.
 */
@Service
public class ReportService {

    private static final Color GREEN = new Color(0x1B, 0x6B, 0x3A);
    private static final Map<String, String> TIERS = Map.of("VERDE_PLUS", "Green Plus", "VERDE", "Green",
            "VERDE_CU_UPGRADE", "Green with upgrade", "CLASIC", "Classic");
    private static final Map<String, String> DECISIONS = Map.of("ELIGIBLE_GREEN", "Green eligible",
            "ELIGIBLE_WITH_CONDITIONS", "Green eligible, with conditions precedent to drawdown", "NOT_ELIGIBLE", "Not eligible");
    private static final Map<String, String> DNSH_STATUS = Map.of("PASS", "Passes", "PASS_WITH_CONDITIONS",
            "Passes with conditions", "FAIL", "Fails", "MISSING_DATA", "Missing data");
    private static final Map<String, String> OBJECTIVES = Map.of("CLIMATE_MITIGATION", "Climate change mitigation",
            "CLIMATE_ADAPTATION", "Climate change adaptation", "WATER_MARINE_RESOURCES", "Water and marine resources",
            "CIRCULAR_ECONOMY", "Circular economy", "POLLUTION_PREVENTION", "Pollution prevention", "BIODIVERSITY",
            "Biodiversity");
    private static final Map<String, String> RATE_COMPONENTS = Map.of("FUNDING_COST", "Funding cost", "RISK_COST",
            "Risk cost", "CAPITAL_COST", "Cost of capital", "OPERATIONAL_COST", "Operational cost", "TARGET_PROFIT",
            "Target profit", "PROGRAM_SUBSIDY", "Programme subsidy", "TIER_ADJUSTMENT", "Green tier adjustment");

    private final CalcStore calcs;
    private final byte[] regular;
    private final byte[] bold;

    public ReportService(CalcStore calcs) {
        this.calcs = calcs;
        this.regular = font("fonts/DejaVuSans.ttf");
        this.bold = font("fonts/DejaVuSans-Bold.ttf");
    }

    private static byte[] font(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Missing font " + path, e);
        }
    }

    /** The report of an approved dossier. */
    public byte[] build(Run run) {
        if (run.status() != RunStatus.APROBAT && run.status() != RunStatus.MONITORIZARE) {
            throw new IllegalStateException("The PDF report is generated after approval; the dossier is in status " + run.status());
        }
        JsonNode report = run.agentOutputs().get(AgentSlot.GREEN_UNDERWRITER);
        JsonNode funding = run.agentOutputs().get(AgentSlot.FUNDING_OPTIMIZER);
        JsonNode technical = run.agentOutputs().get(AgentSlot.TECHNICAL_AUDITOR);
        if (report == null || funding == null || technical == null) {
            throw new IllegalStateException("The dossier has no green report");
        }
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4, 40, 40, 40, 40);
            PdfWriter.getInstance(document, bytes);
            document.open();
            Fonts fonts = new Fonts();
            title(document, fonts, run);
            summary(document, fonts, run, report, funding, technical);
            criterion(document, fonts, run, report, technical);
            fund(document, fonts, report);
            rate(document, fonts, run, funding);
            dnsh(document, fonts, report);
            impact(document, fonts, run, report);
            conditions(document, fonts, report);
            risks(document, fonts, report);
            document.add(new Paragraph("Interest rate parameters and thresholds are demo values, to be confirmed with Raiffeisen. "
                    + "All figures come from the calculation engine.", fonts.small));
            document.close();
            return bytes.toByteArray();
        } catch (DocumentException e) {
            throw new IllegalStateException("Could not generate the PDF report", e);
        }
    }

    private final class Fonts {
        final BaseFont regularBase = base(regular, "dejavu-regular");
        final BaseFont boldBase = base(bold, "dejavu-bold");
        final Font h1 = new Font(boldBase, 18, Font.NORMAL, GREEN);
        final Font h2 = new Font(boldBase, 12, Font.NORMAL, GREEN);
        final Font body = new Font(regularBase, 9);
        final Font bodyBold = new Font(boldBase, 9);
        final Font small = new Font(regularBase, 8, Font.NORMAL, Color.GRAY);

        private BaseFont base(byte[] data, String name) {
            try {
                return BaseFont.createFont(name + ".ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED, true, data, null);
            } catch (DocumentException | IOException e) {
                throw new IllegalStateException(e);
            }
        }
    }

    private void title(Document d, Fonts f, Run run) throws DocumentException {
        d.add(new Paragraph("Green report · GreenStruct Agro", f.h1));
        d.add(new Paragraph("Dossier " + run.id() + " · " + run.farmProfile().company().name() + " (CUI "
                + run.farmProfile().company().cui() + ") · module " + run.request().moduleId(), f.body));
        d.add(new Paragraph(" ", f.body));
    }

    private void summary(Document d, Fonts f, Run run, JsonNode report, JsonNode funding, JsonNode technical)
            throws DocumentException {
        PdfPTable t = table(2, 30, 70);
        row(t, f, "Decision", DECISIONS.getOrDefault(report.path("decision").asText(), report.path("decision").asText()));
        row(t, f, "Green tier", TIERS.getOrDefault(funding.path("greenTier").path("tier").asText(), "—"));
        row(t, f, "Option chosen by the SME", run.submission() == null ? "—" : run.submission().variant().labelRo());
        row(t, f, "SME status", String.valueOf(run.farmProfile().company().smeStatus()));
        row(t, f, "Technical conclusion", technical.path("summaryRo").asText());
        row(t, f, "Committee summary", report.path("committeeSummaryRo").asText());
        d.add(t);
    }

    private void criterion(Document d, Fonts f, Run run, JsonNode report, JsonNode technical) throws DocumentException {
        section(d, f, "Green criterion and threshold");
        JsonNode c = report.path("criterion");
        PdfPTable t = table(2, 30, 70);
        row(t, f, "Indicator", c.path("indicator").asText());
        row(t, f, "Value achieved", display(run, c.path("valueCalcId").asText()));
        row(t, f, "Threshold", display(run, c.path("thresholdCalcId").asText()));
        row(t, f, "Result", "PASS".equals(c.path("result").asText()) ? "Threshold met" : "Threshold not met");
        row(t, f, "Threshold source", c.path("sourceRo").asText());
        d.add(t);
    }

    private void fund(Document d, Fonts f, JsonNode report) throws DocumentException {
        section(d, f, "Proposed fund and requirements");
        JsonNode fund = report.path("fund");
        PdfPTable t = table(2, 30, 70);
        row(t, f, "Fund", fund.path("fundId").asText() + " (" + fund.path("role").asText() + ")");
        row(t, f, "Green bond category", report.path("greenBond").path("category").asText() + " — "
                + report.path("greenBond").path("noteRo").asText());
        for (JsonNode requirement : fund.path("requirements")) {
            row(t, f, requirement.path("requirementId").asText(), requirement.path("status").asText() + " — "
                    + requirement.path("noteRo").asText());
        }
        for (JsonNode alternative : fund.path("alternatives")) {
            row(t, f, "Alternative " + alternative.path("fundId").asText(), alternative.path("status").asText());
        }
        d.add(t);
    }

    private void rate(Document d, Fonts f, Run run, JsonNode funding) throws DocumentException {
        section(d, f, "Interest rate by component: classic vs green");
        JsonNode comparison = funding.path("comparison");
        PdfPTable t = table(2, 60, 40);
        for (JsonNode diff : comparison.path("rateDifference")) {
            row(t, f, RATE_COMPONENTS.getOrDefault(diff.path("component").asText(), diff.path("component").asText())
                    + " (green − classic)", display(run, diff.path("deltaCalcId").asText()));
        }
        row(t, f, "Total (green − classic)", display(run, comparison.path("rateDifferenceCalcId").asText()));
        row(t, f, "Net advantage of the green credit", display(run, comparison.path("netAdvantageCalcId").asText()));
        d.add(t);
    }

    private void dnsh(Document d, Fonts f, JsonNode report) throws DocumentException {
        section(d, f, "DNSH: do no significant harm");
        PdfPTable t = table(3, 30, 20, 50);
        for (JsonNode row : report.path("dnsh")) {
            cell(t, f.body, OBJECTIVES.getOrDefault(row.path("objective").asText(), row.path("objective").asText()));
            cell(t, f.bodyBold, DNSH_STATUS.getOrDefault(row.path("status").asText(), row.path("status").asText()));
            cell(t, f.body, row.path("justificationRo").asText());
        }
        d.add(t);
    }

    private void impact(Document d, Fonts f, Run run, JsonNode report) throws DocumentException {
        section(d, f, "Estimated impact");
        PdfPTable t = table(2, 60, 40);
        for (JsonNode i : report.path("impact")) {
            row(t, f, i.path("metric").asText() + (("HORIZON".equals(i.path("period").asText())) ? " (over horizon)" : " (per year)"),
                    display(run, i.path("calcId").asText()));
        }
        d.add(t);
    }

    private void conditions(Document d, Fonts f, JsonNode report) throws DocumentException {
        section(d, f, "Conditions precedent to drawdown");
        List<String> lines = new ArrayList<>();
        for (JsonNode c : report.path("conditionsPrecedent")) {
            lines.add((c.path("blocking").asBoolean() ? "[blocking] " : "") + c.path("descriptionRo").asText());
        }
        if (lines.isEmpty()) {
            lines.add("No conditions.");
        }
        for (String line : lines) {
            d.add(new Paragraph("• " + line, f.body));
        }
    }

    private void risks(Document d, Fonts f, JsonNode report) throws DocumentException {
        section(d, f, "Risks");
        for (JsonNode r : report.path("risks")) {
            d.add(new Paragraph("• [" + r.path("severity").asText() + "] " + r.path("descriptionRo").asText()
                    + " Mitigation: " + r.path("mitigationRo").asText(), f.body));
        }
    }

    private String display(Run run, String calcId) {
        return calcs.find(run.id(), calcId).map(Calc::display).orElse("—");
    }

    private static void section(Document d, Fonts f, String title) throws DocumentException {
        Paragraph p = new Paragraph(title, f.h2);
        p.setSpacingBefore(10);
        p.setSpacingAfter(3);
        d.add(p);
    }

    private static PdfPTable table(int columns, float... widths) throws DocumentException {
        PdfPTable t = new PdfPTable(columns);
        t.setWidthPercentage(100);
        t.setWidths(widths);
        return t;
    }

    private static void row(PdfPTable t, Fonts f, String label, String value) {
        cell(t, f.bodyBold, label);
        cell(t, f.body, value);
    }

    private static void cell(PdfPTable t, Font font, String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setPadding(3);
        c.setHorizontalAlignment(Element.ALIGN_LEFT);
        t.addCell(c);
    }
}
