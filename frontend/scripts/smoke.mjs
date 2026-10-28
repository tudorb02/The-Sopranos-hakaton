// Smoke test of the API client and the SSE helper against a running backend, without a browser:
//   cd backend && GREENSTRUCT_ANAF_ENABLED=false GREENSTRUCT_ANALYSIS_DATE=2026-10-28 mvn spring-boot:run
//   cd frontend && node scripts/smoke.mjs            (API_BASE=http://localhost:8080 by default)
// It walks the whole product: modules, farm, demo run, live events, the SME view, a multipart run, submit, the officer
// actions, monitoring, portfolio and the PDF, and asserts the shapes the screens rely on. Exit code 1 on a failure.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as api from "../src/lib/api.js";
import { calcOf, disp, loanOf, optionFor } from "../src/lib/calc.js";
import { projectParcels } from "../src/lib/geo.js";
import { agentStates, subscribeRun } from "../src/lib/sse.js";

api.setApiBase(process.env.API_BASE ?? "http://localhost:8080");
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPECT_MODULES = ["irigatii", "energie", "utilaje", "zootehnie", "post_recolta", "ecologic"];

let failures = 0;
const warnings = [];
function check(ok, label, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures += 1;
}
const warn = (text) => {
  warnings.push(text);
  console.log(`warn ${text}`);
};

async function collectEvents(runId, after = 0) {
  const events = [];
  const statuses = [];
  const sub = subscribeRun(runId, { after, onEvent: (e) => events.push(e), onStatus: (s) => statuses.push(s), retryMs: 200 });
  await Promise.race([sub.done, new Promise((r) => setTimeout(r, 20000))]);
  sub.close();
  return { events, statuses };
}

async function expectApiError(promise, code, label) {
  try {
    await promise;
    check(false, label, "no error thrown");
  } catch (e) {
    check(e instanceof api.ApiError && e.code === code && typeof e.message === "string", label, `${e.code}: ${e.message}`);
  }
}

// ---- modules and farm ----
const modules = await api.getModules();
check(modules.length === 6 && EXPECT_MODULES.every((id) => modules.some((m) => m.moduleId === id)), "GET /api/modules: the 6 categories");
check(
  modules.every((m) => m.requiredDocs.length > 0 && m.questionnaire.length > 0 && m.questionnaire.length <= 15 && m.indicator && m.threshold),
  "every module has docs, <=15 questions, indicator, threshold",
);
const types = new Set(modules.flatMap((m) => m.questionnaire.map((q) => q.type)));
check([...types].every((t) => ["TEXT", "NUMBER", "BOOLEAN", "SINGLE_CHOICE", "MULTI_CHOICE", "MONTHS"].includes(t)), "question types known", [...types].join(","));
const notReady = modules.filter((m) => m.status !== "DEMO_READY").map((m) => m.moduleId);
if (notReady.length) warn(`modules not DEMO_READY: ${notReady.join(", ")}`);

const farm = await api.getFarm("45871203");
check(farm.company.smeStatus === "SME" && farm.company.name, "GET /api/farms/45871203: company + smeStatus", farm.company.name);
check(farm.parcels.features.length > 0 && farm.parcels.features.every((f) => f.properties.droughtRisk), "parcels GeoJSON with risk flags");
check(projectParcels(farm.parcels).every((p) => p.path.startsWith("M")), "parcels project to SVG paths");
check(farm.dataSources.some((s) => s.source === "ANAF") && farm.dataSources.every((s) => ["LIVE", "MOCK", "CACHE"].includes(s.mode)), "dataSources with mode");
check(Array.isArray(farm.cashflow.peakMonths), "cashflow.peakMonths", farm.cashflow.peakMonths.join(","));
await expectApiError(api.getFarm("99999999"), "NOT_FOUND", "unknown CUI -> {error:{code,message}}");

