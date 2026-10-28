// Validates the contracts: JSON Schemas compile, fixtures match the event envelope and
// agent schemas, cross-references hold (calcIds, configIds, componentIds, states), and
// the OpenAPI examples match their component schemas.
// Run: npm run validate   (exit code 1 on any error)
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://contracts.greenstruct.ro/';
const AGENT_SCHEMAS = ['submit_offer_extraction', 'submit_technical_assessment', 'submit_funding_recommendation', 'submit_underwriting_report'];
const CALC_RE = /^calc_[a-f0-9]{12}$/;

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// ---------- schemas ----------

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const schemas = {};
for (const f of readdirSync(join(ROOT, 'schemas')).filter((f) => f.endsWith('.json'))) {
  const s = readJson(`schemas/${f}`);
  if (s.$id !== `${BASE}schemas/${f}`) fail(`schemas/${f}`, `$id must be ${BASE}schemas/${f}`);
  schemas[f.replace('.json', '')] = s;
  ajv.addSchema(s);
}
for (const name of [...AGENT_SCHEMAS, 'event']) {
  if (!schemas[name]) fail('schemas', `missing ${name}.json`);
}
const validateEvent = ajv.getSchema(`${BASE}schemas/event.json`);

// $defs with the same name must be identical across files (they are copied so each
// agent schema stays self-contained for Bedrock).
const defsByName = {};
for (const [file, s] of Object.entries(schemas)) {
  for (const [name, def] of Object.entries(s.$defs ?? {})) {
    const key = JSON.stringify(def);
    if (defsByName[name] && defsByName[name].key !== key) fail(`schemas/${file}.json`, `$defs/${name} differs from schemas/${defsByName[name].file}.json`);
    defsByName[name] ??= { key, file };
  }
}

// Agent outputs must not carry figures: the only numeric field allowed is a page number.
function walkTypes(node, path, file) {
  if (Array.isArray(node)) return node.forEach((n, i) => walkTypes(n, `${path}/${i}`, file));
  if (!node || typeof node !== 'object') return;
  const t = [].concat(node.type ?? []);
  if ((t.includes('number') || t.includes('integer')) && !path.endsWith('/properties/page')) fail(`schemas/${file}.json`, `numeric field at ${path}; agents must reference figures by calcId`);
  for (const [k, v] of Object.entries(node)) walkTypes(v, `${path}/${k}`, file);
}
AGENT_SCHEMAS.forEach((n) => schemas[n] && walkTypes(schemas[n], '', n));

// ---------- fixtures ----------

const TRANSITIONS = {
  null: ['CREAT'],
  CREAT: ['DATE_FIRMA', 'ESUAT'],
  DATE_FIRMA: ['AGENT_1', 'ESUAT'],
  AGENT_1: ['AGENT_2', 'ESUAT'],
  AGENT_2: ['AGENT_3', 'ESUAT'],
  AGENT_3: ['GATA', 'ESUAT'],
  GATA: ['TRIMIS'],
  TRIMIS: ['APROBAT'],
  APROBAT: ['MONITORIZARE'],
};
const AGENT_STATE = { TECHNICAL_AUDITOR: 'AGENT_1', FUNDING_OPTIMIZER: 'AGENT_2', GREEN_UNDERWRITER: 'AGENT_3' };
const AGENT_SUBMIT = { TECHNICAL_AUDITOR: 'submit_technical_assessment', FUNDING_OPTIMIZER: 'submit_funding_recommendation', GREEN_UNDERWRITER: 'submit_underwriting_report' };

