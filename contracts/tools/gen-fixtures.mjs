// Generates contracts/fixtures/*.ndjson and contracts/examples/*.json.
// The figures here follow the formulas in the architecture plan (§4, §5) and the
// research doc; the Java engine must reproduce them (use them as JUnit expectations).
// Run: npm run gen   (then npm run validate)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL_AGENT = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
const MODEL_EXTRACT = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

// ---------- formatting & math ----------

const UNIT_SUFFIX = {
  EUR: ' EUR', EUR_PER_MONTH: ' EUR/lună', EUR_PER_YEAR: ' EUR/an', EUR_PER_L: ' EUR/l', EUR_PER_M3: ' EUR/m³',
  EUR_PER_KWH: ' EUR/kWh', EUR_PER_HA: ' EUR/ha', PCT: '%', RATIO: '', M3: ' m³', M3_PER_YEAR: ' m³/an',
  M3_PER_HA: ' m³/ha', KWH: ' kWh', KWH_PER_YEAR: ' kWh/an', KWH_PER_M3: ' kWh/m³', KWH_PER_KWP: ' kWh/kWp',
  L: ' l', L_PER_YEAR: ' l/an', L_PER_HA: ' l/ha', KG_N_PER_YEAR: ' kg N/an', KG_N_PER_HA: ' kg N/ha',
  T_CO2: ' t CO₂', T_CO2_PER_YEAR: ' t CO₂/an', KG_CO2_PER_L: ' kg CO₂/l', KG_CO2_PER_KWH: ' kg CO₂/kWh',
  HA: ' ha', HP: ' CP', HP_PER_HA: ' CP/ha', KW: ' kW', KWP: ' kWp', MONTHS: ' luni', YEARS: ' ani',
  COUNT: ' buc', POINTS: ' puncte',
};
const UNIT_DECIMALS = {
  PCT: 1, RATIO: 2, T_CO2: 1, T_CO2_PER_YEAR: 1, KG_CO2_PER_L: 2, KG_CO2_PER_KWH: 3, EUR_PER_L: 3,
  EUR_PER_M3: 2, EUR_PER_KWH: 2, KWH_PER_M3: 2, HP_PER_HA: 2, MONTHS: 0,
};

const round = (x, d = 2) => Math.round((x + Number.EPSILON) * 10 ** d) / 10 ** d;

function fmtNumber(v, d) {
  const s = Math.abs(v).toFixed(d);
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-' : '') + grouped + (frac ? ',' + frac : '');
}

const hash12 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