// ---- demo run + live events ----
const created = await api.createDemoRun("irigatii");
check(/^run_[0-9a-z]{12}$/.test(created.runId) && created.state === "CREAT", "POST /api/runs/demo/irigatii", created.runId);
const { events, statuses } = await collectEvents(created.runId);
check(events.length > 10 && events.every((e, i) => e.seq === i + 1), "SSE: contiguous seq from 1", `${events.length} events`);
check(events.at(-1).type === "run.completed" && statuses.at(-1) === "done", "SSE: closes after run.completed");
const states = agentStates(events);
check(["TECHNICAL_AUDITOR", "FUNDING_OPTIMIZER", "GREEN_UNDERWRITER"].every((a) => ["COMPLETED", "DEGRADED"].includes(states[a]?.status)), "SSE: the 3 agents finished", JSON.stringify(Object.values(states).map((s) => s.source)));
check(events.some((e) => e.type === "agent.tool_call" && e.data.input) && events.some((e) => e.type === "agent.tool_result" && Array.isArray(e.data.calcs)), "SSE: tool_call.input and tool_result.calcs");
const resumed = await collectEvents(created.runId, 30);
check(resumed.events[0]?.seq === 31 && resumed.events.length === events.length - 30, "SSE: reconnect with ?after=30 resumes at 31");
const done = events.at(-1);
check(Boolean(done.data.netAdvantageCalcId), "run.completed carries netAdvantageCalcId");
const leaked = events.filter((e) => /\bF[1-6]\b|FEI|InvestEU|DSCR/i.test(e.message));
if (leaked.length) warn(`${leaked.length} event messages mention funds/DSCR (the SME screens replace them): seq ${leaked.map((e) => e.seq).slice(0, 6).join(",")}`);

// ---- SME view ----
const sme = await api.getRun(created.runId, "sme");
const funding = sme.agents.fundingRecommendation;
check(sme.state === "GATA" && sme.agentStatus.length === 3, "GET run?view=sme: GATA, 3 agentStatus");
check(!("officerNotesRo" in funding), "sme view has no officerNotesRo");
check(!sme.agents.underwritingReport.fund && !sme.agents.underwritingReport.dnsh, "sme report has no fund/DNSH");
if (funding.options.some((o) => o.rateBreakdown) || funding.comparison.rateDifference) warn("sme view still carries rateBreakdown / comparison.rateDifference / programChecks / fund stack (screens do not render them)");
const classic = optionFor(funding, "CLASIC");
const green = optionFor(funding, "VERDE");
check(classic?.kind === "STANDARD" && green?.greenEligible === true, "options: classic + green");
const gl = loanOf(green);
check(gl.repayment.scheduleType === "SEASONAL" && calcOf(sme, gl.repayment.scheduleCalcId)?.series?.length > 12, "green schedule calc has a series");
const point = calcOf(sme, gl.repayment.scheduleCalcId).series[0];
check(point.period && typeof point.values.payment === "number", "series point {period, values.payment}", JSON.stringify(point));
check(/EUR/.test(disp(sme, funding.comparison.netAdvantageCalcId)), "netAdvantage display", disp(sme, funding.comparison.netAdvantageCalcId));
check(["VERDE_PLUS", "VERDE", "VERDE_CU_UPGRADE", "CLASIC"].includes(funding.greenTier.tier), "greenTier", funding.greenTier.tier);
check(Boolean(sme.agents.technicalAssessment.configurations.length) && Boolean(sme.agents.underwritingReport.conditionsPrecedent.length), "technical assessment + conditions");
for (const id of [loanOf(classic).amountCalcId, loanOf(classic).rateCalcId, gl.repayment.graceCalcId, funding.comparison.upgradePaybackCalcId]) {
  check(Boolean(calcOf(sme, id)?.display), `calc ${id} resolves`, disp(sme, id));
}

// ---- multipart run from the demo files ----
const docsDir = join(root, "data", "demo", "docs");
const pdfs = readdirSync(docsDir).filter((f) => f.endsWith(".pdf"));
const file = (name) => new File([readFileSync(join(docsDir, name))], name, { type: "application/pdf" });
const scenario = JSON.parse(readFileSync(join(root, "data", "demo", "scenarios", "irigatii.json"), "utf8"));
try {
  const manual = await api.createRun({
    cui: "45871203",
    moduleId: "irigatii",
    parcelIds: scenario.parcelIds,
    questionnaire: scenario.questionnaire,
    consents: { apia: true, openBanking: true },
    documents: scenario.documents.map((d) => ({ docType: d.docType, file: file(d.file.replace("docs/", "")) })),
  });
  check(/^run_/.test(manual.runId), "POST /api/runs multipart accepted", `${manual.runId} (${pdfs.length} demo pdfs)`);
  const manualEvents = await collectEvents(manual.runId);
  const last = manualEvents.events.at(-1);
  if (last?.type === "run.completed") check(true, "multipart run completes");
  else warn(`multipart run ended with ${last?.type}: ${last?.message}`);
} catch (e) {
  warn(`multipart run failed: ${e.code} ${e.message}`);
}
await expectApiError(api.createRun({ cui: "45871203", moduleId: "irigatii", parcelIds: [], questionnaire: {}, documents: [{ docType: "OFFER", file: file(pdfs[0]) }] }), "VALIDATION_ERROR", "empty parcelIds -> VALIDATION_ERROR");