function collectCalcRefs(node, out = []) {
  if (typeof node === 'string') { if (CALC_RE.test(node)) out.push(node); }
  else if (Array.isArray(node)) node.forEach((n) => collectCalcRefs(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectCalcRefs(n, out));
  return out;
}

function checkOutputs(where, { assessment, funding, report }, completedEvent) {
  if (assessment) {
    const cfgIds = new Set(assessment.configurations.map((c) => c.configId));
    if (cfgIds.size !== assessment.configurations.length) fail(where, 'duplicate configId');
    for (const id of [assessment.initialConfigId, assessment.recommendedConfigId]) if (!cfgIds.has(id)) fail(where, `config ${id} not in configurations`);
    const initial = assessment.configurations.find((c) => c.configId === assessment.initialConfigId);
    const initialCmp = new Set(initial?.components.map((c) => c.componentId));
    for (const cfg of assessment.configurations) for (const c of cfg.components) {
      if (c.replacesComponentId && !initialCmp.has(c.replacesComponentId)) fail(where, `${c.componentId} replaces unknown ${c.replacesComponentId}`);
      if (c.source !== 'OFFER' && !c.catalogId) fail(where, `${c.componentId} from catalog has no catalogId`);
    }
  }
  if (funding && assessment) {
    const cfgIds = new Set(assessment.configurations.map((c) => c.configId));
    const optIds = funding.options.map((o) => o.optionId);
    if (!optIds.includes(funding.recommendedOptionId)) fail(where, 'recommendedOptionId not in options');
    for (const o of funding.options) {
      if (!cfgIds.has(o.configId)) fail(where, `option ${o.optionId} uses unknown ${o.configId}`);
      const items = new Set(o.fundingStack.map((i) => i.itemId));
      for (const i of o.fundingStack) {
        if (i.type === 'GUARANTEE' && !items.has(i.guaranteesItemId)) fail(where, `guarantee ${i.itemId} covers unknown ${i.guaranteesItemId}`);
        if (i.repayment?.scheduleType === 'SEASONAL' && !i.repayment.paymentMonths) fail(where, `${i.itemId} seasonal without paymentMonths`);
      }
    }
    const b = funding.recommendationBasis;
    const rec = funding.options.find((o) => o.optionId === funding.recommendedOptionId);
    if (rec?.kind !== 'STANDARD' && !(b.greenEligible && b.netAdvantagePositive && b.affordabilityPassed)) fail(where, 'green option recommended without all three conditions');
  }
  if (report && assessment) {
    const recCfg = assessment.configurations.find((c) => c.configId === assessment.recommendedConfigId);
    const recCmp = new Set(recCfg.components.map((c) => c.componentId));
    const labeled = new Set(report.componentLabels.map((l) => l.componentId));
    for (const id of labeled) if (!recCmp.has(id)) fail(where, `label for ${id} not in recommended config`);
    for (const id of recCmp) if (!labeled.has(id)) fail(where, `component ${id} has no label`);
    for (const l of report.componentLabels) if ((l.label === 'TAXONOMY_ALIGNED') !== Boolean(l.taxonomyActivity)) fail(where, `${l.componentId}: taxonomyActivity only and always for TAXONOMY_ALIGNED`);
    const objs = report.dnsh.map((d) => d.objective);
    if (new Set(objs).size !== 5) fail(where, 'DNSH must cover 5 distinct objectives');
    if (objs.includes(report.substantialContribution)) fail(where, 'DNSH must exclude the substantial contribution objective');
    const cps = new Set(report.conditionsPrecedent.map((c) => c.conditionId));
    for (const ref of [...report.dnsh, ...report.farmerNextSteps].map((x) => x.conditionId).filter(Boolean)) if (!cps.has(ref)) fail(where, `unknown conditionId ${ref}`);
    if (funding && report.recommendedOptionId !== funding.recommendedOptionId) fail(where, 'report and funding disagree on recommended option');
    if (report.criterion.valueCalcId !== recCfg.indicatorCalcId) fail(where, 'criterion value must be the recommended config indicator');
    if (report.criterion.thresholdCalcId !== assessment.threshold.thresholdCalcId) fail(where, 'criterion threshold differs from assessment');
  }
  return completedEvent;
}

function checkFixture(file) {
  const lines = readFileSync(join(ROOT, 'fixtures', file), 'utf8').split('\n').filter(Boolean);
  const calcs = new Map();
  const toolCalls = new Map();
  const outputs = {};
  let state = null;
  let prevAt = 0;
  let runId = null;
  let lastRunCompleted = null;
  lines.forEach((line, i) => {
    const where = `fixtures/${file}:${i + 1}`;
    let ev;
    try { ev = JSON.parse(line); } catch (e) { return fail(where, `invalid JSON: ${e.message}`); }
    if (!validateEvent(ev)) return fail(where, ajv.errorsText(validateEvent.errors, { dataVar: 'event' }));
    if (ev.seq !== i + 1) fail(where, `seq ${ev.seq}, expected ${i + 1}`);
    runId ??= ev.runId;
    if (ev.runId !== runId) fail(where, 'runId changes within the run');
    const at = Date.parse(ev.at);
    if (at < prevAt) fail(where, '`at` goes back in time');
    prevAt = at;

    if (ev.agent && state !== AGENT_STATE[ev.agent]) fail(where, `${ev.agent} event while state is ${state}`);

    if (ev.type === 'state.transition') {
      if (ev.data.from !== state) fail(where, `transition from ${ev.data.from}, current state is ${state}`);
      if (!(TRANSITIONS[state] ?? []).includes(ev.data.to)) fail(where, `illegal transition ${state} → ${ev.data.to}`);
      state = ev.data.to;
    }
    if (ev.type === 'agent.tool_call') toolCalls.set(ev.data.toolUseId, ev.data.tool);
    if (ev.type === 'agent.tool_result') {
      const isRejectedSubmit = ev.data.status === 'ERROR' && ev.data.tool.startsWith('submit_');
      if (!isRejectedSubmit && toolCalls.get(ev.data.toolUseId) !== ev.data.tool) fail(where, `tool_result ${ev.data.toolUseId} without matching tool_call`);
      for (const c of ev.data.calcs) {
        if (calcs.has(c.calcId)) fail(where, `calcId ${c.calcId} emitted twice`);
        if (c.tool !== ev.data.tool) fail(where, `calc ${c.key} says tool ${c.tool}, emitted by ${ev.data.tool}`);
        for (const d of c.dependsOn ?? []) if (!calcs.has(d)) fail(where, `calc ${c.key} depends on unknown ${d}`);
        calcs.set(c.calcId, c);
      }
    }
    // every calcId mentioned outside the calcs arrays must already exist
    const { calcs: _own, ...rest } = ev.data;
    for (const ref of collectCalcRefs(rest)) if (!calcs.has(ref)) fail(where, `unknown calcId ${ref}`);

    if (ev.type === 'agent.completed') {
      if (ev.data.submitTool !== AGENT_SUBMIT[ev.agent]) fail(where, `${ev.agent} must finish with ${AGENT_SUBMIT[ev.agent]}`);
      const key = { submit_technical_assessment: 'assessment', submit_funding_recommendation: 'funding', submit_underwriting_report: 'report' }[ev.data.submitTool];
      outputs[key] = ev.data.output;
      checkOutputs(where, outputs, ev);
    }
    if (ev.type === 'run.completed') {
      lastRunCompleted = ev;
      if (ev.data.decision !== outputs.report?.decision) fail(where, 'decision differs from the underwriting report');
      if (ev.data.netAdvantageCalcId !== outputs.funding?.comparison.netAdvantageCalcId) fail(where, 'netAdvantageCalcId differs from the funding recommendation');
    }
  });
  if (!lastRunCompleted) fail(`fixtures/${file}`, 'no run.completed event');
  for (const k of ['assessment', 'funding', 'report']) if (!outputs[k]) fail(`fixtures/${file}`, `no agent.completed for ${k}`);
  return { events: lines.length, calcs: calcs.size, calcMap: calcs };
}

const fixtureFiles = readdirSync(join(ROOT, 'fixtures')).filter((f) => f.endsWith('.ndjson'));
const fixtureStats = Object.fromEntries(fixtureFiles.map((f) => [f, checkFixture(f)]));

// ---------- events.md examples ----------

const eventsMd = readFileSync(join(ROOT, 'events.md'), 'utf8');
const mdExamples = [...eventsMd.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
const mdTypes = new Set();
mdExamples.forEach((block, i) => {
  const where = `events.md json block ${i + 1}`;
  let ev;
  try { ev = JSON.parse(block); } catch (e) { return fail(where, `invalid JSON: ${e.message}`); }
  if (!validateEvent(ev)) return fail(where, ajv.errorsText(validateEvent.errors, { dataVar: 'event' }));
  mdTypes.add(ev.type);
});
for (const t of schemas.event.properties.type.enum) {
  if (!mdTypes.has(t) && !eventsMd.includes(`"type":"${t}"`)) fail('events.md', `no example for ${t}`);
}

// ---------- OpenAPI examples ----------

const openapi = parseYaml(readFileSync(join(ROOT, 'openapi.yaml'), 'utf8'));
const ajvOas = new Ajv2020({ strict: false, allErrors: true, validateSchema: false });
addFormats(ajvOas);
Object.values(schemas).forEach((s) => ajvOas.addSchema(s));
ajvOas.addSchema({ ...openapi, $id: `${BASE}openapi.yaml` });

const exampleChecks = [];
for (const [path, item] of Object.entries(openapi.paths)) {
  for (const [method, op] of Object.entries(item)) {
    for (const [status, resp] of Object.entries(op.responses ?? {})) {
      for (const [mime, media] of Object.entries(resp.content ?? {})) {
        for (const [name, ex] of Object.entries(media.examples ?? {})) {
          if (!ex.$ref || !media.schema?.$ref) continue;
          exampleChecks.push({ where: `${method.toUpperCase()} ${path} ${status} ${mime} example ${name}`, file: ex.$ref.replace(/^\.\//, ''), schemaRef: media.schema.$ref });
        }
      }
    }
  }
}
for (const { where, file, schemaRef } of exampleChecks) {
  const validate = ajvOas.getSchema(`${BASE}openapi.yaml${schemaRef}`);
  const { value } = readJson(file);
  if (!validate(value)) fail(where, ajvOas.errorsText(validate.errors, { dataVar: file }));
}
// RunView examples must match their fixture
for (const [file, fixture] of readdirSync(join(ROOT, 'examples')).filter((f) => /^run-.*\.json$/.test(f))
  .map((f) => [`examples/${f}`, `${f.slice(4, -5)}.ndjson`])) {
  const { value } = readJson(file);
  const stats = fixtureStats[fixture];
  if (!stats) { fail(file, `fixture ${fixture} missing`); continue; }
  if (value.lastEventSeq !== stats.events) fail(file, `lastEventSeq ${value.lastEventSeq}, fixture has ${stats.events} events`);
  for (const [id, c] of Object.entries(value.calcs)) {
    if (c.calcId !== id) fail(file, `calcs key ${id} ≠ calcId ${c.calcId}`);
    if (JSON.stringify(stats.calcMap.get(id)) !== JSON.stringify(c)) fail(file, `calc ${id} differs from the fixture`);
  }
}

// ---------- report ----------

if (errors.length) {
  console.error(`✗ ${errors.length} error(s):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ ${Object.keys(schemas).length} schemas compile; shared $defs consistent; agent schemas carry no figures`);
for (const [f, s] of Object.entries(fixtureStats)) console.log(`✓ fixtures/${f}: ${s.events} events, ${s.calcs} calcs, all references resolve`);
console.log(`✓ ${mdExamples.length} events.md examples match the envelope`);
console.log(`✓ ${exampleChecks.length} OpenAPI examples match their schemas`);