function pmt(principal, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  return (principal * r) / (1 - (1 + r) ** -months);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function periodOf(startYear, startMonth, t) {
  // t = 1 is the month after disbursement
  const idx = startYear * 12 + (startMonth - 1) + t;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { label: `${y}-${String(m).padStart(2, '0')}`, month: MONTHS[m - 1] };
}

// Equal installments only in paymentMonths, such that PV at the loan rate = principal.
function schedule(principal, annualRatePct, months, startYear, startMonth, paymentMonths = null) {
  const r = annualRatePct / 100 / 12;
  const pays = [];
  for (let t = 1; t <= months; t++) {
    const p = periodOf(startYear, startMonth, t);
    pays.push({ t, ...p, pays: !paymentMonths || paymentMonths.includes(p.month) });
  }
  const pvFactor = pays.filter((p) => p.pays).reduce((s, p) => s + (1 + r) ** -p.t, 0);
  const installment = principal / pvFactor;
  let balance = principal;
  let totalInterest = 0;
  const series = pays.map((p) => {
    const interest = balance * r;
    const payment = p.pays ? installment : 0;
    balance = balance + interest - payment;
    totalInterest += interest;
    return {
      period: p.label,
      values: { payment: round(payment), interest: round(interest), principal: round(payment - interest), balance: round(Math.max(balance, 0)) },
    };
  });
  const count = pays.filter((p) => p.pays).length;
  return { installment, count, totalPayments: installment * count, totalInterest, series };
}

// ---------- run builder ----------

class RunBuilder {
  constructor(runId, startIso) {
    this.runId = runId;
    this.t = Date.parse(startIso);
    this.events = [];
    this.calcs = new Map();
    this.toolSeq = 0;
  }

  emit(type, agent, message, data, dtMs = 400) {
    this.t += dtMs;
    const ev = { seq: this.events.length + 1, runId: this.runId, type, agent, at: new Date(this.t).toISOString(), message, data };
    this.events.push(ev);
    return ev;
  }

  // Deterministic calcId: hash(run + tool + key), as in plan §3.
  calc(tool, key, labelRo, rawValue, unit, extra = {}) {
    const d = extra.decimals ?? UNIT_DECIMALS[unit] ?? 0;
    const value = round(rawValue, Math.max(d, 2));
    const c = {
      calcId: `calc_${hash12(`${this.runId}|${tool}|${key}`)}`,
      tool, key, labelRo, value, unit,
      display: fmtNumber(value, d) + UNIT_SUFFIX[unit],
    };
    if (extra.formula) c.formula = extra.formula;
    if (extra.sourceRo) c.sourceRo = extra.sourceRo;
    if (extra.dependsOn) c.dependsOn = extra.dependsOn.map((x) => x.calcId);
    if (extra.series) c.series = extra.series;
    if (this.calcs.has(c.calcId)) throw new Error(`duplicate calc ${key}`);
    this.calcs.set(c.calcId, c);
    return c;
  }

  state(from, to, message, extra = {}, dt = 300) {
    return this.emit('state.transition', null, message, { from, to, actor: extra.actor ?? 'SYSTEM', ...(extra.reasonRo ? { reasonRo: extra.reasonRo } : {}), ...(extra.dataSources ? { dataSources: extra.dataSources } : {}) }, dt);
  }

  started(agent, step, message, attempt = 1) {
    return this.emit('agent.started', agent, message, { step, modelId: MODEL_AGENT, mode: 'LIVE', attempt }, 250);
  }

  thought(agent, text, iteration, dt = 1800) {
    return this.emit('agent.thought', agent, text.length > 300 ? text.slice(0, 297) + '...' : text, { text, iteration }, dt);
  }

  tool(agent, tool, iteration, input, callMsg, resultMsg, calcsFn, result, opts = {}) {
    const toolUseId = `tooluse_${hash12(`${this.runId}|${tool}|${++this.toolSeq}`)}`;
    this.emit('agent.tool_call', agent, callMsg, { toolUseId, tool, iteration, input }, opts.callDt ?? 1500);
    const calcs = calcsFn ? calcsFn() : [];
    const durationMs = opts.durationMs ?? 40 + ((this.toolSeq * 37) % 90);
    this.emit('agent.tool_result', agent, resultMsg, { toolUseId, tool, status: 'OK', durationMs, calcs, result }, opts.resultDt ?? durationMs + 60);
    return calcs;
  }

  completed(agent, submitTool, message, output, iterations, durationMs, source = 'LIVE') {
    return this.emit('agent.completed', agent, message, { submitTool, source, iterations, durationMs, output }, 2200);
  }

  ndjson() {
    return this.events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  }
}

const A1 = 'TECHNICAL_AUDITOR';
const A2 = 'FUNDING_OPTIMIZER';
const A3 = 'GREEN_UNDERWRITER';
const field = (key, rawValue, unit, page, confidence = 'HIGH') => ({ key, rawValue, unit, page, confidence });

// =====================================================================
// Scenario 1: irigatii — 40 ha vegetable farm, south-east
// =====================================================================

function buildIrigatii() {
  const R = new RunBuilder('run_irg7k2xq4m9p', '2026-10-28T09:30:00.000Z');
  const P = {
    areaHa: 40, needNetM3Ha: 3800, effOld: 0.65, effSprinkler: 0.765, effDrip: 0.88, sensorSaving: 0.08,
    kwhM3Pressurized: 0.45, kwhM3Drip: 0.25, pvKwp: 25, pvYield: 1280, waterPrice: 0.12, elecPrice: 0.2,
    gridFactor: 0.26, threshold: 25, invoiceKwh: 105230,
    offer: 85000, offerSprinkler: 70500, offerPump: 14500,
    drip: 90800, sensors: 6500, meter: 1200, solarPump: 26500,
    rateStd: 8.9, rateGreen: 6.4, term: 60, feiCoverage: 70, mortgageInitial: 1450, mortgageAnnual: 380,
    horizonYears: 5, annualNetCf: 98400, affordLimit: 40, permitM3: 240000,
  };

  R.state(null, 'CREAT', 'Dosar creat: irigații, 40 ha, 3 documente încărcate', { actor: 'FARMER' }, 0);
  R.state('CREAT', 'DATE_FIRMA', 'Am preluat datele firmei: ANAF, APIA, Open Banking, risc climatic', {
    dataSources: [
      { source: 'ANAF', mode: 'MOCK' }, { source: 'APIA', mode: 'MOCK' }, { source: 'OPEN_BANKING', mode: 'MOCK' },
      { source: 'COPERNICUS', mode: 'MOCK' }, { source: 'NATURA_2000', mode: 'MOCK' }, { source: 'NITRATES', mode: 'MOCK' },
    ],
  }, 1200);
  R.state('DATE_FIRMA', 'AGENT_1', 'Pornește auditorul tehnic', {}, 300);
  R.started(A1, 'AGENT_1', 'Agentul 1 (auditor tehnic) a pornit');

  // --- extraction (forced tool per document, in parallel) ---
  const offerTotal = R.calc('extract_document', 'doc.offer.total_net', 'Valoare ofertă aspersie (fără TVA)', P.offer, 'EUR', { sourceRo: 'Oferta AquaFlux OF-2026-1147, pag. 2' });
  const offerEff = R.calc('extract_document', 'doc.offer.efficiency', 'Eficiență de aplicare declarată (aspersie)', P.effSprinkler * 100, 'PCT', { sourceRo: 'Oferta AquaFlux, fișa tehnică, pag. 3' });
  const offerArea = R.calc('extract_document', 'doc.offer.area', 'Suprafață irigată în ofertă', P.areaHa, 'HA', { sourceRo: 'Oferta AquaFlux, pag. 1' });
  const offerSprinklerCost = R.calc('extract_document', 'doc.offer.line.sprinkler_system', 'Instalații cu tambur, conducte și montaj', P.offerSprinkler, 'EUR', { sourceRo: 'Oferta AquaFlux, pozițiile 1, 3, 4' });
  const offerPumpCost = R.calc('extract_document', 'doc.offer.line.pump', 'Electropompă 55 kW', P.offerPump, 'EUR', { sourceRo: 'Oferta AquaFlux, poziția 2' });
  const offerPumpKw = R.calc('extract_document', 'doc.offer.pump_power', 'Putere electropompă', 55, 'KW', { sourceRo: 'Oferta AquaFlux, poziția 2' });

  const extractionOffer = {
    documentId: 'doc_oferta_aspersie', documentType: 'OFFER', moduleId: 'irigatii', currency: 'EUR',
    supplierName: 'AquaFlux Irigații SRL',
    documentFields: [
      field('SUPPLIER_NAME', 'AquaFlux Irigații SRL', 'TEXT', 1),
      field('DOCUMENT_NUMBER', 'OF-2026-1147', 'TEXT', 1),
      field('DOCUMENT_DATE', '14.10.2026', 'DATE', 1),
      field('VALID_UNTIL', '30 de zile de la emitere', 'TEXT', 2, 'MEDIUM'),
      field('TOTAL_NET', '85.000,00 EUR', 'EUR', 2),
      field('VAT_AMOUNT', '17.850,00 EUR', 'EUR', 2),
      field('TOTAL_GROSS', '102.850,00 EUR', 'EUR', 2),
      field('IRRIGATION_SYSTEM_TYPE', 'aspersie cu tambur (instalație tip rulou), 2 buc.', 'TEXT', 1),
      field('IRRIGATED_AREA_HA', '40 ha', 'HA', 1),
      field('APPLICATION_EFFICIENCY_PCT', '76,5%', 'PCT', 3),
      field('OPERATING_PRESSURE_BAR', '6-8 bar', 'BAR', 3),
      field('WATER_SOURCE', 'hidrant ANIF, stația de punere sub presiune SPP 4', 'TEXT', 1, 'MEDIUM'),
    ],
    lineItems: [
      { lineId: 'ln_1', category: 'IRRIGATION_SPRINKLER', descriptionRo: 'Instalație de irigat cu tambur 110/400, 2 buc.', fields: [field('QUANTITY', '2 buc.', 'PCS', 2), field('LINE_PRICE_NET', '49.000,00 EUR', 'EUR', 2)] },
      { lineId: 'ln_2', category: 'PUMP', descriptionRo: 'Electropompă de suprafață 55 kW', fields: [field('PUMP_POWER_KW', '55 kW', 'KW', 2), field('FLOW_RATE_M3_H', '180 m³/h', 'M3_H', 3), field('LINE_PRICE_NET', '14.500,00 EUR', 'EUR', 2)] },
      { lineId: 'ln_3', category: 'PIPES', descriptionRo: 'Conducte PEHD îngropate și hidranți', fields: [field('LINE_PRICE_NET', '15.800,00 EUR', 'EUR', 2)] },
      { lineId: 'ln_4', category: 'INSTALLATION_WORKS', descriptionRo: 'Montaj și punere în funcțiune', fields: [field('LINE_PRICE_NET', '5.700,00 EUR', 'EUR', 2)] },
    ],
    missingFields: [{ key: 'WATER_METER_INCLUDED', reasonRo: 'Oferta nu menționează contor de apă. Contorizarea e obligatorie pentru creditul verde.' }],
    warnings: ['Valabilitatea ofertei expiră pe 13.11.2026.'],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_oferta_aspersie' }, '📄 Citesc oferta pentru sistemul de irigații', '📄 Oferta citită: aspersie clasică cu tambur, 85.000 EUR', () => [offerTotal, offerEff, offerArea, offerSprinklerCost, offerPumpCost, offerPumpKw], { extraction: extractionOffer, modelId: MODEL_EXTRACT }, { callDt: 600, durationMs: 4200 });

  const permitVolume = R.calc('extract_document', 'doc.permit.volume', 'Volum de apă autorizat ANAR', P.permitM3, 'M3_PER_YEAR', { sourceRo: 'Aviz de gospodărire a apelor nr. 312/2024, pag. 2' });
  const extractionPermit = {
    documentId: 'doc_aviz_anar', documentType: 'WATER_PERMIT_ANAR', moduleId: 'irigatii', currency: 'UNKNOWN',
    documentFields: [
      field('PERMIT_NUMBER', 'Aviz de gospodărire a apelor nr. 312/2024', 'TEXT', 1),
      field('PERMIT_VALID_UNTIL', '31.12.2028', 'DATE', 1),
      field('PERMITTED_VOLUME_M3', '240.000 m³/an', 'M3', 2),
      field('WATER_SOURCE', 'rețeaua ANIF, SPP 4', 'TEXT', 2),
    ],
    lineItems: [],
    missingFields: [],
    warnings: [],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_aviz_anar' }, '📄 Citesc avizul ANAR', '📄 Aviz ANAR valabil până la 31.12.2028, 240.000 m³/an', () => [permitVolume], { extraction: extractionPermit, modelId: MODEL_EXTRACT }, { callDt: 100, durationMs: 2900 });

  const invoiceKwh = R.calc('extract_document', 'doc.energy.kwh_12m', 'Energie de pompare facturată (12 luni)', P.invoiceKwh, 'KWH_PER_YEAR', { sourceRo: 'Facturi energie 10.2025–09.2026' });
  const extractionEnergy = {
    documentId: 'doc_facturi_energie', documentType: 'ENERGY_INVOICES', moduleId: 'irigatii', currency: 'RON',
    supplierName: 'Furnizor energie (demo)',
    documentFields: [
      field('PERIOD_FROM', '01.10.2025', 'DATE', 1),
      field('PERIOD_TO', '30.09.2026', 'DATE', 12),
      field('ENERGY_KWH', '105.230 kWh', 'KWH', 13),
      field('ENERGY_COST', '104.598,62 lei', 'RON', 13, 'MEDIUM'),
    ],
    lineItems: [],
    missingFields: [],
    warnings: ['Facturile acoperă tot locul de consum, nu doar pompa. Abaterea se verifică la monitorizare.'],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_facturi_energie' }, '📄 Citesc facturile de energie pe 12 luni', '📄 Consum de pompare: 105.230 kWh/an', () => [invoiceKwh], { extraction: extractionEnergy, modelId: MODEL_EXTRACT }, { callDt: 100, durationMs: 3600 });

  // --- module rules ---
  const threshold = R.calc('get_module_rules', 'rules.threshold.water_saving', 'Prag verde: economie de apă', P.threshold, 'PCT', { sourceRo: 'config/modules/irigatii.json (propunere, de confirmat cu Raiffeisen)' });
  const needNet = R.calc('get_module_rules', 'rules.need_net', 'Necesar net de apă, legume, zona sud-est', P.needNetM3Ha, 'M3_PER_HA', { sourceRo: 'config/modules/irigatii.json (valoare demo)' });
  const effOld = R.calc('get_module_rules', 'rules.eff.old_sprinkler', 'Eficiență aspersie veche (tambur, conducte uzate)', P.effOld * 100, 'PCT', { sourceRo: 'data/catalog/irigatii.json' });
  const effDrip = R.calc('get_module_rules', 'rules.eff.drip', 'Eficiență picurare', P.effDrip * 100, 'PCT', { sourceRo: 'data/catalog/irigatii.json' });
  const sensorEff = R.calc('get_module_rules', 'rules.sensors.saving', 'Reducere prin senzori de umiditate', P.sensorSaving * 100, 'PCT', { sourceRo: 'data/catalog/irigatii.json' });
  const waterPrice = R.calc('get_module_rules', 'rules.price.water', 'Preț apă de irigat (ANIF + distribuție)', P.waterPrice, 'EUR_PER_M3', { sourceRo: 'config/prices.json (demo)' });
  const elecPrice = R.calc('get_module_rules', 'rules.price.electricity', 'Preț energie electrică', P.elecPrice, 'EUR_PER_KWH', { sourceRo: 'config/prices.json (demo)' });
  const gridFactor = R.calc('get_module_rules', 'rules.factor.grid', 'Factor de emisie rețea RO', P.gridFactor, 'KG_CO2_PER_KWH', { sourceRo: 'config/factors.json (Nowtricity 2024, de confirmat cu EEA/ANRE)' });
  R.tool(A1, 'get_module_rules', 2, { moduleId: 'irigatii' }, '🔧 Citesc regulile modulului Irigații', '🔧 Prag verde: economie de apă ≥ 25%', () => [threshold, needNet, effOld, effDrip, sensorEff, waterPrice, elecPrice, gridFactor], { indicator: 'WATER_SAVING_PCT', calculator: 'irrigation', catalog: 'data/catalog/irigatii.json' });

  // --- baseline ---
  const need = P.areaHa * P.needNetM3Ha;
  const wOld = need / P.effOld;
  const area = R.calc('compute_baseline', 'baseline.area', 'Suprafață irigată (parcele selectate)', P.areaHa, 'HA', { sourceRo: 'APIA, 5 parcele selectate' });
  const baseWater = R.calc('compute_baseline', 'baseline.water', 'Apă folosită azi', wOld, 'M3_PER_YEAR', { formula: 'ha × necesar net / eficiență actuală', dependsOn: [area, needNet, effOld] });
  const baseEnergy = R.calc('compute_baseline', 'baseline.energy', 'Energie de pompare azi', P.invoiceKwh, 'KWH_PER_YEAR', { sourceRo: 'facturi energie 12 luni', dependsOn: [invoiceKwh] });
  const baseIntensity = R.calc('compute_baseline', 'baseline.kwh_per_m3', 'Energie specifică de pompare azi', P.invoiceKwh / wOld, 'KWH_PER_M3', { formula: 'kWh facturați / m³', dependsOn: [baseEnergy, baseWater] });
  const baseCo2 = R.calc('compute_baseline', 'baseline.co2', 'CO₂ din pomparea de azi', (P.invoiceKwh * P.gridFactor) / 1000, 'T_CO2_PER_YEAR', { formula: 'kWh × factor rețea', dependsOn: [baseEnergy, gridFactor] });
  R.tool(A1, 'compute_baseline', 2, { moduleId: 'irigatii', parcelIds: ['ct_0412_01', 'ct_0412_02', 'ct_0412_03', 'ct_0415_01', 'ct_0415_02'], currentSystem: 'ASPERSIE_VECHE', energyDocumentId: 'doc_facturi_energie' }, '🔧 Calculez situația actuală (aspersie veche)', '🔧 Azi: 233.846 m³ apă și 105.230 kWh pe an', () => [area, baseWater, baseEnergy, baseIntensity, baseCo2], { dataSource: 'MIXED' });

  // --- initial configuration ---
  const wSpr = need / P.effSprinkler;
  const eSpr = wSpr * P.kwhM3Pressurized;
  const cfgInitCost = R.calc('compute_indicator', 'cfg_initial.total_cost', 'Cost configurație inițială', P.offer, 'EUR', { dependsOn: [offerTotal] });
  const cfgInitWater = R.calc('compute_indicator', 'cfg_initial.water', 'Apă folosită cu aspersia nouă', wSpr, 'M3_PER_YEAR', { formula: 'ha × necesar net / eficiență', dependsOn: [area, needNet, offerEff] });
  const cfgInitPct = R.calc('compute_indicator', 'cfg_initial.water_saving_pct', 'Economie de apă: aspersie clasică', (1 - wSpr / wOld) * 100, 'PCT', { formula: '1 − apă nouă / apă veche', dependsOn: [cfgInitWater, baseWater] });
  const cfgInitSaved = R.calc('compute_indicator', 'cfg_initial.water_saved', 'Apă economisită: aspersie clasică', wOld - wSpr, 'M3_PER_YEAR', { dependsOn: [baseWater, cfgInitWater] });
  const cfgInitKwhSaved = R.calc('compute_indicator', 'cfg_initial.energy_saved', 'Energie de pompare economisită: aspersie clasică', P.invoiceKwh - eSpr, 'KWH_PER_YEAR', { formula: 'kWh azi − m³ noi × 0,45 kWh/m³', dependsOn: [baseEnergy, cfgInitWater] });
  const cfgInitCo2 = R.calc('compute_indicator', 'cfg_initial.co2_avoided', 'CO₂ evitat: aspersie clasică', ((P.invoiceKwh - eSpr) * P.gridFactor) / 1000, 'T_CO2_PER_YEAR', { dependsOn: [cfgInitKwhSaved, gridFactor] });
  R.tool(A1, 'compute_indicator', 3, { configId: 'cfg_initial', documentId: 'doc_oferta_aspersie' }, '🔧 verific pragul pentru oferta inițială', '🔧 Aspersia clasică economisește 15,0% apă. NU TRECE (prag 25%)', () => [cfgInitCost, cfgInitWater, cfgInitPct, cfgInitSaved, cfgInitKwhSaved, cfgInitCo2], { thresholdResult: 'FAIL' });

  R.thought(A1, 'Aspersia clasică ajunge la 15,0% economie de apă, sub pragul de 25%. Nu resping dosarul: caut în catalog cea mai ieftină combinație care trece pragul pe aceleași 40 ha.', 3);

  // --- search upgrades ---
  const wSprSens = (need * (1 - P.sensorSaving)) / P.effSprinkler;
  const candSprSensPct = R.calc('search_upgrades', 'cand.sprinkler_sensors.pct', 'Variantă: aspersie + senzori', (1 - wSprSens / wOld) * 100, 'PCT');
  const candSprSensCost = R.calc('search_upgrades', 'cand.sprinkler_sensors.cost', 'Cost variantă aspersie + senzori + contor', P.offer + P.sensors + P.meter, 'EUR');
  const wDrip = (need * (1 - P.sensorSaving)) / P.effDrip;
  const candDripPct = R.calc('search_upgrades', 'cand.drip_sensors.pct', 'Variantă: picurare + senzori', (1 - wDrip / wOld) * 100, 'PCT');
  const candDripCost = R.calc('search_upgrades', 'cand.drip_sensors.cost', 'Cost variantă picurare + senzori + contor (pompa din ofertă)', P.drip + P.sensors + P.meter + P.offerPump, 'EUR');
  R.tool(A1, 'search_upgrades', 4, { moduleId: 'irigatii', baseConfigId: 'cfg_initial', targetIndicator: 'WATER_SAVING_PCT', sortBy: 'COST_ASC' }, '🔧 Caut upgrade-uri în catalogul de irigații', '🔧 2 variante: aspersie + senzori (21,8%, nu trece) și picurare + senzori (32,0%, trece)', () => [candSprSensPct, candSprSensCost, candDripPct, candDripCost], {
    candidates: [
      { packageId: 'pkg_sprinkler_sensors', catalogIds: ['irg.sensors.soil_moisture', 'irg.meter.electromagnetic'], thresholdResult: 'FAIL' },
      { packageId: 'pkg_drip_sensors', catalogIds: ['irg.drip.surface_veg', 'irg.sensors.soil_moisture', 'irg.meter.electromagnetic'], thresholdResult: 'PASS' },
    ],
  });

  // --- minimal passing package (alternative) ---
  const eDrip = wDrip * P.kwhM3Drip;
  const altCost = R.calc('simulate_upgrade_package', 'cfg_min_pass.total_cost', 'Cost: picurare + senzori + contor, pompa din ofertă', P.drip + P.sensors + P.meter + P.offerPump, 'EUR');
  const altUpgrade = R.calc('simulate_upgrade_package', 'cfg_min_pass.upgrade_cost', 'Cost suplimentar față de ofertă', P.drip + P.sensors + P.meter + P.offerPump - P.offer, 'EUR', { dependsOn: [altCost, cfgInitCost] });
  const recWater = R.calc('simulate_upgrade_package', 'cfg_recommended.water', 'Apă folosită cu picurare + senzori', wDrip, 'M3_PER_YEAR', { formula: 'ha × necesar net × (1 − senzori) / eficiență picurare', dependsOn: [area, needNet, sensorEff, effDrip] });
  const recPct = R.calc('simulate_upgrade_package', 'cfg_recommended.water_saving_pct', 'Economie de apă: picurare + senzori', (1 - wDrip / wOld) * 100, 'PCT', { formula: '1 − apă nouă / apă veche', dependsOn: [recWater, baseWater] });
  const recSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.water_saved', 'Apă economisită: picurare + senzori', wOld - wDrip, 'M3_PER_YEAR', { dependsOn: [baseWater, recWater] });
  const altKwhSaved = R.calc('simulate_upgrade_package', 'cfg_min_pass.energy_saved', 'Energie economisită: picurare cu pompa din ofertă', P.invoiceKwh - eDrip, 'KWH_PER_YEAR', { formula: 'kWh azi − m³ noi × 0,25 kWh/m³' });
  const altCo2 = R.calc('simulate_upgrade_package', 'cfg_min_pass.co2_avoided', 'CO₂ evitat: picurare cu pompa din ofertă', ((P.invoiceKwh - eDrip) * P.gridFactor) / 1000, 'T_CO2_PER_YEAR');
  R.tool(A1, 'simulate_upgrade_package', 4, { baseConfigId: 'cfg_initial', configId: 'cfg_min_pass', replace: { cmp_offer_sprinkler_system: 'irg.drip.surface_veg' }, add: ['irg.sensors.soil_moisture', 'irg.meter.electromagnetic'] }, '🔧 Simulez picurare + senzori de umiditate', '🔧 Picurare + senzori: 32,0% economie de apă. TRECE (prag 25%)', () => [altCost, altUpgrade, recWater, recPct, recSaved, altKwhSaved, altCo2], { configId: 'cfg_min_pass', thresholdResult: 'PASS' });

  R.thought(A1, 'Picurarea trece pragul. Picurarea lucrează la presiune mică, deci o pompă solară de 25 kWp acoperă aproape tot consumul de pompare. Verific dacă pompa solară se amortizează repede; dacă da, o recomand peste minimul necesar.', 5);

  // --- recommended: + solar pump ---
  const pv = Math.min(P.pvKwp * P.pvYield, eDrip);
  const gridLeft = eDrip - pv;
  const recCostTotal = P.drip + P.sensors + P.meter + P.solarPump;
  const pvYield = R.calc('simulate_upgrade_package', 'rules.pv_yield', 'Producție PV specifică, sud-est', P.pvYield, 'KWH_PER_KWP', { sourceRo: 'PVGIS 5.3 (Constanța), config/factors.json' });
  const recCost = R.calc('simulate_upgrade_package', 'cfg_recommended.total_cost', 'Cost configurație recomandată', recCostTotal, 'EUR');
  const recUpgrade = R.calc('simulate_upgrade_package', 'cfg_recommended.upgrade_cost', 'Cost suplimentar față de ofertă', recCostTotal - P.offer, 'EUR', { dependsOn: [recCost, cfgInitCost] });
  const cDrip = R.calc('simulate_upgrade_package', 'cmp.drip.cost', 'Picurare cu conducte și montaj, 40 ha', P.drip, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.drip.surface_veg' });
  const cSens = R.calc('simulate_upgrade_package', 'cmp.sensors.cost', 'Senzori de umiditate a solului (10 stații)', P.sensors, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.sensors.soil_moisture' });
  const cMeter = R.calc('simulate_upgrade_package', 'cmp.meter.cost', 'Contor electromagnetic de apă', P.meter, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.meter.electromagnetic' });
  const cSolar = R.calc('simulate_upgrade_package', 'cmp.solar_pump.cost', 'Pompă solară 25 kWp cu invertor', P.solarPump, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.pump.solar_25kwp' });
  const recPumpKwh = R.calc('simulate_upgrade_package', 'cfg_recommended.pumping_energy', 'Energie de pompare cu picurare', eDrip, 'KWH_PER_YEAR', { formula: 'm³ × 0,25 kWh/m³', dependsOn: [recWater] });
  const recPv = R.calc('simulate_upgrade_package', 'cfg_recommended.pv_kwh', 'Energie solară folosită la pompare', pv, 'KWH_PER_YEAR', { formula: 'min(kWp × kWh/kWp, consum pompare)', dependsOn: [pvYield, recPumpKwh] });
  const recGrid = R.calc('simulate_upgrade_package', 'cfg_recommended.grid_kwh', 'Energie din rețea rămasă', gridLeft, 'KWH_PER_YEAR', { dependsOn: [recPumpKwh, recPv] });
  const recGridSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.grid_replaced', 'Energie din rețea economisită', P.invoiceKwh - gridLeft, 'KWH_PER_YEAR', { dependsOn: [baseEnergy, recGrid] });
  const recCo2 = R.calc('simulate_upgrade_package', 'cfg_recommended.co2_avoided', 'CO₂ evitat: configurația recomandată', ((P.invoiceKwh - gridLeft) * P.gridFactor) / 1000, 'T_CO2_PER_YEAR', { formula: 'kWh economisiți × factor rețea', dependsOn: [recGridSaved, gridFactor] });
  const solarIncrement = (eDrip - gridLeft) * P.elecPrice;
  const solarPayback = R.calc('simulate_upgrade_package', 'cfg_recommended.solar_payback', 'Amortizare pompă solară față de pompa din ofertă', (P.solarPump - P.offerPump) / (solarIncrement / 12), 'MONTHS', { decimals: 1, formula: '(cost pompă solară − cost pompă ofertă) / economie lunară la energie', dependsOn: [cSolar, offerPumpCost, recPv, elecPrice] });
  R.tool(A1, 'simulate_upgrade_package', 5, { baseConfigId: 'cfg_min_pass', configId: 'cfg_recommended', replace: { cmp_offer_pump: 'irg.pump.solar_25kwp' } }, '🔧 Simulez picurare + senzori + pompă solară', '🔧 Pompa solară acoperă 80% din pompare și se amortizează în 22,5 luni', () => [pvYield, recCost, recUpgrade, cDrip, cSens, cMeter, cSolar, recPumpKwh, recPv, recGrid, recGridSaved, recCo2, solarPayback], { configId: 'cfg_recommended', thresholdResult: 'PASS' });

  // --- DNSH inputs ---
  R.tool(A1, 'check_dnsh_inputs', 6, { moduleId: 'irigatii', configId: 'cfg_recommended', parcelIds: ['ct_0412_01', 'ct_0412_02', 'ct_0412_03', 'ct_0415_01', 'ct_0415_02'] }, '🔧 Verific datele pentru DNSH (apă, nitrați, Natura 2000)', '🔧 Aviz ANAR valabil; 2 parcele în zonă vulnerabilă la nitrați; nicio parcelă în Natura 2000', null, {
    permitValid: true, waterMeterInOffer: false, natura2000Parcels: [], nitrateVulnerableParcels: ['ct_0415_01', 'ct_0415_02'], droughtRisk: 'HIGH',
  });

  const assessment = {
    moduleId: 'irigatii',
    indicator: 'WATER_SAVING_PCT',
    threshold: { thresholdCalcId: threshold.calcId, sourceRo: 'config/modules/irigatii.json: economie de apă ≥ 25% (propunere GreenStruct, de confirmat cu Raiffeisen)' },
    baseline: {
      descriptionRo: 'Aspersie veche cu tambur și conducte uzate pe 40 ha de legume. Apa e estimată din necesarul net și eficiența sistemului; energia vine din facturile pe 12 luni.',
      dataSource: 'MIXED',
      metrics: [
        { metric: 'AREA_HA', calcId: area.calcId },
        { metric: 'WATER_USE_M3', calcId: baseWater.calcId },
        { metric: 'PUMPING_ENERGY_KWH', calcId: baseEnergy.calcId },
        { metric: 'CO2_EMITTED_T', calcId: baseCo2.calcId },
      ],
    },
    configurations: [
      {
        configId: 'cfg_initial', role: 'INITIAL', titleRo: 'Aspersie clasică (oferta AquaFlux)',
        components: [
          { componentId: 'cmp_offer_sprinkler_system', category: 'IRRIGATION_SPRINKLER', nameRo: '2 instalații cu tambur, conducte și montaj', source: 'OFFER', costCalcId: offerSprinklerCost.calcId },
          { componentId: 'cmp_offer_pump', category: 'PUMP', nameRo: 'Electropompă 55 kW', source: 'OFFER', costCalcId: offerPumpCost.calcId },
        ],
        totalCostCalcId: cfgInitCost.calcId,
        indicatorCalcId: cfgInitPct.calcId,
        thresholdResult: 'FAIL',
        impacts: [
          { metric: 'WATER_SAVING_PCT', calcId: cfgInitPct.calcId },
          { metric: 'WATER_SAVED_M3', calcId: cfgInitSaved.calcId },
          { metric: 'ENERGY_SAVED_KWH', calcId: cfgInitKwhSaved.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: cfgInitCo2.calcId },
        ],
        noteRo: 'Oferta nu include contor de apă.',
      },
      {
        configId: 'cfg_min_pass', role: 'ALTERNATIVE', titleRo: 'Picurare + senzori + contor (pompa din ofertă)',
        components: [
          { componentId: 'cmp_drip_system', category: 'IRRIGATION_DRIP', nameRo: 'Picurare cu conducte și montaj, 40 ha', source: 'CATALOG_REPLACEMENT', catalogId: 'irg.drip.surface_veg', replacesComponentId: 'cmp_offer_sprinkler_system', costCalcId: cDrip.calcId },
          { componentId: 'cmp_soil_sensors', category: 'SOIL_MOISTURE_SENSORS', nameRo: 'Senzori de umiditate a solului (10 stații)', source: 'CATALOG_UPGRADE', catalogId: 'irg.sensors.soil_moisture', costCalcId: cSens.calcId },
          { componentId: 'cmp_water_meter', category: 'WATER_METER', nameRo: 'Contor electromagnetic de apă', source: 'CATALOG_UPGRADE', catalogId: 'irg.meter.electromagnetic', costCalcId: cMeter.calcId },
          { componentId: 'cmp_offer_pump', category: 'PUMP', nameRo: 'Electropompă 55 kW', source: 'OFFER', costCalcId: offerPumpCost.calcId },
        ],
        totalCostCalcId: altCost.calcId,
        upgradeCostCalcId: altUpgrade.calcId,
        indicatorCalcId: recPct.calcId,
        thresholdResult: 'PASS',
        impacts: [
          { metric: 'WATER_SAVING_PCT', calcId: recPct.calcId },
          { metric: 'WATER_SAVED_M3', calcId: recSaved.calcId },
          { metric: 'ENERGY_SAVED_KWH', calcId: altKwhSaved.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: altCo2.calcId },
        ],
        noteRo: 'Cea mai ieftină variantă care trece pragul.',
      },
      {
        configId: 'cfg_recommended', role: 'RECOMMENDED', titleRo: 'Picurare + senzori + contor + pompă solară',
        components: [
          { componentId: 'cmp_drip_system', category: 'IRRIGATION_DRIP', nameRo: 'Picurare cu conducte și montaj, 40 ha', source: 'CATALOG_REPLACEMENT', catalogId: 'irg.drip.surface_veg', replacesComponentId: 'cmp_offer_sprinkler_system', costCalcId: cDrip.calcId },
          { componentId: 'cmp_soil_sensors', category: 'SOIL_MOISTURE_SENSORS', nameRo: 'Senzori de umiditate a solului (10 stații)', source: 'CATALOG_UPGRADE', catalogId: 'irg.sensors.soil_moisture', costCalcId: cSens.calcId },
          { componentId: 'cmp_water_meter', category: 'WATER_METER', nameRo: 'Contor electromagnetic de apă', source: 'CATALOG_UPGRADE', catalogId: 'irg.meter.electromagnetic', costCalcId: cMeter.calcId },
          { componentId: 'cmp_solar_pump', category: 'SOLAR_PUMP', nameRo: 'Pompă solară 25 kWp cu invertor', source: 'CATALOG_REPLACEMENT', catalogId: 'irg.pump.solar_25kwp', replacesComponentId: 'cmp_offer_pump', costCalcId: cSolar.calcId },
        ],
        totalCostCalcId: recCost.calcId,
        upgradeCostCalcId: recUpgrade.calcId,
        indicatorCalcId: recPct.calcId,
        thresholdResult: 'PASS',
        impacts: [
          { metric: 'WATER_SAVING_PCT', calcId: recPct.calcId },
          { metric: 'WATER_SAVED_M3', calcId: recSaved.calcId },
          { metric: 'GRID_ENERGY_REPLACED_KWH', calcId: recGridSaved.calcId },
          { metric: 'RENEWABLE_KWH', calcId: recPv.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: recCo2.calcId },
        ],
        noteRo: 'Pompa solară e peste minimul necesar, dar se amortizează în mai puțin de 2 ani din energie.',
      },
    ],
    initialConfigId: 'cfg_initial',
    recommendedConfigId: 'cfg_recommended',
    recommendationType: 'UPGRADE_TO_PASS',
    dnshChecks: [
      { objective: 'WATER_MARINE_RESOURCES', status: 'PASS_WITH_CONDITIONS', evidence: ['WATER_PERMIT_ANAR'], noteRo: 'Aviz ANAR valabil până în 2028, volum autorizat peste consumul estimat. Lipsește contorul din ofertă; e inclus în configurația recomandată.' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS_WITH_CONDITIONS', evidence: [], noteRo: 'Parcelele ct_0415_01 și ct_0415_02 sunt în zonă vulnerabilă la nitrați: e nevoie de plan de fertirigare.' },
      { objective: 'BIODIVERSITY', status: 'PASS', evidence: [], noteRo: 'Nicio parcelă în Natura 2000.' },
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', evidence: [], noteRo: 'Risc de secetă ridicat; picurarea cu senzori crește reziliența.' },
    ],
    sizingCheck: { status: 'NOT_APPLICABLE', noteRo: 'Verificarea putere/suprafață se aplică doar la utilaje.' },
    missingFields: [
      { fieldKey: 'water_meter', labelRo: 'Contor de apă în configurația finală', requiredFor: 'DNSH', docType: 'WATER_METER_CERTIFICATE', blocking: false },
      { fieldKey: 'fertigation_plan', labelRo: 'Plan de fertirigare pentru parcelele din zona vulnerabilă la nitrați', requiredFor: 'DNSH', docType: 'OTHER', blocking: false },
    ],
    summaryRo: 'Oferta de aspersie clasică (85.000 EUR) economisește 15,0% apă, sub pragul de 25%. Recomand picurare + senzori de umiditate + contor + pompă solară 25 kWp: 32,0% economie de apă, 97.503 kWh/an din rețea înlocuiți, 22,4 t CO₂/an evitate. Varianta minimă fără pompa solară trece și ea pragul, dar pompa solară se amortizează în 22,5 luni.',
    farmerMessageRo: 'Sistemul ales economisește 15% apă, iar pentru creditul verde e nevoie de 25%. Am găsit o soluție: picurare + senzori de umiditate + pompă solară. Economisești 32% apă și aproape toată energia de pompare.',
  };
  R.completed(A1, 'submit_technical_assessment', '✅ Agentul 1 a terminat: sub prag → upgrade → 32,0%, peste prag', assessment, 6, 31800);

  // =================== AGENT 2 ===================
  R.state('AGENT_1', 'AGENT_2', 'Pornește optimizatorul de finanțare', {}, 300);
  R.started(A2, 'AGENT_2', 'Agentul 2 (finanțare) a pornit');

  const rStd = R.calc('list_financing_lines', 'line.standard.rate', 'Dobândă credit standard', P.rateStd, 'PCT', { sourceRo: 'config/financing-lines.json: STANDARD_INVEST (demo)' });
  const rGreen = R.calc('list_financing_lines', 'line.green.rate', 'Dobândă credit verde cu garanție InvestEU', P.rateGreen, 'PCT', { sourceRo: 'config/financing-lines.json: GREEN_AGRI (demo, de confirmat)' });
  const term = R.calc('list_financing_lines', 'line.term', 'Durată credit', P.term, 'MONTHS', { sourceRo: 'config/financing-lines.json' });
  const feiCov = R.calc('list_financing_lines', 'line.investeu.coverage', 'Acoperire garanție InvestEU (FEI)', P.feiCoverage, 'PCT', { sourceRo: 'config/financing-lines.json: FEI_INVESTEU (de confirmat)' });
  const mortInit = R.calc('list_financing_lines', 'line.mortgage.initial', 'Costuri inițiale ipotecă (evaluare + notar)', P.mortgageInitial, 'EUR', { sourceRo: 'config/financing-lines.json (demo)' });
  const mortAnnual = R.calc('list_financing_lines', 'line.mortgage.annual', 'Asigurare anuală imobil ipotecat', P.mortgageAnnual, 'EUR_PER_YEAR', { sourceRo: 'config/financing-lines.json (demo)' });
  const horizon = R.calc('list_financing_lines', 'line.horizon', 'Orizont de comparație', P.horizonYears, 'YEARS', { sourceRo: 'config/modules/irigatii.json' });
  const affLimit = R.calc('list_financing_lines', 'line.affordability_limit', 'Limită serviciu datorie / cashflow net', P.affordLimit, 'PCT', { sourceRo: 'config/financing-lines.json (demo)' });
  R.tool(A2, 'list_financing_lines', 1, { moduleId: 'irigatii', farmSize: 'SME' }, '🔧 Citesc liniile de finanțare Raiffeisen', '🔧 Standard 8,9%; verde cu InvestEU 6,4%; garanție FEI 70%', () => [rStd, rGreen, term, feiCov, mortInit, mortAnnual, horizon, affLimit], { lines: ['STANDARD_INVEST', 'GREEN_AGRI'] });

  R.tool(A2, 'check_program_eligibility', 2, { cui: '45871203', moduleId: 'irigatii', configId: 'cfg_recommended', programs: ['DR_26', 'DR_16', 'DR_12', 'FM_PV', 'INVESTEU_FEI'] }, '🔧 Verific granturile AFIR și garanțiile disponibile', '🔧 Nicio sesiune AFIR deschisă pentru irigații; garanția InvestEU e disponibilă', null, {
    programs: [
      { programCode: 'DR_26', result: 'ELIGIBLE', session: 'NOT_OPEN' },
      { programCode: 'DR_16', result: 'ELIGIBLE', session: 'NOT_OPEN' },
      { programCode: 'DR_12', result: 'NOT_ELIGIBLE', session: 'OPEN' },
      { programCode: 'FM_PV', result: 'ELIGIBLE', session: 'CLOSED' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT' },
    ],
  });

  R.thought(A2, 'Pentru irigații nu există azi o sesiune AFIR deschisă: DR-26 și DR-16 au ghid, dar nicio sesiune în 2026, iar DR-12 nu se aplică (administrator de 52 de ani). Construiesc pachetul verde fără grant: credit verde cu garanție InvestEU și rate după recoltă (iulie–octombrie, din Open Banking).', 3);

  const stackGreenAmt = R.calc('build_funding_stack', 'option_b.green_loan.amount', 'Credit verde', recCostTotal, 'EUR', { dependsOn: [recCost] });
  const stackGuarAmt = R.calc('build_funding_stack', 'option_b.guarantee.amount', 'Sumă acoperită de garanția InvestEU', (recCostTotal * P.feiCoverage) / 100, 'EUR', { formula: 'credit × acoperire', dependsOn: [stackGreenAmt, feiCov] });
  const stackStdAmt = R.calc('build_funding_stack', 'option_a.loan.amount', 'Credit standard', P.offer, 'EUR', { dependsOn: [cfgInitCost] });
  R.tool(A2, 'build_funding_stack', 3, { options: [{ optionId: 'A', configId: 'cfg_initial', products: ['STANDARD_INVEST'] }, { optionId: 'B', configId: 'cfg_recommended', products: ['GREEN_AGRI', 'FEI_INVESTEU'] }] }, '🔧 Construiesc structura de finanțare A și B', '🔧 A: credit standard 85.000 EUR cu ipotecă. B: credit verde 125.000 EUR cu garanție FEI 70%', () => [stackStdAmt, stackGreenAmt, stackGuarAmt], { optionA: ['STANDARD_LOAN'], optionB: ['GREEN_LOAN', 'GUARANTEE'] });

  // scenario A
  const schA = schedule(P.offer, P.rateStd, P.term, 2027, 1);
  const aSav = (wOld - wSpr) * P.waterPrice + (P.invoiceKwh - eSpr) * P.elecPrice;
  const aCollateral = P.mortgageInitial + P.mortgageAnnual * P.horizonYears;
  const aInst = R.calc('build_scenario', 'option_a.installment', 'Rată lunară A', schA.installment, 'EUR_PER_MONTH', { decimals: 0, formula: 'PMT = P · r / (1 − (1 + r)^−n)', dependsOn: [stackStdAmt, rStd, term] });
  const aSched = R.calc('build_scenario', 'option_a.schedule', 'Grafic rambursare A (total plăți)', schA.totalPayments, 'EUR', { series: schA.series, dependsOn: [aInst] });
  const aTotal = R.calc('build_scenario', 'option_a.total_payments', 'Total plăți A', schA.totalPayments, 'EUR', { dependsOn: [aInst, term] });
  const aInterest = R.calc('build_scenario', 'option_a.total_interest', 'Dobânzi totale A', schA.totalInterest, 'EUR', { dependsOn: [aTotal, stackStdAmt] });
  const aColl = R.calc('build_scenario', 'option_a.collateral_costs', 'Costuri ipotecă A pe 5 ani', aCollateral, 'EUR', { formula: 'cost inițial + cost anual × ani', dependsOn: [mortInit, mortAnnual, horizon] });
  const aWaterEur = R.calc('build_scenario', 'option_a.savings.water_eur', 'Economie la apă A', (wOld - wSpr) * P.waterPrice, 'EUR_PER_YEAR', { dependsOn: [cfgInitSaved, waterPrice] });
  const aEnergyEur = R.calc('build_scenario', 'option_a.savings.energy_eur', 'Economie la energie A', (P.invoiceKwh - eSpr) * P.elecPrice, 'EUR_PER_YEAR', { dependsOn: [cfgInitKwhSaved, elecPrice] });
  const aSavH = R.calc('build_scenario', 'option_a.savings_horizon', 'Economii A pe 5 ani', aSav * P.horizonYears, 'EUR', { dependsOn: [aWaterEur, aEnergyEur, horizon] });
  const aNet = R.calc('build_scenario', 'option_a.net_cost', 'Cost net A pe 5 ani', schA.totalPayments + aCollateral - aSav * P.horizonYears, 'EUR', { formula: 'plăți + costuri garanții − grant − economii', dependsOn: [aTotal, aColl, aSavH] });
  R.tool(A2, 'build_scenario', 4, { optionId: 'A', configId: 'cfg_initial', scheduleType: 'EQUAL_MONTHLY' }, '🔧 calculeaza_credit(A: standard, rate lunare egale)', '🔧 A: 1.760 EUR/lună, 60 de luni, plus 3.350 EUR costuri de ipotecă', () => [aInst, aSched, aTotal, aInterest, aColl, aWaterEur, aEnergyEur, aSavH, aNet], { optionId: 'A' });

  // scenario B (seasonal)
  const months = ['JUL', 'AUG', 'SEP', 'OCT'];
  const schB = schedule(recCostTotal, P.rateGreen, P.term, 2027, 1, months);
  const bSav = (wOld - wDrip) * P.waterPrice + (P.invoiceKwh - gridLeft) * P.elecPrice;
  const bInst = R.calc('build_scenario', 'option_b.installment', 'Rată sezonieră B (iulie–octombrie)', schB.installment, 'EUR', { decimals: 0, formula: 'rate egale doar în lunile cu încasări; VA la dobânda creditului = principalul', dependsOn: [stackGreenAmt, rGreen, term] });
  const bGrace = R.calc('build_scenario', 'option_b.grace', 'Perioadă fără plăți până la prima recoltă', 5, 'MONTHS');
  const bSched = R.calc('build_scenario', 'option_b.schedule', 'Grafic rambursare B (total plăți)', schB.totalPayments, 'EUR', { series: schB.series, dependsOn: [bInst] });
  const bTotal = R.calc('build_scenario', 'option_b.total_payments', 'Total plăți B', schB.totalPayments, 'EUR', { dependsOn: [bInst] });
  const bInterest = R.calc('build_scenario', 'option_b.total_interest', 'Dobânzi totale B', schB.totalInterest, 'EUR', { dependsOn: [bTotal, stackGreenAmt] });
  const bColl = R.calc('build_scenario', 'option_b.collateral_costs', 'Costuri ipotecă B', 0, 'EUR', { sourceRo: 'garanție FEI, fără ipotecă' });
  const bWaterEur = R.calc('build_scenario', 'option_b.savings.water_eur', 'Economie la apă B', (wOld - wDrip) * P.waterPrice, 'EUR_PER_YEAR', { dependsOn: [recSaved, waterPrice] });
  const bEnergyEur = R.calc('build_scenario', 'option_b.savings.energy_eur', 'Economie la energie B', (P.invoiceKwh - gridLeft) * P.elecPrice, 'EUR_PER_YEAR', { dependsOn: [recGridSaved, elecPrice] });
  const bSavH = R.calc('build_scenario', 'option_b.savings_horizon', 'Economii B pe 5 ani', bSav * P.horizonYears, 'EUR', { dependsOn: [bWaterEur, bEnergyEur, horizon] });
  const bNet = R.calc('build_scenario', 'option_b.net_cost', 'Cost net B pe 5 ani', schB.totalPayments - bSav * P.horizonYears, 'EUR', { formula: 'plăți + costuri garanții − grant − economii', dependsOn: [bTotal, bColl, bSavH] });
  R.tool(A2, 'build_scenario', 4, { optionId: 'B', configId: 'cfg_recommended', scheduleType: 'SEASONAL', paymentMonths: months }, '🔧 calculeaza_credit(B: verde, rate după recoltă)', `🔧 B: ${bInst.display} în iulie, august, septembrie și octombrie; fără ipotecă`, () => [bInst, bGrace, bSched, bTotal, bInterest, bColl, bWaterEur, bEnergyEur, bSavH, bNet], { optionId: 'B' });

  const adv = aNet.value - bNet.value;
  const cmpAdv = R.calc('compare_scenarios', 'compare.net_advantage', 'Avantaj net B față de A pe 5 ani', adv, 'EUR', { formula: '(economii B − plăți B − costuri B) − (economii A − plăți A − costuri A)', dependsOn: [aNet, bNet] });
  const dInv = R.calc('compare_scenarios', 'compare.driver.investment', 'Investiție mai mare', -(recCostTotal - P.offer), 'EUR');
  const dInt = R.calc('compare_scenarios', 'compare.driver.interest', 'Diferență de dobânzi', schA.totalInterest - schB.totalInterest, 'EUR', { dependsOn: [aInterest, bInterest] });
  const dColl = R.calc('compare_scenarios', 'compare.driver.collateral', 'Fără costuri de ipotecă', aCollateral, 'EUR', { dependsOn: [aColl, bColl] });
  const dSav = R.calc('compare_scenarios', 'compare.driver.savings', 'Economii suplimentare (apă + energie)', (bSav - aSav) * P.horizonYears, 'EUR', { dependsOn: [aSavH, bSavH] });
  const payback = R.calc('compare_scenarios', 'compare.upgrade_payback', 'Amortizarea upgrade-ului', (recCostTotal - P.offer) / ((bSav - aSav) / 12), 'MONTHS', { decimals: 1, formula: 'cost upgrade / economie lunară suplimentară', dependsOn: [recUpgrade, aSavH, bSavH] });
  R.tool(A2, 'compare_scenarios', 5, { optionIds: ['A', 'B'], horizon: 'FROM_CONFIG' }, '🔧 Compar A și B pe 5 ani', `🔧 B e mai avantajos cu ${cmpAdv.display} pe 5 ani; upgrade-ul se amortizează în ${payback.display}`, () => [cmpAdv, dInv, dInt, dColl, dSav, payback], { better: 'B' });

  const aRatio = R.calc('check_affordability', 'option_a.affordability_ratio', 'Serviciu anual datorie / cashflow net anual, A', ((schA.installment * 12) / P.annualNetCf) * 100, 'PCT', { formula: 'rate pe 12 luni / cashflow net din Open Banking', dependsOn: [aInst] });
  const bRatio = R.calc('check_affordability', 'option_b.affordability_ratio', 'Serviciu anual datorie / cashflow net anual, B', ((schB.installment * 4) / P.annualNetCf) * 100, 'PCT', { formula: 'rate sezoniere pe an / cashflow net din Open Banking', dependsOn: [bInst] });
  R.tool(A2, 'check_affordability', 6, { optionIds: ['A', 'B'], cashflowSource: 'OPEN_BANKING' }, '🔧 Verific dacă rata încape în cashflow', '🔧 Ambele încap. A cade și în lunile februarie–aprilie, când cashflow-ul e negativ', () => [aRatio, bRatio], { A: 'PASS_WITH_WARNING', B: 'PASS' });

  const funding = {
    options: [
      {
        optionId: 'A', kind: 'STANDARD', configId: 'cfg_initial', titleRo: 'Credit standard pentru aspersie clasică',
        investmentCalcId: cfgInitCost.calcId,
        fundingStack: [
          { itemId: 'fs_a_loan', type: 'STANDARD_LOAN', productId: 'STANDARD_INVEST', amountCalcId: stackStdAmt.calcId, rateCalcId: rStd.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'EQUAL_MONTHLY', installmentCalcId: aInst.calcId, scheduleCalcId: aSched.calcId }, status: 'AVAILABLE', noteRo: 'Garantat cu ipotecă pe teren.' },
        ],
        headlineInstallmentCalcId: aInst.calcId,
        collateral: ['MORTGAGE'],
        totals: { totalPaymentsCalcId: aTotal.calcId, totalInterestCalcId: aInterest.calcId, collateralCostsCalcId: aColl.calcId, savingsOverHorizonCalcId: aSavH.calcId, netCostCalcId: aNet.calcId },
        annualSavings: [{ metric: 'WATER_COST_SAVED_EUR', calcId: aWaterEur.calcId }, { metric: 'ENERGY_COST_SAVED_EUR', calcId: aEnergyEur.calcId }],
        affordability: { status: 'PASS_WITH_WARNING', ratioCalcId: aRatio.calcId, limitCalcId: affLimit.calcId, noteRo: 'Încape pe an, dar ratele din februarie–aprilie cad în luni cu cashflow negativ și se plătesc din rezervă.' },
        greenEligible: false,
      },
      {
        optionId: 'B', kind: 'GREEN_PACKAGE', configId: 'cfg_recommended', titleRo: 'Credit verde Raiffeisen cu garanție FEI și rate după recoltă',
        investmentCalcId: recCost.calcId,
        fundingStack: [
          { itemId: 'fs_b_green_loan', type: 'GREEN_LOAN', productId: 'GREEN_AGRI', amountCalcId: stackGreenAmt.calcId, rateCalcId: rGreen.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'SEASONAL', installmentCalcId: bInst.calcId, scheduleCalcId: bSched.calcId, graceCalcId: bGrace.calcId, paymentMonths: months }, status: 'TO_CONFIRM', noteRo: 'Dobânda și condițiile liniei verzi se confirmă cu Raiffeisen.' },
          { itemId: 'fs_b_guarantee', type: 'GUARANTEE', productId: 'FEI_INVESTEU', programCode: 'INVESTEU_FEI', amountCalcId: stackGuarAmt.calcId, coverageCalcId: feiCov.calcId, guaranteesItemId: 'fs_b_green_loan', status: 'TO_CONFIRM', noteRo: 'Garanție InvestEU prin FEI, fără ipotecă. Condițiile pentru 2026 se confirmă cu mentorii.' },
        ],
        headlineInstallmentCalcId: bInst.calcId,
        collateral: ['GUARANTEE_INVESTEU_FEI', 'PLEDGE_EQUIPMENT'],
        totals: { totalPaymentsCalcId: bTotal.calcId, totalInterestCalcId: bInterest.calcId, collateralCostsCalcId: bColl.calcId, savingsOverHorizonCalcId: bSavH.calcId, netCostCalcId: bNet.calcId },
        annualSavings: [{ metric: 'WATER_COST_SAVED_EUR', calcId: bWaterEur.calcId }, { metric: 'ENERGY_COST_SAVED_EUR', calcId: bEnergyEur.calcId }],
        affordability: { status: 'PASS', ratioCalcId: bRatio.calcId, limitCalcId: affLimit.calcId, noteRo: 'Ratele cad doar în lunile cu încasări mari (iulie–octombrie).' },
        greenEligible: true,
      },
    ],
    recommendedOptionId: 'B',
    recommendationBasis: { greenEligible: true, netAdvantagePositive: true, affordabilityPassed: true },
    programChecks: [
      { programCode: 'DR_26', result: 'ELIGIBLE', session: 'NOT_OPEN', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'WATER_METERING', result: 'PASS', noteRo: 'Contorul e inclus în configurația recomandată.' }, { criterion: 'MIN_WATER_SAVING', result: 'PASS', calcId: recPct.calcId }, { criterion: 'SESSION_OPEN', result: 'FAIL', noteRo: 'Ghid publicat, nicio sesiune în 2026.' }], noteRo: 'Proiectul s-ar potrivi, dar nu există sesiune deschisă.' },
      { programCode: 'DR_16', result: 'ELIGIBLE', session: 'NOT_OPEN', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'SECTOR_ELIGIBLE', result: 'PASS', noteRo: 'Legume.' }, { criterion: 'SESSION_OPEN', result: 'FAIL' }], noteRo: 'Ghid publicat, nicio sesiune în 2026.' },
      { programCode: 'DR_12', result: 'NOT_ELIGIBLE', session: 'OPEN', deadline: '2026-12-02T16:00:00+02:00', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/domenii-de-interventie/detalii-si-anexe-dr-12/', criteria: [{ criterion: 'MANAGER_AGE', result: 'FAIL', noteRo: 'Administratorul are 52 de ani; limita e 45.' }], noteRo: 'Deschis, dar ferma nu e eligibilă; irigațiile ar fi oricum doar componentă secundară.' },
      { programCode: 'FM_PV', result: 'ELIGIBLE', session: 'CLOSED', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'SESSION_OPEN', result: 'FAIL', noteRo: 'Sesiunea iunie–august 2026 s-a închis.' }], noteRo: 'Pompa solară s-ar fi putut finanța aici; urmărim următoarea sesiune.' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT', checkedAt: '2026-10-28', sourceUrl: 'https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth', criteria: [{ criterion: 'SME_STATUS', result: 'PASS' }, { criterion: 'NO_DOUBLE_FUNDING', result: 'PASS' }], noteRo: 'Raiffeisen e partener FEI din 2023; condițiile pentru 2026 se confirmă cu mentorii.' },
    ],
    grantOutlook: {
      status: 'NO_OPEN_SESSION', programCode: 'DR_26',
      messageRo: 'Acum nu există nicio sesiune AFIR deschisă pentru irigații. DR-26 are ghid publicat, dar nicio sesiune în 2026 (verificat pe afir.ro la 28.10.2026). Te anunțăm când se deschide. Atenție: dacă vrei să aplici la grant, nu începe cheltuielile înainte de depunerea cererii.',
      checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/',
    },
    comparison: {
      horizonCalcId: horizon.calcId,
      netAdvantageCalcId: cmpAdv.calcId,
      upgradePaybackCalcId: payback.calcId,
      drivers: [
        { driver: 'INVESTMENT_DELTA', calcId: dInv.calcId },
        { driver: 'INTEREST', calcId: dInt.calcId },
        { driver: 'COLLATERAL_COSTS', calcId: dColl.calcId },
        { driver: 'OPERATING_SAVINGS', calcId: dSav.calcId },
      ],
    },
    farmerExplanationRo: `Creditul verde e mai mare cu 40.000 EUR, dar plătești doar în lunile în care vinzi recolta (iulie–octombrie), fără ipotecă, și economisești ${bWaterEur.display} la apă și ${bEnergyEur.display} la energie. Câștigi ${cmpAdv.display} în 5 ani alegând creditul verde.`,
    officerNotesRo: 'Opțiunea B: credit verde 125.000 EUR, 60 de luni, rate sezoniere iul–oct, garanție InvestEU 70% (fără ipotecă). Nu există grant AFIR deschis pentru irigații; DR-12 neeligibil (vârsta administratorului). Dobânda verde și acoperirea FEI sunt valori demo, de confirmat. Rata A cade în lunile cu cashflow negativ.',
  };
  R.completed(A2, 'submit_funding_recommendation', `✅ Agentul 2 a terminat: recomand B, avantaj net ${cmpAdv.display} pe 5 ani`, funding, 6, 27400);

  // =================== AGENT 3 ===================
  R.state('AGENT_2', 'AGENT_3', 'Pornește underwriter-ul verde', {}, 300);
  R.started(A3, 'AGENT_3', 'Agentul 3 (underwriter verde) a pornit');
  R.tool(A3, 'get_labeling_rules', 1, { moduleId: 'irigatii', configId: 'cfg_recommended' }, '🔧 Citesc regulile de etichetare', '🔧 Picurare și senzori: verde de piață. Pompa solară: activitatea 4.1 din Taxonomie', null, {
    rules: [
      { componentId: 'cmp_drip_system', label: 'MARKET_GREEN' }, { componentId: 'cmp_soil_sensors', label: 'MARKET_GREEN' },
      { componentId: 'cmp_water_meter', label: 'MARKET_GREEN' }, { componentId: 'cmp_solar_pump', label: 'TAXONOMY_ALIGNED', taxonomyActivity: '4.1' },
    ],
  });
  R.tool(A3, 'get_dnsh_criteria', 1, { moduleId: 'irigatii', substantialContribution: 'WATER_MARINE_RESOURCES' }, '🔧 Citesc criteriile DNSH', '🔧 5 obiective de verificat: climă (atenuare, adaptare), circularitate, poluare, biodiversitate', null, {
    objectives: ['CLIMATE_MITIGATION', 'CLIMATE_ADAPTATION', 'CIRCULAR_ECONOMY', 'POLLUTION_PREVENTION', 'BIODIVERSITY'],
  });
  const greenAmt = R.calc('calculate_impact', 'label.green_amount', 'Sumă etichetată verde (Taxonomie + piață)', recCostTotal, 'EUR', { dependsOn: [cDrip, cSens, cMeter, cSolar] });
  const transAmt = R.calc('calculate_impact', 'label.transition_amount', 'Sumă etichetată tranziție', 0, 'EUR');
  const greenPct = R.calc('calculate_impact', 'label.green_share', 'Pondere verde în investiție', 100, 'PCT', { dependsOn: [greenAmt, recCost] });
  const waterH = R.calc('calculate_impact', 'impact.water_horizon', 'Apă economisită pe 5 ani', (wOld - wDrip) * P.horizonYears, 'M3', { dependsOn: [recSaved, horizon] });
  const co2H = R.calc('calculate_impact', 'impact.co2_horizon', 'CO₂ evitat pe 5 ani', (((P.invoiceKwh - gridLeft) * P.gridFactor) / 1000) * P.horizonYears, 'T_CO2', { dependsOn: [recCo2, horizon] });
  R.tool(A3, 'calculate_impact', 2, { configId: 'cfg_recommended', horizon: 'FROM_CONFIG' }, '🔧 Calculez impactul de mediu', `🔧 ${recSaved.display} apă, ${recGridSaved.display} din rețea, ${recCo2.display} evitate`, () => [greenAmt, transAmt, greenPct, waterH, co2H], {});

  const report = {
    decision: 'ELIGIBLE_WITH_CONDITIONS',
    moduleId: 'irigatii',
    recommendedOptionId: 'B',
    criterion: { indicator: 'WATER_SAVING_PCT', valueCalcId: recPct.calcId, thresholdCalcId: threshold.calcId, result: 'PASS', sourceRo: 'config/modules/irigatii.json: economie de apă ≥ 25% față de sistemul actual (propunere, de confirmat cu Raiffeisen); minimul AFIR la modernizare e 10%.' },
    componentLabels: [
      { componentId: 'cmp_drip_system', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cDrip.calcId, rationaleRo: 'Irigare prin picurare cu economie de apă măsurabilă peste prag.' },
      { componentId: 'cmp_soil_sensors', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cSens.calcId, rationaleRo: 'Reduc udarea inutilă; parte din pachetul care trece pragul.' },
      { componentId: 'cmp_water_meter', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cMeter.calcId, rationaleRo: 'Contorizarea face economia verificabilă; obligatorie pentru monitorizare.' },
      { componentId: 'cmp_solar_pump', label: 'TAXONOMY_ALIGNED', basis: 'EU_TAXONOMY_ACTIVITY', taxonomyActivity: '4.1', amountCalcId: cSolar.calcId, rationaleRo: 'Producție de energie solară fotovoltaică pentru consum propriu.' },
    ],
    greenShare: { greenAmountCalcId: greenAmt.calcId, transitionAmountCalcId: transAmt.calcId, greenSharePctCalcId: greenPct.calcId },
    greenBond: { category: 'AGRICULTURE_FORESTRY', status: 'TO_CONFIRM', eligibleAmountCalcId: greenAmt.calcId, noteRo: 'Categoria „Agriculture and forestry” exista în cadrul RBRO 2022; cadrul RBI 2025 nu o mai are. De confirmat cu echipa Green Bonds. Pompa solară se poate încadra separat la energie regenerabilă.' },
    substantialContribution: 'WATER_MARINE_RESOURCES',
    dnsh: [
      { objective: 'CLIMATE_MITIGATION', status: 'PASS', justificationRo: 'Pompa solară înlocuiește aproape tot consumul din rețea; emisiile scad față de situația actuală.', evidence: ['ENERGY_INVOICES', 'TECHNICAL_SHEET'] },
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', justificationRo: 'Parcelele au risc de secetă ridicat; picurarea cu senzori crește reziliența culturilor.', evidence: [] },
      { objective: 'CIRCULAR_ECONOMY', status: 'PASS_WITH_CONDITIONS', justificationRo: 'Tuburile de picurare se uzează: e nevoie de angajamentul furnizorului de a le prelua la reciclare.', evidence: [], conditionId: 'cp_drip_recycling' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS_WITH_CONDITIONS', justificationRo: 'Două parcele sunt în zonă vulnerabilă la nitrați. Fertirigarea trebuie să urmeze Codul de bune practici agricole.', evidence: [], conditionId: 'cp_fertigation_plan' },
      { objective: 'BIODIVERSITY', status: 'PASS', justificationRo: 'Nicio parcelă nu se suprapune cu situri Natura 2000.', evidence: [] },
    ],
    impact: [
      { metric: 'WATER_SAVED_M3', calcId: recSaved.calcId, period: 'ANNUAL' },
      { metric: 'WATER_SAVING_PCT', calcId: recPct.calcId, period: 'ANNUAL' },
      { metric: 'GRID_ENERGY_REPLACED_KWH', calcId: recGridSaved.calcId, period: 'ANNUAL' },
      { metric: 'RENEWABLE_KWH', calcId: recPv.calcId, period: 'ANNUAL' },
      { metric: 'CO2_AVOIDED_T', calcId: recCo2.calcId, period: 'ANNUAL' },
      { metric: 'WATER_SAVED_M3', calcId: waterH.calcId, period: 'HORIZON' },
      { metric: 'CO2_AVOIDED_T', calcId: co2H.calcId, period: 'HORIZON' },
    ],
    conditionsPrecedent: [
      { conditionId: 'cp_investeu_guarantee', type: 'GUARANTEE_APPROVAL', documentType: 'GUARANTEE_APPROVAL', descriptionRo: 'Includerea creditului în portofoliul garantat InvestEU (FEI).', timing: 'BEFORE_SIGNING', blocking: true },
      { conditionId: 'cp_fertigation_plan', type: 'DOCUMENT', documentType: 'OTHER', descriptionRo: 'Plan de fertirigare pentru parcelele ct_0415_01 și ct_0415_02 (zonă vulnerabilă la nitrați).', timing: 'BEFORE_FIRST_DISBURSEMENT', blocking: false },
      { conditionId: 'cp_final_invoice', type: 'INVOICE_MATCH', documentType: 'FINAL_INVOICE', descriptionRo: 'Factura finală corespunde configurației aprobate: picurare, senzori, contor, pompă solară 25 kWp.', timing: 'BEFORE_FINAL_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_drip_recycling', type: 'DOCUMENT', documentType: 'OTHER', descriptionRo: 'Angajamentul furnizorului de a prelua tuburile de picurare uzate la reciclare.', timing: 'BEFORE_FINAL_DISBURSEMENT', blocking: false },
      { conditionId: 'cp_commissioning', type: 'DOCUMENT', documentType: 'COMMISSIONING_REPORT', descriptionRo: 'Proces-verbal de punere în funcțiune și poze geolocalizate.', timing: 'AFTER_INSTALLATION', blocking: false },
      { conditionId: 'cp_water_meter', type: 'TECHNICAL_SPEC', documentType: 'WATER_METER_CERTIFICATE', descriptionRo: 'Certificatul metrologic al contorului de apă montat.', timing: 'AFTER_INSTALLATION', blocking: false },
    ],
    monitoringKpis: [
      { kpiId: 'kpi_water_use', metric: 'WATER_USE_M3', targetCalcId: recWater.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'WATER_METER', descriptionRo: 'Consumul real de apă, citit de pe contor, comparat cu estimarea.' },
      { kpiId: 'kpi_grid_energy', metric: 'PUMPING_ENERGY_KWH', targetCalcId: recGrid.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'INVOICES', descriptionRo: 'Energia din rețea folosită la pompare, din facturi.' },
      { kpiId: 'kpi_commissioning', metric: 'WATER_SAVING_PCT', targetCalcId: recPct.calcId, frequency: 'ONCE', firstDue: 'AFTER_INSTALLATION', dataSource: 'COMMISSIONING_REPORT', descriptionRo: 'Sistemul montat corespunde configurației care trece pragul.' },
      { kpiId: 'kpi_satellite', metric: 'AREA_HA', targetCalcId: area.calcId, frequency: 'SEMIANNUAL', firstDue: 'MONTH_6', dataSource: 'SATELLITE', descriptionRo: 'Parcelele sunt cultivate și vegetația e sănătoasă (Sentinel-2).' },
    ],
    risks: [
      { category: 'CLIMATE_DROUGHT', severity: 'HIGH', descriptionRo: 'Sud-estul are risc ridicat de secetă.', mitigationRo: 'Picurarea și senzorii reduc expunerea; recomandăm asigurarea culturilor.' },
      { category: 'NITRATE_ZONE', severity: 'MEDIUM', descriptionRo: 'Două parcele în zonă vulnerabilă la nitrați.', mitigationRo: 'Plan de fertirigare, condiție înainte de tragere.' },
      { category: 'DATA_QUALITY', severity: 'LOW', descriptionRo: 'Facturile de energie acoperă tot locul de consum, nu doar pompa.', mitigationRo: 'Contorul și KPI-ul de energie corectează estimarea după 12 luni.' },
    ],
    committeeSummaryRo: `Fermă de legume, 40 ha, sud-est. Investiția inițială (aspersie clasică, 85.000 EUR) nu trecea pragul (15,0% < 25%). Configurația recomandată (picurare, senzori, contor, pompă solară, 125.000 EUR) atinge 32,0% economie de apă, ${recGridSaved.display} din rețea înlocuiți și ${recCo2.display} evitate. 100% din sumă e etichetată verde (pompa solară aliniată la Taxonomie, activitatea 4.1). Structură: credit verde cu garanție InvestEU 70%, fără ipotecă, rate sezoniere iul–oct; avantaj net pentru client ${cmpAdv.display} pe 5 ani. Nu există grant AFIR deschis. Recomandare: eligibil cu condiții.`,
    farmerNextSteps: [
      { stepRo: 'Trimite planul de fertirigare pentru cele două parcele din zona de nitrați.', conditionId: 'cp_fertigation_plan' },
      { stepRo: 'Cere furnizorului oferta finală pentru picurare, senzori, contor și pompă solară.' },
      { stepRo: 'După montaj: procesul-verbal de punere în funcțiune și poze geolocalizate.', conditionId: 'cp_commissioning' },
      { stepRo: 'La 12 luni: citirea contorului de apă și facturile de energie.' },
    ],
  };
  R.completed(A3, 'submit_underwriting_report', '✅ Agentul 3 a terminat: eligibil verde cu condiții', report, 3, 21600);

  R.state('AGENT_3', 'GATA', 'Ofertele sunt gata; fermierul alege varianta și trimite cererea', {}, 300);
  const t0 = Date.parse('2026-10-28T09:30:00.000Z');
  R.emit('run.completed', null, `Analiză completă: eligibil cu condiții, recomandăm B (+${cmpAdv.display} în 5 ani)`, {
    state: 'GATA', durationMs: R.t - t0 + 200, decision: 'ELIGIBLE_WITH_CONDITIONS', recommendedOptionId: 'B', netAdvantageCalcId: cmpAdv.calcId,
    sources: { TECHNICAL_AUDITOR: 'LIVE', FUNDING_OPTIMIZER: 'LIVE', GREEN_UNDERWRITER: 'LIVE' },
  }, 200);
  R.state('GATA', 'TRIMIS', 'Cererea a fost trimisă la bancă: Credit verde', { actor: 'FARMER' }, 40000);
  R.state('TRIMIS', 'APROBAT', 'Banca a aprobat dosarul cu condițiile propuse', { actor: 'OFFICER', reasonRo: 'Aprobat cu cele 6 condiții din raport.' }, 5000);
  R.state('APROBAT', 'MONITORIZARE', 'Tragere simulată în demo; încep verificările de monitorizare', { reasonRo: 'Demo: tragerea e simulată imediat după aprobare.' }, 3000);

  return { R, assessment, funding, report, extractions: [extractionOffer, extractionPermit, extractionEnergy] };
}

// =====================================================================
// Scenario 2: utilaje — 400 ha cereal farm, manager aged 38
// =====================================================================

function buildUtilaje() {
  const R = new RunBuilder('run_utl3m8vz2c6h', '2026-10-28T10:15:00.000Z');
  const P = {
    areaHa: 400, lPerHa: 90, tractorSaving: 0.12, precisionFuelSaving: 0.1, inputsEurHa: 250, inputsSaving: 0.03,
    nKgHa: 150, vraSaving: 0.05, fuelPriceLei: 10.3, vat: 1.21, excise: 2.697, eurRon: 4.97, co2PerL: 2.68,
    threshold: 20, tractor240: 250000, tractor180: 190000, precision: 52000, powerHp: 840, maxHpHa: 2.5,
    grantIntensity: 65, grantCap: 200000, rateStd: 7.5, rateCofin: 6.0, rateBridge: 7.0, term: 84, bridgeTerm: 12,
    fgcrCoverage: 80, horizonYears: 7, annualNetCf: 210000, affordLimit: 40, precisionPoints: 15,
  };
  const offer = P.tractor240 + P.tractor180;
  const recTotal = offer + P.precision;

  R.state(null, 'CREAT', 'Dosar creat: utilaje & precizie, 400 ha, 2 documente încărcate', { actor: 'FARMER' }, 0);
  R.state('CREAT', 'DATE_FIRMA', 'Am preluat datele firmei: ANAF, APIA, Open Banking, risc climatic', {
    dataSources: [
      { source: 'ANAF', mode: 'MOCK' }, { source: 'APIA', mode: 'MOCK' }, { source: 'OPEN_BANKING', mode: 'MOCK' },
      { source: 'COPERNICUS', mode: 'MOCK' }, { source: 'NATURA_2000', mode: 'MOCK' }, { source: 'NITRATES', mode: 'MOCK' },
    ],
  }, 1100);
  R.state('DATE_FIRMA', 'AGENT_1', 'Pornește auditorul tehnic', {}, 300);
  R.started(A1, 'AGENT_1', 'Agentul 1 (auditor tehnic) a pornit');

  const oTotal = R.calc('extract_document', 'doc.offer.total_net', 'Valoare ofertă tractoare (fără TVA)', offer, 'EUR', { sourceRo: 'Oferta AgroTrac OF-T-0921, pag. 2' });
  const o240 = R.calc('extract_document', 'doc.offer.line.tractor_240', '2 tractoare 240 CP, Stage V', P.tractor240, 'EUR', { sourceRo: 'Oferta AgroTrac, poziția 1' });
  const o180 = R.calc('extract_document', 'doc.offer.line.tractor_180', '2 tractoare 180 CP, Stage V', P.tractor180, 'EUR', { sourceRo: 'Oferta AgroTrac, poziția 2' });
  const oCount = R.calc('extract_document', 'doc.offer.quantity', 'Număr tractoare', 4, 'COUNT', { sourceRo: 'Oferta AgroTrac' });
  const oPower = R.calc('extract_document', 'doc.offer.power_total', 'Putere totală tractoare noi', P.powerHp, 'HP', { formula: '2 × 240 CP + 2 × 180 CP', sourceRo: 'Oferta AgroTrac, fișe tehnice' });
  const extractionOffer = {
    documentId: 'doc_oferta_tractoare', documentType: 'OFFER', moduleId: 'utilaje', currency: 'EUR',
    supplierName: 'AgroTrac Distribuție SRL',
    documentFields: [
      field('SUPPLIER_NAME', 'AgroTrac Distribuție SRL', 'TEXT', 1),
      field('DOCUMENT_NUMBER', 'OF-T-0921', 'TEXT', 1),
      field('DOCUMENT_DATE', '09.10.2026', 'DATE', 1),
      field('TOTAL_NET', '440.000,00 EUR', 'EUR', 2),
      field('VAT_AMOUNT', '92.400,00 EUR', 'EUR', 2),
      field('TOTAL_GROSS', '532.400,00 EUR', 'EUR', 2),
      field('PRECISION_FEATURES', 'pregătire ISOBUS; ghidaj RTK și section control: opțional, necomandate', 'TEXT', 3, 'MEDIUM'),
    ],
    lineItems: [
      {
        lineId: 'ln_1', category: 'TRACTOR', descriptionRo: 'Tractor 240 CP, Stage V, nou, 2 buc.',
        fields: [field('QUANTITY', '2 buc.', 'PCS', 2), field('ENGINE_POWER_HP', '240 CP', 'HP', 3), field('EMISSION_STAGE', 'Stage V', 'TEXT', 3), field('CONDITION', 'nou', 'TEXT', 2), field('MANUFACTURE_YEAR', '2026', 'YEAR', 3), field('SPECIFIC_FUEL_CONSUMPTION_G_KWH', '238 g/kWh', 'G_KWH', 3, 'MEDIUM'), field('LINE_PRICE_NET', '250.000,00 EUR', 'EUR', 2)],
      },
      {
        lineId: 'ln_2', category: 'TRACTOR', descriptionRo: 'Tractor 180 CP, Stage V, nou, 2 buc.',
        fields: [field('QUANTITY', '2 buc.', 'PCS', 2), field('ENGINE_POWER_HP', '180 CP', 'HP', 4), field('EMISSION_STAGE', 'Stage V', 'TEXT', 4), field('CONDITION', 'nou', 'TEXT', 2), field('MANUFACTURE_YEAR', '2026', 'YEAR', 4), field('LINE_PRICE_NET', '190.000,00 EUR', 'EUR', 2)],
      },
    ],
    missingFields: [],
    warnings: ['Oferta nu include ghidaj RTK, section control sau doză variabilă.'],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_oferta_tractoare' }, '📄 Citesc oferta pentru tractoare', '📄 Oferta citită: 4 tractoare Stage V, 440.000 EUR, fără pachet de precizie', () => [oTotal, o240, o180, oCount, oPower], { extraction: extractionOffer, modelId: MODEL_EXTRACT }, { callDt: 600, durationMs: 5100 });

  const invLitres = R.calc('extract_document', 'doc.fuel.litres_12m', 'Motorină facturată (12 luni)', 36180, 'L_PER_YEAR', { sourceRo: 'Facturi motorină 10.2025–09.2026' });
  const extractionFuel = {
    documentId: 'doc_facturi_motorina', documentType: 'FUEL_INVOICES', moduleId: 'utilaje', currency: 'RON',
    supplierName: 'Distribuitor carburanți (demo)',
    documentFields: [
      field('PERIOD_FROM', '01.10.2025', 'DATE', 1),
      field('PERIOD_TO', '30.09.2026', 'DATE', 9),
      field('FUEL_LITRES', '36.180 l', 'L', 10),
      field('FUEL_COST', '372.654,00 lei', 'RON', 10),
    ],
    lineItems: [],
    missingFields: [{ key: 'FERTILIZER_KG_N', reasonRo: 'Facturile de îngrășăminte nu au fost încărcate; folosesc doza declarată în chestionar.' }],
    warnings: [],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_facturi_motorina' }, '📄 Citesc facturile de motorină pe 12 luni', '📄 Motorină: 36.180 l pe 12 luni', () => [invLitres], { extraction: extractionFuel, modelId: MODEL_EXTRACT }, { callDt: 100, durationMs: 3300 });

  const fuelNetLei = P.fuelPriceLei / P.vat - P.excise;
  const fuelEur = fuelNetLei / P.eurRon;
  const thr = R.calc('get_module_rules', 'rules.threshold.fuel_saving', 'Prag verde: economie de motorină', P.threshold, 'PCT', { sourceRo: 'config/modules/utilaje.json (propunere; modelul BERD GEFF, de confirmat cu Raiffeisen)' });
  const lHa = R.calc('get_module_rules', 'rules.norm.l_per_ha', 'Normă motorină, cereale, lucrări convenționale', P.lPerHa, 'L_PER_HA', { sourceRo: 'config/modules/utilaje.json (demo)' });
  const sTractor = R.calc('get_module_rules', 'rules.saving.new_tractor', 'Economie tractor nou vs. tractor de peste 20 de ani', P.tractorSaving * 100, 'PCT', { sourceRo: 'data/catalog/utilaje.json (Nebraska/UNL + estimare)' });
  const sPrec = R.calc('get_module_rules', 'rules.saving.precision_fuel', 'Economie motorină prin ghidaj RTK', P.precisionFuelSaving * 100, 'PCT', { sourceRo: 'data/catalog/utilaje.json (Haapala et al., 2025)' });
  const sInputs = R.calc('get_module_rules', 'rules.saving.precision_inputs', 'Economie inputuri prin section control', P.inputsSaving * 100, 'PCT', { sourceRo: 'data/catalog/utilaje.json (PAMI, Iowa State)' });
  const sVra = R.calc('get_module_rules', 'rules.saving.vra_n', 'Economie azot prin doză variabilă', P.vraSaving * 100, 'PCT', { sourceRo: 'data/catalog/utilaje.json (CEMEPE)' });
  const fuelPrice = R.calc('get_module_rules', 'rules.price.fuel_net', 'Cost net motorină (fără TVA, după rambursarea accizei)', fuelEur, 'EUR_PER_L', { formula: '(10,3 lei / 1,21 − 2,697 lei) / 4,97', sourceRo: 'config/prices.json; acciză APIA 2026' });
  const co2L = R.calc('get_module_rules', 'rules.factor.diesel', 'Factor CO₂ motorină', P.co2PerL, 'KG_CO2_PER_L', { sourceRo: 'config/factors.json (IPCC 2006)' });
  const maxHpHa = R.calc('get_module_rules', 'rules.sizing.max_hp_ha', 'Putere maximă admisă pe hectar (cereale)', P.maxHpHa, 'HP_PER_HA', { sourceRo: 'config/modules/utilaje.json (valoare demo, de verificat în Anexa 6 DR-12)' });
  R.tool(A1, 'get_module_rules', 2, { moduleId: 'utilaje' }, '🔧 Citesc regulile modulului Utilaje & precizie', '🔧 Prag verde: economie de motorină ≥ 20%', () => [thr, lHa, sTractor, sPrec, sInputs, sVra, fuelPrice, co2L, maxHpHa], { indicator: 'FUEL_SAVING_PCT', calculator: 'machinery', catalog: 'data/catalog/utilaje.json' });

  const baseL = P.areaHa * P.lPerHa;
  const baseN = P.areaHa * P.nKgHa;
  const area = R.calc('compute_baseline', 'baseline.area', 'Suprafață lucrată', P.areaHa, 'HA', { sourceRo: 'APIA 2026' });
  const baseFuel = R.calc('compute_baseline', 'baseline.fuel', 'Motorină consumată azi', baseL, 'L_PER_YEAR', { formula: 'ha × l/ha (confirmat de facturi: 36.180 l, abatere 0,5%)', dependsOn: [area, lHa, invLitres] });
  const bN = R.calc('compute_baseline', 'baseline.nitrogen', 'Azot aplicat azi', baseN, 'KG_N_PER_YEAR', { formula: 'ha × kg N/ha (chestionar)', dependsOn: [area] });
  const bCo2 = R.calc('compute_baseline', 'baseline.co2', 'CO₂ din motorină azi', (baseL * P.co2PerL) / 1000, 'T_CO2_PER_YEAR', { dependsOn: [baseFuel, co2L] });
  R.tool(A1, 'compute_baseline', 2, { moduleId: 'utilaje', currentFleet: 'TRACTORS_OVER_20Y', fuelDocumentId: 'doc_facturi_motorina' }, '🔧 Calculez situația actuală (4 tractoare de peste 20 de ani)', '🔧 Azi: 36.000 l motorină și 95,8 t CO₂ pe an', () => [area, baseFuel, bN, bCo2], { dataSource: 'MIXED' });

  const aL = baseL * P.tractorSaving;
  const iCost = R.calc('compute_indicator', 'cfg_initial.total_cost', 'Cost configurație inițială', offer, 'EUR', { dependsOn: [oTotal] });
  const iPct = R.calc('compute_indicator', 'cfg_initial.fuel_saving_pct', 'Economie de motorină: doar tractoare noi', P.tractorSaving * 100, 'PCT', { dependsOn: [sTractor] });
  const iSaved = R.calc('compute_indicator', 'cfg_initial.fuel_saved', 'Motorină economisită: doar tractoare noi', aL, 'L_PER_YEAR', { dependsOn: [baseFuel, sTractor] });
  const iCo2 = R.calc('compute_indicator', 'cfg_initial.co2_avoided', 'CO₂ evitat: doar tractoare noi', (aL * P.co2PerL) / 1000, 'T_CO2_PER_YEAR', { dependsOn: [iSaved, co2L] });
  const sizing = R.calc('compute_indicator', 'cfg_initial.hp_per_ha', 'Putere pe hectar', P.powerHp / P.areaHa, 'HP_PER_HA', { formula: 'CP total / ha', dependsOn: [oPower, area] });
  R.tool(A1, 'compute_indicator', 3, { configId: 'cfg_initial', documentId: 'doc_oferta_tractoare' }, '🔧 verific pragul pentru tractoarele din ofertă', '🔧 Tractoarele noi economisesc 12,0% motorină. NU TRECE (prag 20%). Dimensionare: 2,10 CP/ha, în limită', () => [iCost, iPct, iSaved, iCo2, sizing], { thresholdResult: 'FAIL', sizing: 'PASS' });

  R.thought(A1, 'Tractoarele Stage V aduc doar 12% economie: sunt tranziție, nu verde. Caut în catalog pachetul de precizie care trece pragul de 20%. Dacă depășește 10% din valoarea eligibilă, aduce și +15 puncte la DR-12.', 3);

  R.tool(A1, 'search_upgrades', 4, { moduleId: 'utilaje', baseConfigId: 'cfg_initial', targetIndicator: 'FUEL_SAVING_PCT', sortBy: 'COST_ASC' }, '🔧 Caut upgrade-uri în catalogul de utilaje', '🔧 Găsit: pachet de precizie (ghidaj RTK + section control + doză variabilă)', null, {
    candidates: [{ packageId: 'pkg_precision', catalogIds: ['utl.precision.rtk_sc_vra'], thresholdResult: 'PASS' }],
  });

  const bL = baseL * (1 - (1 - P.tractorSaving) * (1 - P.precisionFuelSaving));
  const rCost = R.calc('simulate_upgrade_package', 'cfg_recommended.total_cost', 'Cost configurație recomandată', recTotal, 'EUR');
  const rUp = R.calc('simulate_upgrade_package', 'cfg_recommended.upgrade_cost', 'Cost pachet de precizie', P.precision, 'EUR', { sourceRo: 'data/catalog/utilaje.json: utl.precision.rtk_sc_vra' });
  const rPct = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_saving_pct', 'Economie de motorină: tractoare + precizie', (bL / baseL) * 100, 'PCT', { formula: '1 − (1 − s_tractor) × (1 − s_precizie)', dependsOn: [sTractor, sPrec] });
  const rSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_saved', 'Motorină economisită: tractoare + precizie', bL, 'L_PER_YEAR', { dependsOn: [baseFuel, rPct] });
  const rFuelUse = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_use', 'Motorină consumată după investiție', baseL - bL, 'L_PER_YEAR', { dependsOn: [baseFuel, rSaved] });
  const rN = R.calc('simulate_upgrade_package', 'cfg_recommended.nitrogen_saved', 'Azot economisit prin doză variabilă', baseN * P.vraSaving, 'KG_N_PER_YEAR', { formula: 'ha × kg N/ha × s_doză_variabilă', dependsOn: [bN, sVra] });
  const rNUse = R.calc('simulate_upgrade_package', 'cfg_recommended.nitrogen_use', 'Azot aplicat după investiție', baseN * (1 - P.vraSaving), 'KG_N_PER_YEAR', { dependsOn: [bN, rN] });
  const rInputs = R.calc('simulate_upgrade_package', 'cfg_recommended.inputs_saved', 'Inputuri economisite (îngrășăminte, sămânță)', P.areaHa * P.inputsEurHa * P.inputsSaving, 'EUR_PER_YEAR', { formula: 'ha × 250 EUR/ha × 3%', dependsOn: [area, sInputs] });
  const rCo2 = R.calc('simulate_upgrade_package', 'cfg_recommended.co2_avoided', 'CO₂ evitat: tractoare + precizie', (bL * P.co2PerL) / 1000, 'T_CO2_PER_YEAR', { dependsOn: [rSaved, co2L] });
  const rShare = R.calc('simulate_upgrade_package', 'cfg_recommended.precision_share', 'Pondere precizie în valoarea eligibilă', (P.precision / recTotal) * 100, 'PCT', { formula: 'cost precizie / total eligibil', dependsOn: [rUp, rCost] });
  R.tool(A1, 'simulate_upgrade_package', 4, { baseConfigId: 'cfg_initial', configId: 'cfg_recommended', add: ['utl.precision.rtk_sc_vra'] }, '🔧 Simulez tractoare + pachet de precizie', '🔧 Tractoare + precizie: 20,8% economie de motorină. TRECE (prag 20%). Precizia = 10,6% din valoare', () => [rCost, rUp, rPct, rSaved, rFuelUse, rN, rNUse, rInputs, rCo2, rShare], { configId: 'cfg_recommended', thresholdResult: 'PASS' });

  R.tool(A1, 'check_dnsh_inputs', 5, { moduleId: 'utilaje', configId: 'cfg_recommended', parcelIds: ['cl_1001', 'cl_1002', 'cl_1003', 'cl_1004'] }, '🔧 Verific datele pentru DNSH', '🔧 Tractoarele vechi trebuie casate; nicio parcelă în Natura 2000', null, {
    oldEquipmentFate: 'CASARE', natura2000Parcels: [], nitrateVulnerableParcels: [],
  });

  const assessment = {
    moduleId: 'utilaje',
    indicator: 'FUEL_SAVING_PCT',
    threshold: { thresholdCalcId: thr.calcId, sourceRo: 'config/modules/utilaje.json: economie de motorină ≥ 20% față de baseline (model BERD GEFF; propunere, de confirmat cu Raiffeisen)' },
    baseline: {
      descriptionRo: '4 tractoare de peste 20 de ani pe 400 ha de cereale. Motorina e calculată din normă și confirmată de facturile pe 12 luni.',
      dataSource: 'MIXED',
      metrics: [
        { metric: 'AREA_HA', calcId: area.calcId },
        { metric: 'FUEL_USE_L', calcId: baseFuel.calcId },
        { metric: 'NITROGEN_USE_KG', calcId: bN.calcId },
        { metric: 'CO2_EMITTED_T', calcId: bCo2.calcId },
      ],
    },
    configurations: [
      {
        configId: 'cfg_initial', role: 'INITIAL', titleRo: '4 tractoare Stage V (oferta AgroTrac)',
        components: [
          { componentId: 'cmp_tractors_240', category: 'TRACTOR', nameRo: '2 tractoare 240 CP, Stage V', source: 'OFFER', costCalcId: o240.calcId },
          { componentId: 'cmp_tractors_180', category: 'TRACTOR', nameRo: '2 tractoare 180 CP, Stage V', source: 'OFFER', costCalcId: o180.calcId },
        ],
        totalCostCalcId: iCost.calcId,
        indicatorCalcId: iPct.calcId,
        thresholdResult: 'FAIL',
        impacts: [
          { metric: 'FUEL_SAVING_PCT', calcId: iPct.calcId },
          { metric: 'FUEL_SAVED_L', calcId: iSaved.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: iCo2.calcId },
        ],
      },
      {
        configId: 'cfg_recommended', role: 'RECOMMENDED', titleRo: '4 tractoare Stage V + pachet de precizie',
        components: [
          { componentId: 'cmp_tractors_240', category: 'TRACTOR', nameRo: '2 tractoare 240 CP, Stage V', source: 'OFFER', costCalcId: o240.calcId },
          { componentId: 'cmp_tractors_180', category: 'TRACTOR', nameRo: '2 tractoare 180 CP, Stage V', source: 'OFFER', costCalcId: o180.calcId },
          { componentId: 'cmp_precision', category: 'PRECISION_PACKAGE', nameRo: 'Pachet de precizie: ghidaj RTK, section control, doză variabilă', source: 'CATALOG_UPGRADE', catalogId: 'utl.precision.rtk_sc_vra', costCalcId: rUp.calcId },
        ],
        totalCostCalcId: rCost.calcId,
        upgradeCostCalcId: rUp.calcId,
        indicatorCalcId: rPct.calcId,
        thresholdResult: 'PASS',
        impacts: [
          { metric: 'FUEL_SAVING_PCT', calcId: rPct.calcId },
          { metric: 'FUEL_SAVED_L', calcId: rSaved.calcId },
          { metric: 'NITROGEN_SAVED_KG', calcId: rN.calcId },
          { metric: 'INPUTS_COST_SAVED_EUR', calcId: rInputs.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: rCo2.calcId },
          { metric: 'PRECISION_SHARE_PCT', calcId: rShare.calcId },
        ],
        noteRo: 'Precizia depășește 10% din valoarea eligibilă: +15 puncte la DR-12.',
      },
    ],
    initialConfigId: 'cfg_initial',
    recommendedConfigId: 'cfg_recommended',
    recommendationType: 'UPGRADE_TO_PASS',
    dnshChecks: [
      { objective: 'CIRCULAR_ECONOMY', status: 'PASS_WITH_CONDITIONS', evidence: [], noteRo: 'Fermierul declară casarea tractoarelor vechi; e nevoie de certificatul de dezmembrare.' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS', evidence: ['TECHNICAL_SHEET'], noteRo: 'Motoare Stage V; doza variabilă reduce excesul de azot.' },
      { objective: 'BIODIVERSITY', status: 'PASS', evidence: [], noteRo: 'Nicio parcelă în Natura 2000.' },
    ],
    sizingCheck: { status: 'PASS', calcId: sizing.calcId, noteRo: '2,10 CP/ha, sub limita de 2,50 CP/ha (valoare demo, de verificat în Anexa 6 DR-12).' },
    missingFields: [
      { fieldKey: 'fertilizer_invoices', labelRo: 'Facturile de îngrășăminte pe 12 luni', requiredFor: 'GREEN_ELIGIBILITY', docType: 'FERTILIZER_INVOICES', blocking: false },
      { fieldKey: 'scrapping_certificate', labelRo: 'Certificatul de dezmembrare pentru tractoarele vechi', requiredFor: 'DNSH', docType: 'SCRAPPING_CERTIFICATE', blocking: false },
    ],
    summaryRo: 'Cele 4 tractoare Stage V (440.000 EUR) economisesc 12,0% motorină, sub pragul de 20%: sunt investiție de tranziție. Cu pachetul de precizie (52.000 EUR) economia ajunge la 20,8%, adică 7.488 l/an și 19,9 t CO₂/an, plus 3.000 kg N/an. Precizia reprezintă 10,6% din valoarea eligibilă, deci aduce +15 puncte la DR-12. Dimensionarea e în limită (2,10 CP/ha).',
    farmerMessageRo: 'Tractoarele noi economisesc 12% motorină. Cu un pachet de precizie (GPS RTK, oprire pe secțiuni, doză variabilă) ajungi la 21% și primești puncte în plus la grantul AFIR.',
  };
  R.completed(A1, 'submit_technical_assessment', '✅ Agentul 1 a terminat: sub prag → precizie → 20,8%, peste prag', assessment, 5, 28900);

  // =================== AGENT 2 ===================
  R.state('AGENT_1', 'AGENT_2', 'Pornește optimizatorul de finanțare', {}, 300);
  R.started(A2, 'AGENT_2', 'Agentul 2 (finanțare) a pornit');

  const rStd = R.calc('list_financing_lines', 'line.standard.rate', 'Dobândă credit standard', P.rateStd, 'PCT', { sourceRo: 'config/financing-lines.json: STANDARD_INVEST (demo)' });
  const rCof = R.calc('list_financing_lines', 'line.cofinancing.rate', 'Dobândă credit de cofinanțare cu garanție FGCR', P.rateCofin, 'PCT', { sourceRo: 'config/financing-lines.json: GREEN_AGRI (demo, de confirmat)' });
  const rBr = R.calc('list_financing_lines', 'line.bridge.rate', 'Dobândă credit-punte', P.rateBridge, 'PCT', { sourceRo: 'config/financing-lines.json: BRIDGE_AFIR (demo)' });
  const term = R.calc('list_financing_lines', 'line.term', 'Durată credit', P.term, 'MONTHS', { sourceRo: 'config/financing-lines.json' });
  const brTerm = R.calc('list_financing_lines', 'line.bridge.term', 'Durată credit-punte', P.bridgeTerm, 'MONTHS', { sourceRo: 'config/financing-lines.json' });
  const fgcr = R.calc('list_financing_lines', 'line.fgcr.coverage', 'Acoperire garanție FGCR', P.fgcrCoverage, 'PCT', { sourceRo: 'config/financing-lines.json: FGCR' });
  const horizon = R.calc('list_financing_lines', 'line.horizon', 'Orizont de comparație', P.horizonYears, 'YEARS', { sourceRo: 'config/modules/utilaje.json' });
  const affLimit = R.calc('list_financing_lines', 'line.affordability_limit', 'Limită serviciu datorie / cashflow net', P.affordLimit, 'PCT', { sourceRo: 'config/financing-lines.json (demo)' });
  R.tool(A2, 'list_financing_lines', 1, { moduleId: 'utilaje', farmSize: 'SME' }, '🔧 Citesc liniile de finanțare Raiffeisen', '🔧 Standard 7,5%; cofinanțare cu FGCR 6,0%; punte 7,0%', () => [rStd, rCof, rBr, term, brTerm, fgcr, horizon, affLimit], { lines: ['STANDARD_INVEST', 'GREEN_AGRI', 'BRIDGE_AFIR'] });

  const gInt = R.calc('check_program_eligibility', 'dr12.intensity', 'Intensitate grant DR-12', P.grantIntensity, 'PCT', { sourceRo: 'config/funding-programs.json: DR-12 (≤45 ani: 65%; ≤40 ani + competențe: 80%)' });
  const gCap = R.calc('check_program_eligibility', 'dr12.cap', 'Plafon grant DR-12', P.grantCap, 'EUR', { sourceRo: 'Ghidul solicitantului DR-12, 18.09.2026' });
  const gPts = R.calc('check_program_eligibility', 'dr12.precision_points', 'Punctaj pentru precizie ≥ 10%', P.precisionPoints, 'POINTS', { sourceRo: 'Ghidul DR-12, criteriile de selecție', dependsOn: [rShare] });
  const age = R.calc('check_program_eligibility', 'dr12.manager_age', 'Vârsta administratorului', 38, 'YEARS', { sourceRo: 'ONRC (mock)' });
  R.tool(A2, 'check_program_eligibility', 2, { cui: '38264019', moduleId: 'utilaje', configId: 'cfg_recommended', programs: ['DR_12', 'FGCR', 'INVESTEU_FEI', 'RABLA_AGRI'] }, '🔧 Verific DR-12, FGCR și celelalte programe', '🔧 DR-12 deschis până la 02.12.2026: ferma e eligibilă, 65%, plafon 200.000 EUR', () => [gInt, gCap, gPts, age], {
    programs: [
      { programCode: 'DR_12', result: 'ELIGIBLE', session: 'OPEN' },
      { programCode: 'FGCR', result: 'ELIGIBLE', session: 'PERMANENT' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT' },
      { programCode: 'RABLA_AGRI', result: 'UNKNOWN', session: 'NO_BUDGET' },
    ],
  });

  R.thought(A2, 'Ferma e eligibilă la DR-12: SRL, administrator de 38 de ani, instalat în 2023, utilaje noi. Intensitatea e 65% pentru că nu avem dovada competențelor; cu 80% grantul ar rămâne tot la plafonul de 200.000 EUR. Compun: grant + credit de cofinanțare cu garanție FGCR + punte până la plata grantului.', 3);

  const grant = Math.min((P.grantIntensity / 100) * recTotal, P.grantCap);
  const cofin = recTotal - grant;
  const fsGrant = R.calc('build_funding_stack', 'option_b.grant.amount', 'Grant DR-12', grant, 'EUR', { formula: 'min(intensitate × valoare eligibilă, plafon)', dependsOn: [gInt, rCost, gCap] });
  const fsCofin = R.calc('build_funding_stack', 'option_b.cofinancing.amount', 'Credit de cofinanțare', cofin, 'EUR', { formula: 'valoare eligibilă − grant', dependsOn: [rCost, fsGrant] });
  const fsGuar = R.calc('build_funding_stack', 'option_b.guarantee.amount', 'Sumă acoperită de garanția FGCR', (cofin * P.fgcrCoverage) / 100, 'EUR', { dependsOn: [fsCofin, fgcr] });
  const fsBridge = R.calc('build_funding_stack', 'option_b.bridge.amount', 'Credit-punte până la plata grantului', grant, 'EUR', { dependsOn: [fsGrant] });
  const fsStd = R.calc('build_funding_stack', 'option_a.loan.amount', 'Credit standard', offer, 'EUR', { dependsOn: [iCost] });
  R.tool(A2, 'build_funding_stack', 3, { options: [{ optionId: 'A', configId: 'cfg_initial', products: ['STANDARD_INVEST'] }, { optionId: 'B', configId: 'cfg_recommended', products: ['DR-12', 'GREEN_AGRI', 'FGCR', 'BRIDGE_AFIR'] }] }, '🔧 Construiesc pachetul: grant + cofinanțare + punte + garanție', '🔧 B: grant 200.000 EUR + credit 292.000 EUR cu FGCR 80% + punte 200.000 EUR', () => [fsStd, fsGrant, fsCofin, fsGuar, fsBridge], { optionA: ['STANDARD_LOAN'], optionB: ['GRANT', 'CO_FINANCING_LOAN', 'GUARANTEE', 'BRIDGE_LOAN'] });

  const schA = schedule(offer, P.rateStd, P.term, 2027, 3);
  const schB = schedule(cofin, P.rateCofin, P.term, 2027, 3);
  const bridgeInterest = grant * (P.rateBridge / 100) * (P.bridgeTerm / 12);
  const bridgeSeries = Array.from({ length: P.bridgeTerm }, (_, i) => {
    const last = i === P.bridgeTerm - 1;
    return { period: periodOf(2027, 3, i + 1).label, values: { payment: last ? round(grant + bridgeInterest) : 0, interest: round(bridgeInterest / P.bridgeTerm), balance: last ? 0 : round(grant + (bridgeInterest * (i + 1)) / P.bridgeTerm) } };
  });
  const aFuelEur = aL * fuelEur;
  const bFuelEur = bL * fuelEur;
  const bInputsEur = P.areaHa * P.inputsEurHa * P.inputsSaving;

  const aInst = R.calc('build_scenario', 'option_a.installment', 'Rată lunară A', schA.installment, 'EUR_PER_MONTH', { formula: 'PMT = P · r / (1 − (1 + r)^−n)', dependsOn: [fsStd, rStd, term] });
  const aSched = R.calc('build_scenario', 'option_a.schedule', 'Grafic rambursare A (total plăți)', schA.totalPayments, 'EUR', { series: schA.series, dependsOn: [aInst] });
  const aTotal = R.calc('build_scenario', 'option_a.total_payments', 'Total plăți A', schA.totalPayments, 'EUR', { dependsOn: [aInst, term] });
  const aInt = R.calc('build_scenario', 'option_a.total_interest', 'Dobânzi totale A', schA.totalInterest, 'EUR', { dependsOn: [aTotal, fsStd] });
  const aFuel = R.calc('build_scenario', 'option_a.savings.fuel_eur', 'Economie la motorină A', aFuelEur, 'EUR_PER_YEAR', { dependsOn: [iSaved, fuelPrice] });
  const aSavH = R.calc('build_scenario', 'option_a.savings_horizon', 'Economii A pe 7 ani', aFuelEur * P.horizonYears, 'EUR', { dependsOn: [aFuel, horizon] });
  const aNet = R.calc('build_scenario', 'option_a.net_cost', 'Cost net A pe 7 ani', schA.totalPayments - aFuelEur * P.horizonYears, 'EUR', { formula: 'plăți + costuri garanții − grant − economii', dependsOn: [aTotal, aSavH] });
  R.tool(A2, 'build_scenario', 4, { optionId: 'A', configId: 'cfg_initial', scheduleType: 'EQUAL_MONTHLY' }, '🔧 calculeaza_credit(A: 440.000 EUR, 7,5%, 84 de luni)', `🔧 A: ${aInst.display}`, () => [aInst, aSched, aTotal, aInt, aFuel, aSavH, aNet], { optionId: 'A' });

  const bInst = R.calc('build_scenario', 'option_b.installment', 'Rată lunară B (cofinanțare)', schB.installment, 'EUR_PER_MONTH', { formula: 'PMT = P · r / (1 − (1 + r)^−n)', dependsOn: [fsCofin, rCof, term] });
  const bSched = R.calc('build_scenario', 'option_b.schedule', 'Grafic rambursare B (total plăți cofinanțare)', schB.totalPayments, 'EUR', { series: schB.series, dependsOn: [bInst] });
  const brSched = R.calc('build_scenario', 'option_b.bridge.schedule', 'Grafic credit-punte (rambursat din grant)', grant + bridgeInterest, 'EUR', { series: bridgeSeries, dependsOn: [fsBridge, rBr, brTerm] });
  const brInt = R.calc('build_scenario', 'option_b.bridge.interest', 'Dobândă credit-punte', bridgeInterest, 'EUR', { formula: 'punte × dobândă × luni / 12', dependsOn: [fsBridge, rBr, brTerm] });
  const bTotal = R.calc('build_scenario', 'option_b.total_payments', 'Total plăți B (cofinanțare + punte)', schB.totalPayments + grant + bridgeInterest, 'EUR', { dependsOn: [bSched, brSched] });
  const bInt = R.calc('build_scenario', 'option_b.total_interest', 'Dobânzi totale B (cofinanțare + punte)', schB.totalInterest + bridgeInterest, 'EUR', { dependsOn: [bSched, brInt] });
  const bFuel = R.calc('build_scenario', 'option_b.savings.fuel_eur', 'Economie la motorină B', bFuelEur, 'EUR_PER_YEAR', { dependsOn: [rSaved, fuelPrice] });
  const bInputs = R.calc('build_scenario', 'option_b.savings.inputs_eur', 'Economie la inputuri B', bInputsEur, 'EUR_PER_YEAR', { dependsOn: [rInputs] });
  const bSavH = R.calc('build_scenario', 'option_b.savings_horizon', 'Economii B pe 7 ani', (bFuelEur + bInputsEur) * P.horizonYears, 'EUR', { dependsOn: [bFuel, bInputs, horizon] });
  const bNet = R.calc('build_scenario', 'option_b.net_cost', 'Cost net B pe 7 ani', schB.totalPayments + grant + bridgeInterest - grant - (bFuelEur + bInputsEur) * P.horizonYears, 'EUR', { formula: 'plăți + costuri garanții − grant − economii', dependsOn: [bTotal, fsGrant, bSavH] });
  R.tool(A2, 'build_scenario', 4, { optionId: 'B', configId: 'cfg_recommended', scheduleType: 'EQUAL_MONTHLY', bridge: 'UNTIL_GRANT_PAYMENT' }, '🔧 calculeaza_credit(B: 292.000 EUR, 6,0%, 84 de luni + punte)', `🔧 B: ${bInst.display}; puntea de 200.000 EUR se închide din grant`, () => [bInst, bSched, brSched, brInt, bTotal, bInt, bFuel, bInputs, bSavH, bNet], { optionId: 'B' });

  const adv = aNet.value - bNet.value;
  const cmpAdv = R.calc('compare_scenarios', 'compare.net_advantage', 'Avantaj net B față de A pe 7 ani', adv, 'EUR', { formula: '(economii B − plăți B − costuri B + grant) − (economii A − plăți A − costuri A)', dependsOn: [aNet, bNet] });
  const dGrant = R.calc('compare_scenarios', 'compare.driver.grant', 'Grant DR-12', grant, 'EUR', { dependsOn: [fsGrant] });
  const dInv = R.calc('compare_scenarios', 'compare.driver.investment', 'Investiție mai mare (precizie)', -P.precision, 'EUR', { dependsOn: [rUp] });
  const dInt = R.calc('compare_scenarios', 'compare.driver.interest', 'Dobânzi mai mici (inclusiv puntea)', schA.totalInterest - schB.totalInterest - bridgeInterest, 'EUR', { dependsOn: [aInt, bInt] });
  const dSav = R.calc('compare_scenarios', 'compare.driver.savings', 'Motorină și inputuri economisite în plus', (bFuelEur + bInputsEur - aFuelEur) * P.horizonYears, 'EUR', { dependsOn: [aSavH, bSavH] });
  const precNet = P.precision * (1 - P.grantIntensity / 100);
  const precMonthly = (bFuelEur - aFuelEur + bInputsEur) / 12;
  const payback = R.calc('compare_scenarios', 'compare.upgrade_payback', 'Amortizarea pachetului de precizie după grant', precNet / precMonthly, 'MONTHS', { decimals: 1, formula: 'cost precizie × (1 − intensitate grant) / economie lunară suplimentară', dependsOn: [rUp, gInt, dSav] });
  R.tool(A2, 'compare_scenarios', 5, { optionIds: ['A', 'B'], horizon: 'FROM_CONFIG' }, '🔧 Compar A și B pe 7 ani', `🔧 B e mai avantajos cu ${cmpAdv.display} pe 7 ani; precizia se amortizează în ${payback.display}`, () => [cmpAdv, dGrant, dInv, dInt, dSav, payback], { better: 'B' });

  const aRatio = R.calc('check_affordability', 'option_a.affordability_ratio', 'Serviciu anual datorie / cashflow net anual, A', ((schA.installment * 12) / P.annualNetCf) * 100, 'PCT', { dependsOn: [aInst] });
  const bRatio = R.calc('check_affordability', 'option_b.affordability_ratio', 'Serviciu anual datorie / cashflow net anual, B', ((schB.installment * 12) / P.annualNetCf) * 100, 'PCT', { formula: 'rate cofinanțare pe 12 luni / cashflow net (puntea se închide din grant)', dependsOn: [bInst] });
  R.tool(A2, 'check_affordability', 6, { optionIds: ['A', 'B'], cashflowSource: 'OPEN_BANKING' }, '🔧 Verific dacă rata încape în cashflow', `🔧 A: ${aRatio.display} din cashflow, aproape de limită. B: ${bRatio.display}`, () => [aRatio, bRatio], { A: 'PASS_WITH_WARNING', B: 'PASS' });

  // first submit rejected by schema validation, then corrected
  const badToolUseId = `tooluse_${hash12(`${R.runId}|submit_funding_recommendation|bad`)}`;
  R.emit('agent.tool_result', A2, '⚠️ Output respins de validare: lipsește grantOutlook. Agentul se corectează', {
    toolUseId: badToolUseId, tool: 'submit_funding_recommendation', status: 'ERROR', durationMs: 12, calcs: [], result: {},
    errors: [{ path: '/grantOutlook', messageRo: 'Câmp obligatoriu lipsă.' }],
  }, 2600);

  const funding = {
    options: [
      {
        optionId: 'A', kind: 'STANDARD', configId: 'cfg_initial', titleRo: 'Credit standard pentru 4 tractoare',
        investmentCalcId: iCost.calcId,
        fundingStack: [
          { itemId: 'fs_a_loan', type: 'STANDARD_LOAN', productId: 'STANDARD_INVEST', amountCalcId: fsStd.calcId, rateCalcId: rStd.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'EQUAL_MONTHLY', installmentCalcId: aInst.calcId, scheduleCalcId: aSched.calcId }, status: 'AVAILABLE', noteRo: 'Gaj pe tractoare și ipotecă.' },
        ],
        headlineInstallmentCalcId: aInst.calcId,
        collateral: ['PLEDGE_EQUIPMENT', 'MORTGAGE'],
        totals: { totalPaymentsCalcId: aTotal.calcId, totalInterestCalcId: aInt.calcId, savingsOverHorizonCalcId: aSavH.calcId, netCostCalcId: aNet.calcId },
        annualSavings: [{ metric: 'FUEL_COST_SAVED_EUR', calcId: aFuel.calcId }],
        affordability: { status: 'PASS_WITH_WARNING', ratioCalcId: aRatio.calcId, limitCalcId: affLimit.calcId, noteRo: 'Încape, dar e aproape de limita de 40%.' },
        greenEligible: false,
      },
      {
        optionId: 'B', kind: 'GREEN_PACKAGE_WITH_GRANT', configId: 'cfg_recommended', titleRo: 'Grant DR-12 + credit de cofinanțare cu garanție FGCR + punte',
        investmentCalcId: rCost.calcId,
        fundingStack: [
          { itemId: 'fs_b_grant', type: 'GRANT', productId: 'DR-12', programCode: 'DR_12', amountCalcId: fsGrant.calcId, status: 'OPEN_CALL', noteRo: 'Cerere de finanțare la AFIR până la 02.12.2026, ora 16:00.' },
          { itemId: 'fs_b_cofinancing', type: 'CO_FINANCING_LOAN', productId: 'GREEN_AGRI', amountCalcId: fsCofin.calcId, rateCalcId: rCof.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'EQUAL_MONTHLY', installmentCalcId: bInst.calcId, scheduleCalcId: bSched.calcId }, status: 'TO_CONFIRM', noteRo: 'Finanțarea cofinanțării AFIR de către Raiffeisen se confirmă cu mentorii.' },
          { itemId: 'fs_b_guarantee', type: 'GUARANTEE', productId: 'FGCR', programCode: 'FGCR', amountCalcId: fsGuar.calcId, coverageCalcId: fgcr.calcId, guaranteesItemId: 'fs_b_cofinancing', status: 'AVAILABLE', noteRo: 'Garanție FGCR pentru creditul de cofinanțare.' },
          { itemId: 'fs_b_bridge', type: 'BRIDGE_LOAN', productId: 'BRIDGE_AFIR', amountCalcId: fsBridge.calcId, rateCalcId: rBr.calcId, termCalcId: brTerm.calcId, repayment: { scheduleType: 'BULLET', installmentCalcId: brSched.calcId, scheduleCalcId: brSched.calcId }, status: 'TO_CONFIRM', noteRo: 'Se rambursează din grant, la plata AFIR.' },
        ],
        headlineInstallmentCalcId: bInst.calcId,
        collateral: ['GUARANTEE_FGCR', 'PLEDGE_EQUIPMENT', 'GRANT_ASSIGNMENT'],
        totals: { totalPaymentsCalcId: bTotal.calcId, totalInterestCalcId: bInt.calcId, savingsOverHorizonCalcId: bSavH.calcId, netCostCalcId: bNet.calcId },
        annualSavings: [{ metric: 'FUEL_COST_SAVED_EUR', calcId: bFuel.calcId }, { metric: 'INPUTS_COST_SAVED_EUR', calcId: bInputs.calcId }],
        affordability: { status: 'PASS', ratioCalcId: bRatio.calcId, limitCalcId: affLimit.calcId, noteRo: 'Rata de cofinanțare încape confortabil; puntea se închide din grant.' },
        greenEligible: true,
      },
    ],
    recommendedOptionId: 'B',
    recommendationBasis: { greenEligible: true, netAdvantagePositive: true, affordabilityPassed: true },
    programChecks: [
      {
        programCode: 'DR_12', result: 'ELIGIBLE', session: 'OPEN', deadline: '2026-12-02T16:00:00+02:00', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/domenii-de-interventie/detalii-si-anexe-dr-12/',
        criteria: [
          { criterion: 'LEGAL_FORM', result: 'PASS', noteRo: 'SRL înregistrat în APIA.' },
          { criterion: 'FARM_SIZE_SO', result: 'PASS', noteRo: 'Fermă medie, peste 12.000 EUR SO.' },
          { criterion: 'MANAGER_AGE', result: 'PASS', calcId: age.calcId },
          { criterion: 'INSTALLATION_DATE', result: 'PASS', noteRo: 'Instalat în 2023, sub 5 ani.' },
          { criterion: 'PROFESSIONAL_COMPETENCES', result: 'UNKNOWN', noteRo: 'Fără dovadă: intensitate 65% în loc de 80%.' },
          { criterion: 'NEW_EQUIPMENT_ONLY', result: 'PASS' },
          { criterion: 'POWER_TO_AREA', result: 'PASS', calcId: sizing.calcId },
          { criterion: 'PRECISION_SHARE', result: 'PASS', calcId: rShare.calcId, noteRo: '+15 puncte.' },
          { criterion: 'GRANT_CAP', result: 'PASS', calcId: gCap.calcId },
          { criterion: 'NO_SPENDING_BEFORE_APPLICATION', result: 'PASS', noteRo: 'Nicio comandă fermă până acum.' },
        ],
        noteRo: 'Sesiune deschisă 06.10–02.12.2026.',
      },
      { programCode: 'FGCR', result: 'ELIGIBLE', session: 'PERMANENT', checkedAt: '2026-10-28', sourceUrl: 'https://www.fgcr.ro/', criteria: [{ criterion: 'SECTOR_ELIGIBLE', result: 'PASS' }, { criterion: 'NO_DOUBLE_FUNDING', result: 'PASS', noteRo: 'Garanția acoperă creditul, nu aceleași costuri ca grantul.' }], noteRo: 'Garantează creditul de cofinanțare PS PAC până la 80%.' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT', checkedAt: '2026-10-28', sourceUrl: 'https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth', criteria: [{ criterion: 'SME_STATUS', result: 'PASS' }], noteRo: 'Alternativă la FGCR dacă garanția FGCR nu se aprobă.' },
      { programCode: 'RABLA_AGRI', result: 'UNKNOWN', session: 'NO_BUDGET', checkedAt: '2026-10-28', sourceUrl: 'https://www.afm.ro/', criteria: [{ criterion: 'SESSION_OPEN', result: 'FAIL' }], noteRo: 'Fără buget în 2026.' },
    ],
    grantOutlook: {
      status: 'GRANT_IN_STACK', programCode: 'DR_12',
      messageRo: 'DR-12 e deschis până la 02.12.2026, ora 16:00. Ferma e eligibilă: 65% din valoare, plafonat la 200.000 EUR. Nu semna contracte și nu plăti avansuri înainte de depunerea cererii.',
      checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/domenii-de-interventie/detalii-si-anexe-dr-12/',
    },
    comparison: {
      horizonCalcId: horizon.calcId,
      netAdvantageCalcId: cmpAdv.calcId,
      upgradePaybackCalcId: payback.calcId,
      drivers: [
        { driver: 'GRANT', calcId: dGrant.calcId },
        { driver: 'INVESTMENT_DELTA', calcId: dInv.calcId },
        { driver: 'INTEREST', calcId: dInt.calcId },
        { driver: 'OPERATING_SAVINGS', calcId: dSav.calcId },
      ],
    },
    farmerExplanationRo: `Investiția crește cu 52.000 EUR pentru pachetul de precizie, dar primești un grant de 200.000 EUR, iar rata scade de la ${aInst.display} la ${bInst.display}. Câștigi ${cmpAdv.display} în 7 ani. Cea mai mare parte vine din grant; precizia te ajută să-l obții și se plătește singură în ${payback.display}.`,
    officerNotesRo: 'Structură B: grant DR-12 200.000 EUR (65%, plafonat), credit de cofinanțare 292.000 EUR la 6,0% pe 84 de luni cu garanție FGCR 80%, punte 200.000 EUR pe 12 luni la 7,0%, rambursată din grant. Riscul principal: întârzierea sau respingerea grantului. Dobânzile sunt valori demo.',
  };
  R.completed(A2, 'submit_funding_recommendation', `✅ Agentul 2 a terminat: recomand B, avantaj net ${cmpAdv.display} pe 7 ani`, funding, 7, 34100);

  // =================== AGENT 3 ===================
  R.state('AGENT_2', 'AGENT_3', 'Pornește underwriter-ul verde', {}, 300);
  R.started(A3, 'AGENT_3', 'Agentul 3 (underwriter verde) a pornit');
  R.emit('agent.degraded', A3, '⚠️ Bedrock a răspuns lent; reîncerc (badge: retry)', { level: 'RETRY', reason: 'THROTTLED', attempt: 2, modelId: MODEL_AGENT, detailRo: 'ThrottlingException la primul apel; reîncercare după 1,5 s.' }, 4200);
  R.tool(A3, 'get_labeling_rules', 1, { moduleId: 'utilaje', configId: 'cfg_recommended' }, '🔧 Citesc regulile de etichetare', '🔧 Tractoare diesel: tranziție. Pachet de precizie: verde de piață', null, {
    rules: [{ componentId: 'cmp_tractors_240', label: 'TRANSITION' }, { componentId: 'cmp_tractors_180', label: 'TRANSITION' }, { componentId: 'cmp_precision', label: 'MARKET_GREEN' }],
  }, { callDt: 1600 });
  R.tool(A3, 'get_dnsh_criteria', 1, { moduleId: 'utilaje', substantialContribution: 'CLIMATE_MITIGATION' }, '🔧 Citesc criteriile DNSH', '🔧 5 obiective de verificat: adaptare, apă, circularitate, poluare, biodiversitate', null, {
    objectives: ['CLIMATE_ADAPTATION', 'WATER_MARINE_RESOURCES', 'CIRCULAR_ECONOMY', 'POLLUTION_PREVENTION', 'BIODIVERSITY'],
  });
  const greenAmt = R.calc('calculate_impact', 'label.green_amount', 'Sumă etichetată verde (pachet de precizie)', P.precision, 'EUR', { dependsOn: [rUp] });
  const transAmt = R.calc('calculate_impact', 'label.transition_amount', 'Sumă etichetată tranziție (tractoare)', offer, 'EUR', { dependsOn: [o240, o180] });
  const greenPct = R.calc('calculate_impact', 'label.green_share', 'Pondere verde în investiție', (P.precision / recTotal) * 100, 'PCT', { dependsOn: [greenAmt, rCost] });
  const fuelH = R.calc('calculate_impact', 'impact.fuel_horizon', 'Motorină economisită pe 7 ani', bL * P.horizonYears, 'L', { dependsOn: [rSaved, horizon] });
  const co2H = R.calc('calculate_impact', 'impact.co2_horizon', 'CO₂ evitat pe 7 ani', ((bL * P.co2PerL) / 1000) * P.horizonYears, 'T_CO2', { dependsOn: [rCo2, horizon] });
  R.tool(A3, 'calculate_impact', 2, { configId: 'cfg_recommended', horizon: 'FROM_CONFIG' }, '🔧 Calculez impactul de mediu', `🔧 ${rSaved.display} motorină, ${rN.display}, ${rCo2.display} evitate`, () => [greenAmt, transAmt, greenPct, fuelH, co2H], {});

  const report = {
    decision: 'ELIGIBLE_WITH_CONDITIONS',
    moduleId: 'utilaje',
    recommendedOptionId: 'B',
    criterion: { indicator: 'FUEL_SAVING_PCT', valueCalcId: rPct.calcId, thresholdCalcId: thr.calcId, result: 'PASS', sourceRo: 'config/modules/utilaje.json: economie de motorină ≥ 20% față de baseline (model BERD GEFF; propunere, de confirmat cu Raiffeisen). Stage V e doar minimul legal.' },
    componentLabels: [
      { componentId: 'cmp_tractors_240', label: 'TRANSITION', basis: 'MEASURABLE_SAVING_NO_LABEL', amountCalcId: o240.calcId, rationaleRo: 'Tractor diesel Stage V care înlocuiește unul de peste 20 de ani: economie măsurabilă, dar echipamentele pe combustibil fosil sunt excluse din cadrul RBI 2025.' },
      { componentId: 'cmp_tractors_180', label: 'TRANSITION', basis: 'MEASURABLE_SAVING_NO_LABEL', amountCalcId: o180.calcId, rationaleRo: 'Ca mai sus.' },
      { componentId: 'cmp_precision', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: rUp.calcId, rationaleRo: 'Ghidajul RTK, section control și doza variabilă reduc motorina și azotul; împreună cu tractoarele noi trec pragul de 20%.' },
    ],
    greenShare: { greenAmountCalcId: greenAmt.calcId, transitionAmountCalcId: transAmt.calcId, greenSharePctCalcId: greenPct.calcId },
    greenBond: { category: 'AGRICULTURE_FORESTRY', status: 'TO_CONFIRM', eligibleAmountCalcId: greenAmt.calcId, noteRo: 'Doar pachetul de precizie poate intra în portofoliul verde; tractoarele diesel sunt excluse. Categoria agricultură trebuie confirmată cu echipa Green Bonds (cadrul RBI 2025).' },
    substantialContribution: 'CLIMATE_MITIGATION',
    dnsh: [
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', justificationRo: 'Investiția nu crește expunerea fermei la riscuri climatice.', evidence: [] },
      { objective: 'WATER_MARINE_RESOURCES', status: 'PASS', justificationRo: 'Doza variabilă reduce scurgerile de azot în apele de suprafață.', evidence: [] },
      { objective: 'CIRCULAR_ECONOMY', status: 'PASS_WITH_CONDITIONS', justificationRo: 'Tractoarele vechi trebuie casate, nu vândute mai departe, ca emisiile să nu se mute în altă fermă.', evidence: [], conditionId: 'cp_scrapping' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS', justificationRo: 'Motoare Stage V, emisii de particule și NOx mult mai mici decât la tractoarele înlocuite.', evidence: ['TECHNICAL_SHEET'] },
      { objective: 'BIODIVERSITY', status: 'PASS', justificationRo: 'Nicio parcelă nu se suprapune cu situri Natura 2000.', evidence: [] },
    ],
    impact: [
      { metric: 'FUEL_SAVED_L', calcId: rSaved.calcId, period: 'ANNUAL' },
      { metric: 'FUEL_SAVING_PCT', calcId: rPct.calcId, period: 'ANNUAL' },
      { metric: 'NITROGEN_SAVED_KG', calcId: rN.calcId, period: 'ANNUAL' },
      { metric: 'CO2_AVOIDED_T', calcId: rCo2.calcId, period: 'ANNUAL' },
      { metric: 'FUEL_SAVED_L', calcId: fuelH.calcId, period: 'HORIZON' },
      { metric: 'CO2_AVOIDED_T', calcId: co2H.calcId, period: 'HORIZON' },
    ],
    conditionsPrecedent: [
      { conditionId: 'cp_no_spending', type: 'OTHER', documentType: 'OTHER', descriptionRo: 'Nicio comandă fermă și niciun avans plătit înainte de depunerea cererii AFIR.', timing: 'BEFORE_SIGNING', blocking: true },
      { conditionId: 'cp_afir_application', type: 'GRANT_APPROVAL', documentType: 'AFIR_APPLICATION', descriptionRo: 'Cererea de finanțare DR-12 depusă la AFIR.', timing: 'BEFORE_SIGNING', dueDate: '2026-12-02', blocking: true },
      { conditionId: 'cp_fgcr', type: 'GUARANTEE_APPROVAL', documentType: 'GUARANTEE_APPROVAL', descriptionRo: 'Aprobarea garanției FGCR pentru creditul de cofinanțare.', timing: 'BEFORE_SIGNING', blocking: true },
      { conditionId: 'cp_competences', type: 'DOCUMENT', documentType: 'OTHER', descriptionRo: 'Dovada competențelor profesionale ale administratorului (ar ridica intensitatea la 80%; plafonul rămâne 200.000 EUR).', timing: 'BEFORE_SIGNING', blocking: false },
      { conditionId: 'cp_afir_contract', type: 'GRANT_APPROVAL', documentType: 'AFIR_FINANCING_CONTRACT', descriptionRo: 'Contractul de finanțare AFIR semnat (pentru tragerea din punte).', timing: 'BEFORE_FIRST_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_final_invoice', type: 'INVOICE_MATCH', documentType: 'FINAL_INVOICE', descriptionRo: 'Factura finală include tractoarele și pachetul de precizie aprobat (RTK, section control, doză variabilă).', timing: 'BEFORE_FINAL_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_scrapping', type: 'DOCUMENT', documentType: 'SCRAPPING_CERTIFICATE', descriptionRo: 'Certificatele de dezmembrare pentru cele 4 tractoare vechi.', timing: 'AFTER_INSTALLATION', blocking: false },
    ],
    monitoringKpis: [
      { kpiId: 'kpi_fuel_use', metric: 'FUEL_USE_L', targetCalcId: rFuelUse.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'OPEN_BANKING', descriptionRo: 'Motorina cumpărată, din tranzacții și facturi, comparată cu estimarea.' },
      { kpiId: 'kpi_nitrogen_use', metric: 'NITROGEN_USE_KG', targetCalcId: rNUse.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'INVOICES', descriptionRo: 'Azotul cumpărat, din facturile de îngrășăminte.' },
      { kpiId: 'kpi_precision_use', metric: 'AREA_HA', targetCalcId: area.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'TELEMATICS', descriptionRo: 'Hectarele lucrate cu ghidaj RTK, din jurnalul terminalului.' },
      { kpiId: 'kpi_satellite', metric: 'AREA_HA', targetCalcId: area.calcId, frequency: 'SEMIANNUAL', firstDue: 'MONTH_6', dataSource: 'SATELLITE', descriptionRo: 'Parcelele sunt cultivate (Sentinel-2).' },
    ],
    risks: [
      { category: 'GRANT_TIMING', severity: 'MEDIUM', descriptionRo: 'Puntea se rambursează din grant; o plată AFIR întârziată prelungește puntea.', mitigationRo: 'Cesiunea grantului către bancă; puntea se poate prelungi o dată.' },
      { category: 'GRANT_REJECTION', severity: 'MEDIUM', descriptionRo: 'Proiectul poate cădea sub pragul de selecție de 80 de puncte.', mitigationRo: 'Precizia aduce +15 puncte; varianta de rezervă e creditul cu garanție FGCR pentru toată suma.' },
      { category: 'GREENWASHING', severity: 'LOW', descriptionRo: 'Tractoarele diesel ar putea fi raportate greșit ca verzi.', mitigationRo: 'Etichetare pe componente: tractoarele sunt tranziție, doar precizia e verde.' },
      { category: 'AFFORDABILITY', severity: 'LOW', descriptionRo: `Opțiunea B folosește ${bRatio.display} din cashflow-ul net.`, mitigationRo: 'Marjă confortabilă sub limita de 40%.' },
    ],
    committeeSummaryRo: `Fermă de cereale, 400 ha, administrator de 38 de ani. Cererea inițială (4 tractoare Stage V, 440.000 EUR) economisea 12,0% motorină, sub pragul de 20%. Cu pachetul de precizie (52.000 EUR) economia ajunge la 20,8%: ${rSaved.display}, ${rN.display}, ${rCo2.display}. Etichete: tractoarele sunt tranziție (440.000 EUR), precizia e verde de piață (52.000 EUR, 10,6%). Structură: grant DR-12 200.000 EUR, credit de cofinanțare 292.000 EUR cu FGCR 80%, punte 200.000 EUR rambursată din grant. Rata scade de la ${aInst.display} la ${bInst.display}; avantaj net ${cmpAdv.display} pe 7 ani. Recomandare: eligibil cu condiții (depunerea DR-12 până la 02.12.2026).`,
    farmerNextSteps: [
      { stepRo: 'Nu semna contractul cu dealerul și nu plăti avans până nu depui cererea la AFIR.', conditionId: 'cp_no_spending' },
      { stepRo: 'Depune cererea DR-12 la AFIR.', dueDate: '2026-12-02', conditionId: 'cp_afir_application' },
      { stepRo: 'Trimite dovada competențelor profesionale, dacă o ai.', conditionId: 'cp_competences' },
      { stepRo: 'Cere dealerului oferta care include pachetul de precizie.' },
      { stepRo: 'După livrare: certificatele de dezmembrare pentru tractoarele vechi.', conditionId: 'cp_scrapping' },
    ],
  };
  R.completed(A3, 'submit_underwriting_report', '✅ Agentul 3 a terminat: eligibil cu condiții; tractoare = tranziție, precizie = verde de piață', report, 3, 24800, 'RETRY');

  R.state('AGENT_3', 'GATA', 'Ofertele sunt gata; fermierul alege varianta și trimite cererea', {}, 300);
  const t0 = Date.parse('2026-10-28T10:15:00.000Z');
  R.emit('run.completed', null, `Analiză completă: eligibil cu condiții, recomandăm B (+${cmpAdv.display} în 7 ani)`, {
    state: 'GATA', durationMs: R.t - t0 + 200, decision: 'ELIGIBLE_WITH_CONDITIONS', recommendedOptionId: 'B', netAdvantageCalcId: cmpAdv.calcId,
    sources: { TECHNICAL_AUDITOR: 'LIVE', FUNDING_OPTIMIZER: 'LIVE', GREEN_UNDERWRITER: 'RETRY' },
  }, 200);

  return { R, assessment, funding, report, extractions: [extractionOffer, extractionFuel] };
}

// =====================================================================
// Examples for openapi.yaml (Prism mock)
// =====================================================================

function rect(lon, lat, wDeg, hDeg) {
  return { type: 'Polygon', coordinates: [[[lon, lat], [round(lon + wDeg, 5), lat], [round(lon + wDeg, 5), round(lat + hDeg, 5)], [lon, round(lat + hDeg, 5)], [lon, lat]]] };
}

const MONTH_LABELS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

function cashflow(netByCalendarMonth, inflowBase) {
  const months = MONTH_LABELS.map((label) => {
    const m = Number(label.slice(5)) - 1;
    const net = netByCalendarMonth[m];
    const inflow = Math.max(net, 0) + inflowBase;
    return { month: label, inflowEur: inflow, outflowEur: inflow - net, netEur: net };
  });
  const total = months.reduce((s, m) => s + m.netEur, 0);
  return { months, annualNetEur: total, avgMonthlyNetEur: round(total / 12), peakMonths: MONTHS.filter((_, i) => netByCalendarMonth[i] >= Math.max(...netByCalendarMonth) * 0.45), source: 'OPEN_BANKING', mode: 'MOCK' };
}

function farmIrigatii() {
  const parcels = [
    ['ct_0412_01', 28.452, 44.168, 'tomate', false],
    ['ct_0412_02', 28.4555, 44.168, 'ardei', false],
    ['ct_0412_03', 28.459, 44.168, 'castraveți', false],
    ['ct_0415_01', 28.452, 44.1725, 'varză', true],
    ['ct_0415_02', 28.4555, 44.1725, 'ceapă', true],
  ];
  return {
    cui: '45871203',
    company: { cui: '45871203', name: 'Legume Dobrogea Verde SRL', legalForm: 'SRL', caen: '0113', caenLabelRo: 'Cultivarea legumelor, a pepenilor, a rădăcinoaselor și tuberculilor', county: 'Constanța', locality: 'Valu lui Traian', registeredAt: '2014-03-12', employees: 14, turnoverEur: 486000, netProfitEur: 61000, totalAssetsEur: 1320000, financialYear: 2025, vatPayer: true, smeStatus: 'SME', manager: { age: 52, installedAt: '2014-03-12' } },
    farm: { totalHa: 40, standardOutputEur: 412000, irrigatedNow: true, currentIrrigation: 'ASPERSIE_VECHE', crops: [{ year: 2026, crop: 'legume în câmp', ha: 40, yieldTPerHa: 38 }, { year: 2025, crop: 'legume în câmp', ha: 40, yieldTPerHa: 35 }, { year: 2024, crop: 'legume în câmp', ha: 38, yieldTPerHa: 31 }], livestock: [], apiaSubsidiesEur: 9800 },
    parcels: {
      type: 'FeatureCollection',
      features: parcels.map(([id, lon, lat, crop, nvz]) => ({
        type: 'Feature', id, geometry: rect(lon, lat, 0.0035, 0.0036),
        properties: { parcelId: id, blockId: `BF-${id.slice(3, 7)}`, areaHa: 8, crop, natura2000: false, nitrateVulnerable: nvz, droughtRisk: 'HIGH', hailRisk: 'MEDIUM', floodRisk: 'LOW', waterStress: 'HIGH' },
      })),
    },
    cashflow: cashflow([-4000, -5500, -7000, -6000, 2000, 9000, 22000, 26000, 24000, 18000, 9000, 10900], 6000),
    dataSources: [
      { source: 'ANAF', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:00Z' }, { source: 'APIA', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:00Z' },
      { source: 'OPEN_BANKING', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:01Z' }, { source: 'COPERNICUS', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:01Z' },
      { source: 'NATURA_2000', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:01Z' }, { source: 'NITRATES', mode: 'MOCK', fetchedAt: '2026-10-28T09:30:01Z' },
    ],
  };
}

function farmUtilaje() {
  const parcels = [
    ['cl_1001', 27.302, 44.301, 'grâu'],
    ['cl_1002', 27.3146, 44.301, 'porumb'],
    ['cl_1003', 27.302, 44.31, 'floarea-soarelui'],
    ['cl_1004', 27.3146, 44.31, 'rapiță'],
  ];
  return {
    cui: '38264019',
    company: { cui: '38264019', name: 'Agro Câmpia Bărăganului SRL', legalForm: 'SRL', caen: '0111', caenLabelRo: 'Cultivarea cerealelor (exclusiv orez), plantelor leguminoase și a plantelor producătoare de semințe oleaginoase', county: 'Călărași', locality: 'Dragalina', registeredAt: '2023-02-20', employees: 9, turnoverEur: 612000, netProfitEur: 88000, totalAssetsEur: 2480000, financialYear: 2025, vatPayer: true, smeStatus: 'SME', manager: { age: 38, installedAt: '2023-02-20' } },
    farm: { totalHa: 400, standardOutputEur: 236000, irrigatedNow: false, currentIrrigation: 'NU', crops: [{ year: 2026, crop: 'grâu', ha: 100, yieldTPerHa: 6.1 }, { year: 2026, crop: 'porumb', ha: 100, yieldTPerHa: 7.4 }, { year: 2026, crop: 'floarea-soarelui', ha: 100, yieldTPerHa: 2.8 }, { year: 2026, crop: 'rapiță', ha: 100, yieldTPerHa: 3.2 }], livestock: [], apiaSubsidiesEur: 98000 },
    parcels: {
      type: 'FeatureCollection',
      features: parcels.map(([id, lon, lat, crop]) => ({
        type: 'Feature', id, geometry: rect(lon, lat, 0.0126, 0.009),
        properties: { parcelId: id, blockId: `BF-${id.slice(3)}`, areaHa: 100, crop, natura2000: false, nitrateVulnerable: false, droughtRisk: 'MEDIUM', hailRisk: 'MEDIUM', floodRisk: 'LOW', waterStress: 'MEDIUM' },
      })),
    },
    cashflow: cashflow([-8000, -9000, -14000, -12000, -6000, 4000, 78000, 52000, 38000, 46000, 22000, 19000], 15000),
    dataSources: [
      { source: 'ANAF', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:00Z' }, { source: 'APIA', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:00Z' },
      { source: 'OPEN_BANKING', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' }, { source: 'COPERNICUS', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' },
      { source: 'NATURA_2000', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' }, { source: 'NITRATES', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' },
    ],
  };
}

const COMMON_DOCS = [
  { docType: 'OFFER', labelRo: 'Oferta / proforma și fișa tehnică a investiției noi', required: true },
  { docType: 'CURRENT_EQUIPMENT', labelRo: 'Ce se înlocuiește: fișă tehnică, poză cu eticheta sau descriere', required: false },
];
const COMMON_QUESTIONS = [
  { questionId: 'crops_main', labelRo: 'Culturile principale și producția medie (t/ha) pe ultimii 3 ani', type: 'TEXT', prefillFrom: 'APIA', required: true },
  { questionId: 'nitrogen_kg_ha', labelRo: 'Câte îngrășăminte cu azot folosiți (kg N/ha)?', type: 'NUMBER', unit: 'KG_N_PER_HA', prefillFrom: 'NONE', required: true },
  { questionId: 'tillage', labelRo: 'Cum lucrați solul?', type: 'SINGLE_CHOICE', options: [{ value: 'ARATURA', labelRo: 'arătură' }, { value: 'MINIMA', labelRo: 'lucrare minimă' }, { value: 'NO_TILL', labelRo: 'no-till' }], prefillFrom: 'NONE', required: true },
  { questionId: 'cover_crops', labelRo: 'Folosiți culturi de acoperire sau rotație?', type: 'SINGLE_CHOICE', options: [{ value: 'DA', labelRo: 'da' }, { value: 'ROTATIE', labelRo: 'doar rotație' }, { value: 'NU', labelRo: 'nu' }], prefillFrom: 'APIA', required: false },
  { questionId: 'irrigation_current', labelRo: 'Irigați acum? Cu ce sistem?', type: 'SINGLE_CHOICE', options: [{ value: 'NU', labelRo: 'nu irig' }, { value: 'ASPERSIE_VECHE', labelRo: 'aspersie veche' }, { value: 'ASPERSIE', labelRo: 'aspersie' }, { value: 'PICURARE', labelRo: 'picurare' }, { value: 'BRAZDE', labelRo: 'pe brazde' }], prefillFrom: 'APIA', required: true },
  { questionId: 'crop_insurance', labelRo: 'Aveți asigurare pentru culturi?', type: 'BOOLEAN', prefillFrom: 'NONE', required: true },
  { questionId: 'certifications', labelRo: 'Aveți certificări?', type: 'MULTI_CHOICE', options: [{ value: 'ECOLOGIC', labelRo: 'ecologic' }, { value: 'GLOBALGAP', labelRo: 'GlobalGAP' }, { value: 'NICIUNA', labelRo: 'niciuna' }], prefillFrom: 'NONE', required: false },
  { questionId: 'offtake_contracts', labelRo: 'Aveți contracte de vânzare cu procesatori sau retaileri?', type: 'BOOLEAN', prefillFrom: 'NONE', required: false },
  { questionId: 'cashin_months', labelRo: 'În ce luni încasați cel mai mult?', type: 'MONTHS', prefillFrom: 'OPEN_BANKING', required: true },
  { questionId: 'old_equipment_fate', labelRo: 'Ce faceți cu utilajul vechi și cu deșeurile (ambalaje, folie)?', type: 'SINGLE_CHOICE', options: [{ value: 'CASARE', labelRo: 'casare' }, { value: 'VANZARE', labelRo: 'vânzare' }, { value: 'REZERVA', labelRo: 'îl păstrez ca rezervă' }, { value: 'NU_E_CAZUL', labelRo: 'nu e cazul' }], prefillFrom: 'NONE', required: true },
];

function modules() {
  const mod = (id, nameRo, icon, status, indicator, threshold, descriptionRo, docs, examplesRo, extraQuestions = []) => ({
    moduleId: id, nameRo, icon, status, descriptionRo, examplesRo, indicator, threshold,
    requiredDocs: [...COMMON_DOCS, ...docs], questionnaire: [...COMMON_QUESTIONS, ...extraQuestions],
  });
  return [
    mod('irigatii', 'Irigații', '💧', 'DEMO_READY', 'WATER_SAVING_PCT', { kind: 'MIN_PCT', value: 25, unit: 'PCT', sourceRo: 'config/modules/irigatii.json (propunere, de confirmat cu Raiffeisen)', demo: true }, 'Picurare, aspersie cu senzori, pompe solare.', [{ docType: 'WATER_PERMIT_ANAR', labelRo: 'Autorizația de gospodărire a apelor (ANAR)', required: true }, { docType: 'ENERGY_INVOICES', labelRo: 'Consumul actual de apă sau energia de pompare (12 luni)', required: true }], ['picurare', 'aspersie cu senzori'], [{ questionId: 'water_source', labelRo: 'De unde luați apa?', type: 'SINGLE_CHOICE', options: [{ value: 'ANIF', labelRo: 'rețeaua ANIF' }, { value: 'PUT', labelRo: 'puț propriu' }, { value: 'RAU_LAC', labelRo: 'râu sau lac' }, { value: 'BAZIN', labelRo: 'bazin de acumulare' }], prefillFrom: 'NONE', required: true }]),
    mod('energie', 'Energie la fermă', '☀️', 'CONFIG_ONLY', 'RENEWABLE_GENERATION', { kind: 'BY_NATURE', value: null, unit: null, sourceRo: 'regenerabil prin natura investiției', demo: true }, 'Panouri solare, pompe solare, agrivoltaic.', [{ docType: 'ENERGY_INVOICES', labelRo: 'Facturile de energie pe 12 luni', required: true }], ['panouri solare', 'agrivoltaic']),
    mod('utilaje', 'Utilaje & precizie', '🚜', 'DEMO_READY', 'FUEL_SAVING_PCT', { kind: 'MIN_PCT', value: 20, unit: 'PCT', sourceRo: 'config/modules/utilaje.json (propunere; −20% motorină sau îngrășăminte / ha)', demo: true }, 'Tractoare eficiente, GPS, dozare variabilă.', [{ docType: 'FUEL_INVOICES', labelRo: 'Facturile de motorină pe 12 luni', required: true }, { docType: 'FERTILIZER_INVOICES', labelRo: 'Facturile de îngrășăminte pe 12 luni', required: false }], ['tractoare eficiente', 'ghidaj GPS', 'doză variabilă'], [{ questionId: 'hours_per_year', labelRo: 'Câte ore lucrează un tractor pe an?', type: 'NUMBER', unit: 'HOURS', prefillFrom: 'NONE', required: false }, { questionId: 'manager_competences', labelRo: 'Administratorul are studii sau un curs de calificare în agricultură?', type: 'BOOLEAN', prefillFrom: 'NONE', required: false }]),
    mod('zootehnie', 'Zootehnie & biogaz', '🐄', 'CONFIG_ONLY', 'EMISSION_REDUCTION_PCT', { kind: 'MIN_PCT', value: 20, unit: 'PCT', sourceRo: 'reducere emisii + valorificare deșeuri (demo)', demo: true }, 'Digestor, stocarea gunoiului de grajd.', [{ docType: 'CURRENT_EQUIPMENT', labelRo: 'Sistemul actual de stocare a gunoiului de grajd', required: true }, { docType: 'ENVIRONMENTAL_PERMIT', labelRo: 'Autorizația de mediu', required: true }], ['digestor', 'stocare gunoi de grajd']),
    mod('post_recolta', 'Post-recoltă', '❄️', 'CONFIG_ONLY', 'ENERGY_SAVING_PCT', { kind: 'MIN_PCT', value: 20, unit: 'PCT', sourceRo: 'economie de energie ≥ 20% (demo)', demo: true }, 'Depozite frigorifice, uscătoare, sere.', [{ docType: 'ENERGY_INVOICES', labelRo: 'Facturile de energie pe 12 luni și capacitatea de stocare', required: true }], ['depozit frigorific', 'uscător', 'seră']),
    mod('ecologic', 'Ecologic & regenerativ', '🌱', 'CONFIG_ONLY', 'CERTIFIED_AREA_HA', { kind: 'CERTIFICATION', value: null, unit: 'HA', sourceRo: 'certificare ecologică UE', demo: true }, 'Conversie bio, culturi de acoperire.', [{ docType: 'CERTIFICATION_CONTRACT', labelRo: 'Contractul cu organismul de certificare sau certificatul', required: true }, { docType: 'BUSINESS_PLAN', labelRo: 'Planul de conversie', required: true }], ['conversie bio', 'culturi de acoperire']),
  ];
}

function runView(built, { cui, moduleId, scenario, farm, documents, questionnaire, parcelIds, submission, officerActions }) {
  const { R } = built;
  const last = R.events[R.events.length - 1];
  const states = R.events.filter((e) => e.type === 'state.transition');
  const agentStatus = [A1, A2, A3].map((agent) => {
    const started = R.events.find((e) => e.agent === agent && e.type === 'agent.started');
    const done = R.events.find((e) => e.agent === agent && e.type === 'agent.completed');
    const degraded = R.events.some((e) => e.agent === agent && e.type === 'agent.degraded');
    return { agent, status: degraded ? 'DEGRADED' : 'COMPLETED', source: done.data.source, startedAt: started.at, completedAt: done.at };
  });
  return {
    runId: R.runId, cui, moduleId, scenario, state: states[states.length - 1].data.to, mode: 'LIVE',
    createdAt: R.events[0].at, updatedAt: last.at, lastEventSeq: last.seq,
    farm, parcelIds, documents, questionnaire, agentStatus,
    agents: { extractions: built.extractions, technicalAssessment: built.assessment, fundingRecommendation: built.funding, underwritingReport: built.report },
    calcs: Object.fromEntries(R.calcs),
    submission, officerActions, pendingDocuments: [], error: null,
  };
}

// ---------- write ----------

const irg = buildIrigatii();
const utl = buildUtilaje();
mkdirSync(join(ROOT, 'fixtures'), { recursive: true });
mkdirSync(join(ROOT, 'examples'), { recursive: true });
writeFileSync(join(ROOT, 'fixtures/irigatii.ndjson'), irg.R.ndjson());
writeFileSync(join(ROOT, 'fixtures/utilaje.ndjson'), utl.R.ndjson());

const example = (summary, value) => JSON.stringify({ summary, value }, null, 2) + '\n';
const fIrg = farmIrigatii();
const fUtl = farmUtilaje();
writeFileSync(join(ROOT, 'examples/modules.json'), example('Cele 6 module', modules()));
writeFileSync(join(ROOT, 'examples/farm-irigatii.json'), example('Fermă de legume, 40 ha, Constanța', fIrg));
writeFileSync(join(ROOT, 'examples/farm-utilaje.json'), example('Fermă de cereale, 400 ha, Călărași', fUtl));
const transitionAt = (built, to) => built.R.events.find((e) => e.type === 'state.transition' && e.data.to === to).at;
writeFileSync(join(ROOT, 'examples/run-irigatii.json'), example('Dosarul demo de irigații, trimis și aprobat (din fixtures/irigatii.ndjson)', runView(irg, {
  cui: fIrg.cui, moduleId: 'irigatii', scenario: 'irigatii', farm: fIrg,
  parcelIds: fIrg.parcels.features.map((f) => f.id),
  documents: [
    { documentId: 'doc_oferta_aspersie', docType: 'OFFER', fileName: 'oferta-aquaflux-aspersie.pdf', sizeBytes: 482113 },
    { documentId: 'doc_aviz_anar', docType: 'WATER_PERMIT_ANAR', fileName: 'aviz-anar-312-2024.pdf', sizeBytes: 211874 },
    { documentId: 'doc_facturi_energie', docType: 'ENERGY_INVOICES', fileName: 'facturi-energie-12-luni.pdf', sizeBytes: 1290455 },
  ],
  questionnaire: { crops_main: 'tomate, ardei, castraveți, varză, ceapă; 35-38 t/ha', nitrogen_kg_ha: 180, tillage: 'MINIMA', cover_crops: 'ROTATIE', irrigation_current: 'ASPERSIE_VECHE', crop_insurance: false, certifications: ['GLOBALGAP'], offtake_contracts: true, cashin_months: ['JUL', 'AUG', 'SEP', 'OCT'], old_equipment_fate: 'VANZARE', water_source: 'ANIF' },
  submission: { variant: 'VERDE', optionId: 'B', submittedAt: transitionAt(irg, 'TRIMIS') },
  officerActions: [{ action: 'APPROVE', at: transitionAt(irg, 'APROBAT'), officerId: 'ofiter.demo', commentRo: 'Aprobat cu condițiile din raport.' }],
})));
writeFileSync(join(ROOT, 'examples/run-utilaje.json'), example('Dosarul demo de utilaje, cu ofertele gata (din fixtures/utilaje.ndjson)', runView(utl, {
  cui: fUtl.cui, moduleId: 'utilaje', scenario: 'utilaje', farm: fUtl,
  parcelIds: fUtl.parcels.features.map((f) => f.id),
  documents: [
    { documentId: 'doc_oferta_tractoare', docType: 'OFFER', fileName: 'oferta-agrotrac-tractoare.pdf', sizeBytes: 655302 },
    { documentId: 'doc_facturi_motorina', docType: 'FUEL_INVOICES', fileName: 'facturi-motorina-12-luni.pdf', sizeBytes: 988120 },
  ],
  questionnaire: { crops_main: 'grâu 6,1 t/ha; porumb 7,4 t/ha; floarea-soarelui 2,8 t/ha; rapiță 3,2 t/ha', nitrogen_kg_ha: 150, tillage: 'ARATURA', cover_crops: 'ROTATIE', irrigation_current: 'NU', crop_insurance: true, certifications: ['NICIUNA'], offtake_contracts: true, cashin_months: ['JUL', 'AUG', 'SEP', 'OCT'], old_equipment_fate: 'CASARE', hours_per_year: 650, manager_competences: false },
  submission: null,
  officerActions: [],
})));

const show = (b) => {
  const c = (k) => [...b.R.calcs.values()].find((x) => x.key === k)?.display;
  return `${b.R.runId}: ${b.R.events.length} events, ${b.R.calcs.size} calcs | A ${c('option_a.installment')} | B ${c('option_b.installment')} | net ${c('compare.net_advantage')} | payback ${c('compare.upgrade_payback')}`;
};
console.log(show(irg));
console.log(show(utl));