// ---- submit, officer ----
await expectApiError(api.approveRun(created.runId, { officerId: "ofiter.demo" }), "INVALID_STATE", "approve before submit -> INVALID_STATE");
const submitted = await api.submitRun(created.runId, "VERDE");
check(submitted.state === "TRIMIS" && submitted.submission.variant === "VERDE" && submitted.submission.optionId, "POST submit VERDE -> TRIMIS");
await expectApiError(api.submitRun(created.runId, "VERDE"), "INVALID_STATE", "second submit -> INVALID_STATE");
const afterSubmit = await collectEvents(created.runId, events.length);
check(afterSubmit.events.some((e) => e.type === "state.transition" && e.data.to === "TRIMIS"), "SSE after reconnect: GATA -> TRIMIS", String(afterSubmit.events.length));

const full = await api.getRun(created.runId, "full");
const report = full.agents.underwritingReport;
check(report.fund?.fundId && report.fund.requirements.length > 0 && report.dnsh.length > 0 && report.greenBond, "full view: fund, requirements, DNSH, greenBond");
check(Boolean(full.agents.fundingRecommendation.officerNotesRo), "full view: officerNotesRo");
check(green.rateBreakdown.components.every((c) => calcOf(full, c.calcId)) && full.agents.fundingRecommendation.comparison.rateDifference.length > 0, "full view: rate decomposition resolves");

const afterRequest = await api.requestDocuments(created.runId, {
  officerId: "ofiter.demo",
  messageRo: "Trimite oferta actualizată.",
  documents: [{ docType: "OFFER", labelRo: "Oferta actualizată de la furnizor", conditionId: report.conditionsPrecedent[0].conditionId }],
});
check(afterRequest.state === "TRIMIS" && afterRequest.pendingDocuments.length === 1, "request-documents keeps TRIMIS, adds pendingDocuments");
const smeAfter = await api.getRun(created.runId, "sme");
check(smeAfter.pendingDocuments.length === 1, "SME view sees the pending document");

const approved = await api.approveRun(created.runId, { officerId: "ofiter.demo", commentRo: "Aprobat." });
check(["APROBAT", "MONITORIZARE"].includes(approved.state) && approved.officerActions.some((a) => a.action === "APPROVE"), "approve", approved.state);
const monitored = await api.simulateMonitoring(created.runId);
const m = monitored.monitoring;
check(m?.metrics.length > 0 && m.metrics.every((x) => calcOf(monitored, x.estimatedCalcId) && calcOf(monitored, x.actualCalcId)), "simulate-monitoring: metrics resolve");
check(typeof m.confirmed === "boolean" && calcOf(monitored, m.rateBeforeCalcId) && calcOf(monitored, m.rateAfterCalcId), "monitoring: rate before/after", `${disp(monitored, m.rateBeforeCalcId)} -> ${disp(monitored, m.rateAfterCalcId)}`);
const portfolio = await api.getPortfolio();
check(portfolio.loanCount >= 1 && portfolio.byFund.length > 0 && portfolio.impact, "GET /api/portfolio", `${portfolio.loanCount} loans`);
const pdf = await fetch(api.reportUrl(created.runId));
check(pdf.ok && (pdf.headers.get("content-type") ?? "").includes("pdf"), "GET report.pdf", pdf.headers.get("content-type"));

// ---- the other demos ----
for (const id of EXPECT_MODULES) {
  const r = await api.createDemoRun(id);
  const { events: ev } = await collectEvents(r.runId);
  const last = ev.at(-1);
  console.log(`info demo ${id}: ${last?.type} (${ev.length} events)`);
  if (last?.type !== "run.completed") warn(`demo ${id} did not complete: ${last?.type} ${last?.message}`);
}

console.log(`\n${failures ? `${failures} FAILED` : "all checks passed"}${warnings.length ? `, ${warnings.length} warnings` : ""}`);
process.exit(failures ? 1 : 0);
