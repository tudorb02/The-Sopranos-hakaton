// Generates contracts/fixtures/*.ndjson and contracts/examples/*.json.
// The figures follow the formulas of README §4 and §6, recomputed here in JS independently of the Java engine;
// ToolChainTest checks the engine against the same values.
// Run: npm run gen   (then npm run validate)
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  HA: ' ha', HP: ' CP', HP_PER_HA: ' CP/ha', KW: ' kW', KWP: ' kWp', M: ' m', MONTHS: ' luni', YEARS: ' ani', EUR_PER_KG: ' EUR/kg',
  COUNT: ' buc', POINTS: ' puncte',
};
const UNIT_DECIMALS = {
  PCT: 1, RATIO: 2, T_CO2: 1, T_CO2_PER_YEAR: 1, KG_CO2_PER_L: 2, KG_CO2_PER_KWH: 3, EUR_PER_L: 3,
  EUR_PER_M3: 2, EUR_PER_KWH: 2, EUR_PER_KG: 2, KWH_PER_M3: 2, HP_PER_HA: 2, MONTHS: 0,
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

// README §4 step 8, in the order of the Java GreenTierCalculator: CLASIC, VERDE_PLUS, VERDE_CU_UPGRADE, VERDE.
const DNSH_ORDER = ['PASS', 'PASS_WITH_CONDITIONS', 'MISSING_DATA', 'FAIL'];
const worstDnsh = (checks) => DNSH_ORDER[Math.max(...checks.map((c) => DNSH_ORDER.indexOf(c.status)))];
function greenTierOf(thresholdPct, multiplier, requestedPct, financedPct, dnsh) {
  if (financedPct < thresholdPct || dnsh === 'FAIL') return 'CLASIC';
  if (financedPct >= thresholdPct * multiplier && dnsh === 'PASS') return 'VERDE_PLUS';
  return requestedPct < thresholdPct ? 'VERDE_CU_UPGRADE' : 'VERDE';
}

// README §4 step 7: (annual net cash flow + annual savings) / debt service of the heaviest full loan year.
function dscrOf(series, annualNetCf, savingsYear) {
  const payments = series.map((p) => p.values.payment);
  const years = payments.length < 12 ? [payments]
    : Array.from({ length: Math.floor(payments.length / 12) }, (_, y) => payments.slice(y * 12, (y + 1) * 12));
  const heaviest = Math.max(...years.map((year) => year.reduce((sum, v) => sum + v, 0)));
  return { heaviest, dscr: (annualNetCf + savingsYear) / heaviest };
}

// README §6.1: NIR = Σ max(0, Kc × ET₀ − P_ef) × 10 × ha; V = NIR × (1 − s) / η; kWh = V × (H_lift + H_pressure) × k / η_pump.
const K_PUMP = 0.002725;
const netNeedM3 = (crops, et0Mm, rainMm) => crops.reduce((sum, c) => sum + Math.max(0, c.kc * et0Mm - rainMm) * 10 * c.ha, 0);
const withdrawalM3 = (need, efficiency, sensors = 0) => (need * (1 - sensors)) / efficiency;
const pumpingKwh = (m3, liftM, pressureM, pumpEfficiency) => (m3 * (liftM + pressureM) * K_PUMP) / pumpEfficiency;

// README §4 step 6, the values of config/pricing.json.
const PRICING = {
  index: 2.0, funding: 1.2, pd: 3.0, lgd: 45, rwClient: 75, rwGuarantor: 0, capitalRatio: 12, costOfCapital: 12,
  operational: 1.5, profit: 1.77, greenPd: 2.5, fundingAdj: -0.3, operationalAdj: -0.15, subsidy: -0.4,
  tierAdj: { VERDE_PLUS: 0, VERDE: 0.2, VERDE_CU_UPGRADE: 0.2 },
};
function priceClassic() {
  const risk = (PRICING.pd * PRICING.lgd) / 100;
  const capital = (PRICING.rwClient / 100) * PRICING.capitalRatio * (PRICING.costOfCapital / 100);
  const margin = PRICING.funding + risk + capital + PRICING.operational + PRICING.profit;
  return { green: false, index: PRICING.index, funding: PRICING.funding, risk, capital, operational: PRICING.operational, profit: PRICING.profit, subsidy: 0, tier: 0, coverage: 0, rwEff: PRICING.rwClient, margin, rate: PRICING.index + margin };
}
function priceGreen(coveragePct, tierName) {
  const g = coveragePct / 100;
  const rwEff = PRICING.rwClient * (1 - g) + PRICING.rwGuarantor * g;
  const risk = PRICING.greenPd * (PRICING.lgd / 100) * (1 - g);
  const capital = (rwEff / 100) * PRICING.capitalRatio * (PRICING.costOfCapital / 100);
  const funding = PRICING.funding + PRICING.fundingAdj;
  const operational = PRICING.operational + PRICING.operationalAdj;
  const tier = PRICING.tierAdj[tierName];
  const margin = funding + risk + capital + operational + PRICING.profit + PRICING.subsidy + tier;
  return { green: true, index: PRICING.index, funding, risk, capital, operational, profit: PRICING.profit, subsidy: PRICING.subsidy, tier, coverage: coveragePct, rwEff, margin, rate: PRICING.index + margin };
}
// The calcs of price_loan for one option and the rate block of submit_funding_recommendation.
function rateCalcs(R, prefix, p) {
  const c = {
    index: R.calc('price_loan', `${prefix}.index`, 'Indice EURIBOR 3M', p.index, 'PCT', { decimals: 2, sourceRo: 'config/pricing.json (valoare demo)' }),
    funding: R.calc('price_loan', `${prefix}.funding_cost`, 'Cost de finanțare', p.funding, 'PCT', { decimals: 2, sourceRo: 'config/pricing.json (valoare demo)' }),
    risk: R.calc('price_loan', `${prefix}.risk_cost`, 'Cost de risc', p.risk, 'PCT', { decimals: 2, formula: 'PD × LGD × (1 − g)' }),
    capital: R.calc('price_loan', `${prefix}.capital_cost`, 'Cost de capital', p.capital, 'PCT', { decimals: 2, formula: 'RW efectiv × rata de capital × costul capitalului' }),
    operational: R.calc('price_loan', `${prefix}.operational_cost`, 'Cost operațional', p.operational, 'PCT', { decimals: 2 }),
    profit: R.calc('price_loan', `${prefix}.target_profit`, 'Profit țintă', p.profit, 'PCT', { decimals: 2 }),
  };
  if (p.green) {
    c.coverage = R.calc('price_loan', `${prefix}.guarantee_coverage`, 'Partea acoperită de garanție (g)', p.coverage, 'PCT', { decimals: 2 });
    c.rwEff = R.calc('price_loan', `${prefix}.effective_risk_weight`, 'Ponderea de risc efectivă', p.rwEff, 'PCT', { decimals: 2, formula: 'RW client × (1 − g) + RW garant × g' });
    c.subsidy = R.calc('price_loan', `${prefix}.program_subsidy`, 'Subvenție sau comision redus pe program', p.subsidy, 'PCT', { decimals: 2 });
    c.tier = R.calc('price_loan', `${prefix}.tier_adjustment`, 'Ajustarea pentru nivelul verde', p.tier, 'PCT', { decimals: 2 });
  }
  c.margin = R.calc('price_loan', `${prefix}.margin`, 'Marja', p.margin, 'PCT', { decimals: 2, formula: 'finanțare + risc + capital + operațional + profit (+ subvenție + nivel verde)', dependsOn: [c.funding, c.risk, c.capital, c.operational, c.profit] });
  c.rate = R.calc('price_loan', prefix, p.green ? 'Dobânda creditului verde' : 'Dobânda creditului', p.rate, 'PCT', { decimals: 2, formula: 'indice + marjă', dependsOn: [c.index, c.margin] });
  c.block = {
    indexCalcId: c.index.calcId, fundingCostCalcId: c.funding.calcId, riskCostCalcId: c.risk.calcId, capitalCostCalcId: c.capital.calcId,
    operationalCostCalcId: c.operational.calcId, targetProfitCalcId: c.profit.calcId,
    ...(p.green ? { programSubsidyCalcId: c.subsidy.calcId, tierAdjustmentCalcId: c.tier.calcId, guaranteeCoverageCalcId: c.coverage.calcId, effectiveRiskWeightCalcId: c.rwEff.calcId } : {}),
    marginCalcId: c.margin.calcId, rateCalcId: c.rate.calcId,
  };
  return c;
}
function rateDiffCalcs(R, classic, green) {
  const d = (key, label, v) => R.calc('price_loan', `pricing.diff.${key}`, `Verde față de clasic: ${label}`, v, 'PCT', { decimals: 2 });
  const drivers = [
    ['FUNDING', d('funding_cost', 'cost de finanțare (obligațiuni verzi)', green.funding - classic.funding)],
    ['RISK', d('risk_cost', 'cost de risc (garanția FEI și PD mai mic)', green.risk - classic.risk)],
    ['CAPITAL', d('capital_cost', 'cost de capital (ponderea de risc a garantului)', green.capital - classic.capital)],
    ['OPERATIONAL', d('operational_cost', 'cost operațional (analiză automată)', green.operational - classic.operational)],
    ['PROGRAM_SUBSIDY', d('program_subsidy', 'subvenție pe program', green.subsidy - classic.subsidy)],
    ['TIER_ADJUSTMENT', d('tier_adjustment', 'nivelul verde', green.tier - classic.tier)],
  ];
  const total = R.calc('price_loan', 'pricing.diff.rate', 'Dobânda verde față de cea clasică', green.rate - classic.rate, 'PCT', { decimals: 2, formula: 'dobânda verde − dobânda clasică' });
  return { total, calcs: drivers.map(([, c]) => c), rateDrivers: drivers.map(([component, c]) => ({ component, calcId: c.calcId })) };
}
// Payments per calendar month of the first loan year, for the 40% check (first 12 periods of the schedule).
const firstYearPayments = (series) => series.slice(0, 12).reduce((sum, p) => sum + p.values.payment, 0);

// =====================================================================
// Scenario 1: irigatii — 40 ha vegetable farm, south-east, furrows
// =====================================================================

function buildIrigatii() {
  const R = new RunBuilder('run_irg7k2xq4m9p', '2026-10-28T09:30:00.000Z');
  // README §6.1 and §12: 40 ha of vegetables in the south-east, irrigated by furrows from a 35 m well, asking for a
  // classic sprinkler. Kc per crop, the climate of the zone and the systems are those of config/modules/irigatii.json.
  const P = {
    crops: [
      { parcelId: 'ct_0412_01', crop: 'tomate', ha: 8, kc: 0.85 }, { parcelId: 'ct_0412_02', crop: 'ardei', ha: 8, kc: 0.8 },
      { parcelId: 'ct_0412_03', crop: 'castraveți', ha: 8, kc: 0.8 }, { parcelId: 'ct_0415_01', crop: 'varză', ha: 8, kc: 0.75 },
      { parcelId: 'ct_0415_02', crop: 'ceapă', ha: 8, kc: 0.75 },
    ],
    areaHa: 40, et0Mm: 700, rainMm: 200, liftM: 35, pumpEff: 0.65,
    effFurrows: 0.6, effSprinkler: 0.75, effDrip: 0.9, sensors: 0.1, pressureFurrows: 0, pressureSprinkler: 35, pressureDrip: 15,
    waterPrice: 0.02, elecPrice: 0.2, gridFactor: 0.26, threshold: 25, invoiceKwh: 36900, pvYield: 1280,
    offer: 85000, offerSprinklers: 49000, offerPump: 14500, offerPipes: 15800, offerWorks: 5700,
    drip: 90800, sensorCost: 6500, meter: 1200,
    term: 60, feiCoverage: 70, mortgageInitial: 1450, mortgageAnnual: 380, horizonYears: 5, annualNetCf: 98400, affordLimit: 40,
    permitM3: 240000, cashinMonths: ['JUL', 'AUG', 'SEP', 'OCT'],
  };
  const parcelIds = P.crops.map((c) => c.parcelId);

  R.state(null, 'CREAT', 'Dosar creat: irigații, 40 ha, 3 documente încărcate', { actor: 'FARMER' }, 0);
  R.state('CREAT', 'DATE_FIRMA', 'Am preluat datele firmei: ANAF, APIA, Open Banking, risc climatic', {
    dataSources: [
      { source: 'ANAF', mode: 'MOCK' }, { source: 'APIA', mode: 'MOCK' }, { source: 'OPEN_BANKING', mode: 'MOCK' },
      { source: 'COPERNICUS', mode: 'MOCK' }, { source: 'NATURA_2000', mode: 'MOCK' }, { source: 'NITRATES', mode: 'MOCK' },
    ],
  }, 1200);
  R.state('DATE_FIRMA', 'AGENT_1', 'Pornește auditorul tehnic', {}, 300);
  R.started(A1, 'AGENT_1', 'Agentul 1 (auditor tehnic) a pornit');

  // --- extraction ---
  const offerTotal = R.calc('extract_document', 'doc.offer.total_net', 'Valoare ofertă aspersie (fără TVA)', P.offer, 'EUR', { sourceRo: 'Oferta AquaFlux OF-2026-1147, pag. 2' });
  const offerEff = R.calc('extract_document', 'doc.offer.efficiency', 'Eficiență de aplicare declarată (aspersie)', P.effSprinkler * 100, 'PCT', { sourceRo: 'Oferta AquaFlux, fișa tehnică, pag. 3' });
  const offerArea = R.calc('extract_document', 'doc.offer.area', 'Suprafață irigată în ofertă', P.areaHa, 'HA', { sourceRo: 'Oferta AquaFlux, pag. 1' });
  const offerSprinklerCost = R.calc('extract_document', 'doc.offer.line.sprinkler_system', 'Instalații cu tambur', P.offerSprinklers, 'EUR', { sourceRo: 'Oferta AquaFlux, poziția 1' });
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
      field('APPLICATION_EFFICIENCY_PCT', '75%', 'PCT', 3),
      field('OPERATING_PRESSURE_BAR', '3,5 bar', 'BAR', 3),
      field('WATER_SOURCE', 'puț forat propriu, nivel dinamic la 35 m', 'TEXT', 1, 'MEDIUM'),
    ],
    lineItems: [
      { lineId: 'ln_1', category: 'IRRIGATION_SPRINKLER', descriptionRo: 'Instalație de irigat cu tambur 110/400, 2 buc.', fields: [field('QUANTITY', '2 buc.', 'PCS', 2), field('LINE_PRICE_NET', '49.000,00 EUR', 'EUR', 2)] },
      { lineId: 'ln_2', category: 'PUMP', descriptionRo: 'Electropompă submersibilă 55 kW', fields: [field('PUMP_POWER_KW', '55 kW', 'KW', 2), field('FLOW_RATE_M3_H', '180 m³/h', 'M3_H', 3), field('LINE_PRICE_NET', '14.500,00 EUR', 'EUR', 2)] },
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
      field('WATER_SOURCE', 'apă subterană, puț forat F1', 'TEXT', 2),
    ],
    lineItems: [], missingFields: [], warnings: [],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_aviz_anar' }, '📄 Citesc avizul ANAR', '📄 Aviz ANAR valabil până la 31.12.2028, 240.000 m³/an', () => [permitVolume], { extraction: extractionPermit, modelId: MODEL_EXTRACT }, { callDt: 100, durationMs: 2900 });

  const invoiceKwh = R.calc('extract_document', 'doc.energy.kwh_12m', 'Energie facturată (12 luni)', P.invoiceKwh, 'KWH_PER_YEAR', { sourceRo: 'Facturi energie 10.2025–09.2026' });
  const extractionEnergy = {
    documentId: 'doc_facturi_energie', documentType: 'ENERGY_INVOICES', moduleId: 'irigatii', currency: 'RON',
    supplierName: 'Furnizor energie (demo)',
    documentFields: [
      field('PERIOD_FROM', '01.10.2025', 'DATE', 1),
      field('PERIOD_TO', '30.09.2026', 'DATE', 12),
      field('ENERGY_KWH', '36.900 kWh', 'KWH', 13),
      field('ENERGY_COST', '36.678,60 lei', 'RON', 13, 'MEDIUM'),
    ],
    lineItems: [], missingFields: [],
    warnings: ['Facturile acoperă tot locul de consum, nu doar pompa.'],
  };
  R.tool(A1, 'extract_document', 1, { documentId: 'doc_facturi_energie' }, '📄 Citesc facturile de energie pe 12 luni', '📄 Energie facturată: 36.900 kWh/an', () => [invoiceKwh], { extraction: extractionEnergy, modelId: MODEL_EXTRACT }, { callDt: 100, durationMs: 3600 });

  // --- module rules ---
  const threshold = R.calc('get_module_rules', 'rules.threshold.water_saving', 'Pragul verde: economie de apă', P.threshold, 'PCT', { sourceRo: 'README §6.1: economie de apă ≥ 25% față de sistemul actual (propunere, de confirmat cu Raiffeisen)' });
  const effFurrows = R.calc('get_module_rules', 'rules.efficiency.brazde', 'Eficiența sistemului BRAZDE', P.effFurrows * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json (README §6.1)' });
  const effSprinkler = R.calc('get_module_rules', 'rules.efficiency.aspersie', 'Eficiența sistemului ASPERSIE', P.effSprinkler * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json (README §6.1)' });
  const effDrip = R.calc('get_module_rules', 'rules.efficiency.picurare', 'Eficiența sistemului PICURARE', P.effDrip * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json (README §6.1)' });
  const sensorEff = R.calc('get_module_rules', 'rules.sensors', 'Reducerea necesarului cu senzori de umiditate', P.sensors * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json (README §6.1)' });
  const pumpEff = R.calc('get_module_rules', 'rules.pump_efficiency', 'Randamentul pompei', P.pumpEff * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json' });
  const waterPrice = R.calc('get_module_rules', 'rules.price.water', 'Prețul apei (PUT)', P.waterPrice, 'EUR_PER_M3', { sourceRo: 'config/modules/irigatii.json: puț propriu (estimare echipă)' });
  const elecPrice = R.calc('get_module_rules', 'rules.price.electricity', 'Prețul energiei electrice', P.elecPrice, 'EUR_PER_KWH', { sourceRo: 'config/prices.json (estimare echipă)' });
  const gridFactor = R.calc('get_module_rules', 'rules.factor.grid', 'Factor de emisie al rețelei', P.gridFactor, 'KG_CO2_PER_KWH', { sourceRo: 'config/factors.json (README §6: 0,26 t CO₂/MWh)' });
  R.tool(A1, 'get_module_rules', 2, { moduleId: 'irigatii' }, '🔧 Citesc regulile modulului Irigații', '🔧 Prag verde: economie de apă ≥ 25%; brazde 60%, aspersie 75%, picurare 90%', () => [threshold, effFurrows, effSprinkler, effDrip, sensorEff, pumpEff, waterPrice, elecPrice, gridFactor], { indicator: 'WATER_SAVING_PCT', calculator: 'irrigation', thresholdKind: 'MIN_PCT' });

  // --- baseline: furrows ---
  const need = netNeedM3(P.crops, P.et0Mm, P.rainMm);
  const wOld = withdrawalM3(need, P.effFurrows);
  const eOld = pumpingKwh(wOld, P.liftM, P.pressureFurrows, P.pumpEff);
  const area = R.calc('compute_baseline', 'baseline.area', 'Suprafața parcelelor alese', P.areaHa, 'HA', { sourceRo: 'APIA' });
  const baseNeed = R.calc('compute_baseline', 'baseline.net_need', 'Nevoia netă de apă a culturilor', need, 'M3_PER_YEAR', { formula: 'Σ max(0, Kc × ET₀ − P_ef) × 10 × ha', sourceRo: 'Kc pe cultură (APIA); ET₀ 700 mm și ploaie efectivă 200 mm pe sezon, zona SUD_EST', dependsOn: [area] });
  const baseEff = R.calc('compute_baseline', 'baseline.efficiency', 'Eficiența sistemului actual', P.effFurrows * 100, 'PCT', { sourceRo: 'config/modules/irigatii.json' });
  const baseWater = R.calc('compute_baseline', 'baseline.water', 'Apă extrasă azi', wOld, 'M3_PER_YEAR', { formula: 'NIR / η actual', dependsOn: [baseNeed, baseEff] });
  const baseLift = R.calc('compute_baseline', 'baseline.lift', 'Înălțimea de pompare', P.liftM, 'M', { sourceRo: 'chestionar' });
  const baseEnergy = R.calc('compute_baseline', 'baseline.energy', 'Energie de pompare azi', eOld, 'KWH_PER_YEAR', { formula: 'm³ × (H ridicare + H presiune) × 0,002725 / η pompă', dependsOn: [baseWater, baseLift] });
  const baseInvoiced = R.calc('compute_baseline', 'baseline.energy_invoiced', 'Energie din facturi (12 luni)', P.invoiceKwh, 'KWH_PER_YEAR', { sourceRo: 'facturile de energie', dependsOn: [invoiceKwh] });
  const baseCo2 = R.calc('compute_baseline', 'baseline.co2', 'CO₂ din pompare azi', (eOld * P.gridFactor) / 1000, 'T_CO2_PER_YEAR', { formula: 'kWh × factor rețea', dependsOn: [baseEnergy] });
  R.tool(A1, 'compute_baseline', 2, { currentSystem: 'BRAZDE', pumpingHeadM: P.liftM }, '🔧 Calculez situația actuală (irigare pe brazde)', `🔧 Azi: ${baseWater.display} apă și ${baseEnergy.display}; facturile confirmă estimarea`, () => [area, baseNeed, baseEff, baseWater, baseLift, baseEnergy, baseInvoiced, baseCo2], { dataSource: 'MIXED', currentSystem: 'BRAZDE', climateZone: 'SUD_EST' });

  // --- configurations (README §6.1, D) ---
  const config = (eff, sensors, pressure) => {
    const water = withdrawalM3(need, eff, sensors);
    const kwh = pumpingKwh(water, P.liftM, pressure, P.pumpEff);
    return { water, pct: (1 - water / wOld) * 100, saved: wOld - water, kwh, energySaved: eOld - kwh, co2: ((eOld - kwh) * P.gridFactor) / 1000 };
  };
  const spr = config(P.effSprinkler, 0, P.pressureSprinkler);
  const sprSens = config(P.effSprinkler, P.sensors, P.pressureSprinkler);
  const drip = config(P.effDrip, 0, P.pressureDrip);
  const green = config(P.effDrip, P.sensors, P.pressureDrip);
  const costDrip = P.offerPump + P.drip + P.meter;
  const costGreen = costDrip + P.sensorCost;

  const cfgInitCost = R.calc('compute_indicator', 'cfg_initial.total_cost', 'Cost total cfg_initial', P.offer, 'EUR', { dependsOn: [offerTotal] });
  const cfgInitWater = R.calc('compute_indicator', 'cfg_initial.water', 'Apă extrasă pe an', spr.water, 'M3_PER_YEAR', { formula: 'NIR × (1 − s senzori) / η', dependsOn: [baseNeed, effSprinkler] });
  const cfgInitPct = R.calc('compute_indicator', 'cfg_initial.water_saving_pct', 'Economie de apă', spr.pct, 'PCT', { formula: '1 − apă nouă / apă actuală', dependsOn: [cfgInitWater, baseWater] });
  const cfgInitSaved = R.calc('compute_indicator', 'cfg_initial.water_saved', 'Apă economisită pe an', spr.saved, 'M3_PER_YEAR', { dependsOn: [baseWater, cfgInitWater] });
  const cfgInitKwh = R.calc('compute_indicator', 'cfg_initial.pumping_energy', 'Energie de pompare', spr.kwh, 'KWH_PER_YEAR', { formula: 'm³ × (H ridicare + H presiune) × 0,002725 / η pompă', dependsOn: [cfgInitWater, baseLift] });
  const cfgInitKwhSaved = R.calc('compute_indicator', 'cfg_initial.energy_saved', 'Energie economisită pe an', spr.energySaved, 'KWH_PER_YEAR', { formula: 'kWh azi − kWh din rețea după investiție (negativ = consum mai mare)', dependsOn: [baseEnergy, cfgInitKwh] });
  const cfgInitCo2 = R.calc('compute_indicator', 'cfg_initial.co2_avoided', 'CO₂ evitat pe an', spr.co2, 'T_CO2_PER_YEAR', { formula: 'kWh economisiți × factor rețea', dependsOn: [cfgInitKwhSaved, gridFactor] });
  R.tool(A1, 'compute_indicator', 3, { configId: 'cfg_initial', documentId: 'doc_oferta_aspersie' }, '🔧 Verific pragul pentru oferta inițială', `🔧 Aspersia clasică economisește ${cfgInitPct.display} apă: NU TRECE (prag 25%), iar pomparea la presiune crește consumul de energie`, () => [cfgInitCost, cfgInitWater, cfgInitPct, cfgInitSaved, cfgInitKwh, cfgInitKwhSaved, cfgInitCo2], { configId: 'cfg_initial', thresholdResult: 'FAIL', meetsSafetyMargin: false });

  R.thought(A1, 'Aspersia clasică ajunge la 20% economie de apă față de brazde, sub pragul de 25%, și consumă mai multă energie pentru că lucrează la presiune mare. Nu resping dosarul: caut în catalog combinațiile care trec pragul pe aceleași 40 ha.', 3);

  // --- search ---
  const candDripPct = R.calc('search_upgrades', 'cand.drip.pct', 'Indicator cu pachetul pkg_drip', drip.pct, 'PCT');
  const candDripCost = R.calc('search_upgrades', 'cand.drip.cost', 'Cost total cu pachetul pkg_drip', costDrip, 'EUR');
  const candSensPct = R.calc('search_upgrades', 'cand.sensors.pct', 'Indicator cu pachetul pkg_sensors', sprSens.pct, 'PCT');
  const candSensCost = R.calc('search_upgrades', 'cand.sensors.cost', 'Cost total cu pachetul pkg_sensors', P.offer + P.sensorCost + P.meter, 'EUR');
  const candBothPct = R.calc('search_upgrades', 'cand.drip_sensors.pct', 'Indicator cu pachetul pkg_drip_sensors', green.pct, 'PCT');
  const candBothCost = R.calc('search_upgrades', 'cand.drip_sensors.cost', 'Cost total cu pachetul pkg_drip_sensors', costGreen, 'EUR');
  R.tool(A1, 'search_upgrades', 4, { baseConfigId: 'cfg_initial' }, '🔧 Caut upgrade-uri în catalogul de irigații', `🔧 3 pachete trec pragul: aspersie + senzori ${candSensPct.display}, picurare ${candDripPct.display}, picurare + senzori ${candBothPct.display}`, () => [candDripPct, candDripCost, candSensPct, candSensCost, candBothPct, candBothCost], {
    candidates: [
      { packageId: 'pkg_sensors', catalogIds: ['irg.sensors.soil_moisture', 'irg.meter.electromagnetic'], thresholdResult: 'PASS', meetsSafetyMargin: true },
      { packageId: 'pkg_drip', catalogIds: ['irg.drip.surface_veg', 'irg.meter.electromagnetic'], thresholdResult: 'PASS', meetsSafetyMargin: true },
      { packageId: 'pkg_drip_sensors', catalogIds: ['irg.drip.surface_veg', 'irg.sensors.soil_moisture', 'irg.meter.electromagnetic'], thresholdResult: 'PASS', meetsSafetyMargin: true },
    ],
  });

  R.thought(A1, 'Cea mai ieftină variantă care trece e aspersia cu senzori (28%), aproape de prag. Picurarea cu senzori ajunge la 40%, peste pragul pentru Verde Plus (37,5%), cu 20.300 EUR în plus față de ea și cu mai puțină energie decât azi. O recomand și păstrez picurarea simplă (33%) ca alternativă.', 4);

  // --- drip (alternative) and drip + sensors (recommended) ---
  const altCost = R.calc('simulate_upgrade_package', 'cfg_min_pass.total_cost', 'Cost total cfg_min_pass', costDrip, 'EUR');
  const altUpgrade = R.calc('simulate_upgrade_package', 'cfg_min_pass.upgrade_cost', 'Cost suplimentar față de oferta inițială', costDrip - P.offer, 'EUR', { dependsOn: [altCost, cfgInitCost] });
  const altWater = R.calc('simulate_upgrade_package', 'cfg_min_pass.water', 'Apă extrasă pe an', drip.water, 'M3_PER_YEAR', { formula: 'NIR × (1 − s senzori) / η', dependsOn: [baseNeed, effDrip] });
  const altPct = R.calc('simulate_upgrade_package', 'cfg_min_pass.water_saving_pct', 'Economie de apă', drip.pct, 'PCT', { formula: '1 − apă nouă / apă actuală', dependsOn: [altWater, baseWater] });
  const altSaved = R.calc('simulate_upgrade_package', 'cfg_min_pass.water_saved', 'Apă economisită pe an', drip.saved, 'M3_PER_YEAR');
  const altKwh = R.calc('simulate_upgrade_package', 'cfg_min_pass.pumping_energy', 'Energie de pompare', drip.kwh, 'KWH_PER_YEAR', { formula: 'm³ × (H ridicare + H presiune) × 0,002725 / η pompă' });
  const altKwhSaved = R.calc('simulate_upgrade_package', 'cfg_min_pass.energy_saved', 'Energie economisită pe an', drip.energySaved, 'KWH_PER_YEAR');
  const altCo2 = R.calc('simulate_upgrade_package', 'cfg_min_pass.co2_avoided', 'CO₂ evitat pe an', drip.co2, 'T_CO2_PER_YEAR', { formula: 'kWh economisiți × factor rețea' });
  R.tool(A1, 'simulate_upgrade_package', 4, { baseConfigId: 'cfg_initial', configId: 'cfg_min_pass', add: ['irg.drip.surface_veg', 'irg.meter.electromagnetic'] }, '🔧 Simulez picurarea', `🔧 Picurare: ${altPct.display} economie de apă. TRECE (prag 25%)`, () => [altCost, altUpgrade, altWater, altPct, altSaved, altKwh, altKwhSaved, altCo2], { configId: 'cfg_min_pass', thresholdResult: 'PASS', meetsSafetyMargin: true });

  const recCost = R.calc('simulate_upgrade_package', 'cfg_recommended.total_cost', 'Cost total cfg_recommended', costGreen, 'EUR');
  const recUpgrade = R.calc('simulate_upgrade_package', 'cfg_recommended.upgrade_cost', 'Cost suplimentar față de oferta inițială', costGreen - P.offer, 'EUR', { dependsOn: [recCost, cfgInitCost] });
  const recWater = R.calc('simulate_upgrade_package', 'cfg_recommended.water', 'Apă extrasă pe an', green.water, 'M3_PER_YEAR', { formula: 'NIR × (1 − s senzori) / η', dependsOn: [baseNeed, effDrip, sensorEff] });
  const recPct = R.calc('simulate_upgrade_package', 'cfg_recommended.water_saving_pct', 'Economie de apă', green.pct, 'PCT', { formula: '1 − apă nouă / apă actuală', dependsOn: [recWater, baseWater] });
  const recSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.water_saved', 'Apă economisită pe an', green.saved, 'M3_PER_YEAR', { dependsOn: [baseWater, recWater] });
  const recKwh = R.calc('simulate_upgrade_package', 'cfg_recommended.pumping_energy', 'Energie de pompare', green.kwh, 'KWH_PER_YEAR', { formula: 'm³ × (H ridicare + H presiune) × 0,002725 / η pompă', dependsOn: [recWater, baseLift] });
  const recKwhSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.energy_saved', 'Energie economisită pe an', green.energySaved, 'KWH_PER_YEAR', { dependsOn: [baseEnergy, recKwh] });
  const recCo2 = R.calc('simulate_upgrade_package', 'cfg_recommended.co2_avoided', 'CO₂ evitat pe an', green.co2, 'T_CO2_PER_YEAR', { formula: 'kWh economisiți × factor rețea', dependsOn: [recKwhSaved, gridFactor] });
  const cDrip = R.calc('simulate_upgrade_package', 'cmp.drip.cost', 'Picurare cu conducte și montaj, 40 ha', P.drip, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.drip.surface_veg' });
  const cSens = R.calc('simulate_upgrade_package', 'cmp.sensors.cost', 'Senzori de umiditate a solului', P.sensorCost, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.sensors.soil_moisture' });
  const cMeter = R.calc('simulate_upgrade_package', 'cmp.meter.cost', 'Contor electromagnetic de apă', P.meter, 'EUR', { sourceRo: 'data/catalog/irigatii.json: irg.meter.electromagnetic' });
  R.tool(A1, 'simulate_upgrade_package', 5, { baseConfigId: 'cfg_min_pass', configId: 'cfg_recommended', add: ['irg.sensors.soil_moisture'] }, '🔧 Simulez picurare + senzori de umiditate', `🔧 Picurare + senzori: ${recPct.display} economie de apă și ${recKwhSaved.display} mai puțin decât azi. TRECE`, () => [recCost, recUpgrade, recWater, recPct, recSaved, recKwh, recKwhSaved, recCo2, cDrip, cSens, cMeter], { configId: 'cfg_recommended', thresholdResult: 'PASS', meetsSafetyMargin: true });

  // --- DNSH inputs ---
  R.tool(A1, 'check_dnsh_inputs', 6, { configId: 'cfg_recommended' }, '🔧 Verific datele pentru DNSH (apă, nitrați, Natura 2000)', '🔧 Aviz ANAR valabil, peste consumul nou; contor în configurație; nicio parcelă în Natura 2000 sau în zonă de nitrați', null, {
    natura2000Parcels: [], nitrateVulnerableParcels: [], droughtRisk: 'HIGH', oldEquipmentFate: 'NU_E_CAZUL', waterMeterInConfig: true, permitPresent: true, permitValid: true, waterSource: 'PUT',
  });

  const assessment = {
    moduleId: 'irigatii',
    indicator: 'WATER_SAVING_PCT',
    threshold: { thresholdCalcId: threshold.calcId, sourceRo: 'README §6.1: economie de apă ≥ 25% față de sistemul actual (propunere, de confirmat cu Raiffeisen)' },
    baseline: {
      descriptionRo: 'Legume pe 40 ha irigate prin brazde dintr-un puț de 35 m. Apa vine din nevoia culturilor (Kc, ET₀, ploaia) și eficiența brazdelor; energia de pompare e estimată și confirmată de facturi.',
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
          { componentId: 'cmp_offer_ln_1', category: 'IRRIGATION_SPRINKLER', nameRo: 'Instalație de irigat cu tambur, 2 buc.', source: 'OFFER', costCalcId: offerSprinklerCost.calcId },
          { componentId: 'cmp_offer_ln_2', category: 'PUMP', nameRo: 'Electropompă submersibilă 55 kW', source: 'OFFER', costCalcId: offerPumpCost.calcId },
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
        noteRo: 'Aspersia lucrează la 3,5 bar: consumul de energie crește față de brazde. Oferta nu include contor de apă.',
      },
      {
        configId: 'cfg_min_pass', role: 'ALTERNATIVE', titleRo: 'Picurare + contor (pompa din ofertă)',
        components: [
          { componentId: 'cmp_offer_ln_2', category: 'PUMP', nameRo: 'Electropompă submersibilă 55 kW', source: 'OFFER', costCalcId: offerPumpCost.calcId },
          { componentId: 'cmp_drip_system', category: 'IRRIGATION_DRIP', nameRo: 'Picurare cu conducte și montaj, 40 ha', source: 'CATALOG_REPLACEMENT', catalogId: 'irg.drip.surface_veg', replacesComponentId: 'cmp_offer_ln_1', costCalcId: cDrip.calcId },
          { componentId: 'cmp_water_meter', category: 'WATER_METER', nameRo: 'Contor electromagnetic de apă', source: 'CATALOG_UPGRADE', catalogId: 'irg.meter.electromagnetic', costCalcId: cMeter.calcId },
        ],
        totalCostCalcId: altCost.calcId,
        upgradeCostCalcId: altUpgrade.calcId,
        indicatorCalcId: altPct.calcId,
        thresholdResult: 'PASS',
        impacts: [
          { metric: 'WATER_SAVING_PCT', calcId: altPct.calcId },
          { metric: 'WATER_SAVED_M3', calcId: altSaved.calcId },
          { metric: 'ENERGY_SAVED_KWH', calcId: altKwhSaved.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: altCo2.calcId },
        ],
        noteRo: 'Trece pragul (Verde), sub nivelul Verde Plus.',
      },
      {
        configId: 'cfg_recommended', role: 'RECOMMENDED', titleRo: 'Picurare + senzori de umiditate + contor',
        components: [
          { componentId: 'cmp_offer_ln_2', category: 'PUMP', nameRo: 'Electropompă submersibilă 55 kW', source: 'OFFER', costCalcId: offerPumpCost.calcId },
          { componentId: 'cmp_drip_system', category: 'IRRIGATION_DRIP', nameRo: 'Picurare cu conducte și montaj, 40 ha', source: 'CATALOG_REPLACEMENT', catalogId: 'irg.drip.surface_veg', replacesComponentId: 'cmp_offer_ln_1', costCalcId: cDrip.calcId },
          { componentId: 'cmp_water_meter', category: 'WATER_METER', nameRo: 'Contor electromagnetic de apă', source: 'CATALOG_UPGRADE', catalogId: 'irg.meter.electromagnetic', costCalcId: cMeter.calcId },
          { componentId: 'cmp_soil_sensors', category: 'SOIL_MOISTURE_SENSORS', nameRo: 'Senzori de umiditate în sol + programare automată', source: 'CATALOG_UPGRADE', catalogId: 'irg.sensors.soil_moisture', costCalcId: cSens.calcId },
        ],
        totalCostCalcId: recCost.calcId,
        upgradeCostCalcId: recUpgrade.calcId,
        indicatorCalcId: recPct.calcId,
        thresholdResult: 'PASS',
        impacts: [
          { metric: 'WATER_SAVING_PCT', calcId: recPct.calcId },
          { metric: 'WATER_SAVED_M3', calcId: recSaved.calcId },
          { metric: 'ENERGY_SAVED_KWH', calcId: recKwhSaved.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: recCo2.calcId },
        ],
        noteRo: 'Peste pragul pentru Verde Plus (25% × 1,5 = 37,5%), cu mai puțină energie decât azi.',
      },
    ],
    initialConfigId: 'cfg_initial',
    recommendedConfigId: 'cfg_recommended',
    recommendationType: 'UPGRADE_BEYOND_REQUEST',
    dnshChecks: [
      { objective: 'WATER_MARINE_RESOURCES', status: 'PASS', evidence: ['WATER_PERMIT_ANAR'], noteRo: 'Aviz ANAR valabil până în 2028; volumul autorizat (240.000 m³) acoperă consumul nou. Contorul e în configurația recomandată.' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS', evidence: [], noteRo: 'Nicio parcelă în zonă vulnerabilă la nitrați.' },
      { objective: 'BIODIVERSITY', status: 'PASS', evidence: [], noteRo: 'Nicio parcelă în Natura 2000.' },
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', evidence: [], noteRo: 'Risc de secetă ridicat; picurarea cu senzori crește reziliența.' },
    ],
    sizingCheck: { status: 'NOT_APPLICABLE', noteRo: 'Verificarea putere/suprafață se aplică doar la utilaje.' },
    missingFields: [
      { fieldKey: 'water_meter_certificate', labelRo: 'Certificatul metrologic al contorului de apă, după montaj', requiredFor: 'DISBURSEMENT', docType: 'WATER_METER_CERTIFICATE', blocking: false },
    ],
    summaryRo: `Oferta de aspersie clasică (85.000 EUR) economisește ${cfgInitPct.display} apă față de brazde, sub pragul de 25%, și crește energia de pompare. Recomand picurare + senzori de umiditate + contor (113.000 EUR): ${recPct.display} economie de apă (${recSaved.display}), ${recKwhSaved.display} mai puțin și ${recCo2.display} evitate. Picurarea simplă (${altPct.display}) rămâne alternativă.`,
    farmerMessageRo: 'Aspersia economisește 20% apă. Pentru creditul verde e nevoie de 25%. Cu picurare și senzori ajungi la 40% și consumi mai puțină energie decât azi.',
  };
  R.completed(A1, 'submit_technical_assessment', `✅ Agentul 1 a terminat: sub prag → upgrade → ${recPct.display}, Verde Plus posibil`, assessment, 6, 31800);

  // =================== AGENT 2 ===================
  R.state('AGENT_1', 'AGENT_2', 'Pornește optimizatorul de finanțare', {}, 300);
  R.started(A2, 'AGENT_2', 'Agentul 2 (finanțare) a pornit');

  const term = R.calc('list_financing_lines', 'line.term', 'Durata creditului', P.term, 'MONTHS', { sourceRo: 'config/modules/irigatii.json' });
  const horizon = R.calc('list_financing_lines', 'line.horizon', 'Orizontul comparației', P.horizonYears, 'YEARS', { sourceRo: 'config/modules/irigatii.json' });
  const affLimit = R.calc('list_financing_lines', 'line.affordability_limit', 'Limita ratelor față de cashflow', P.affordLimit, 'PCT', { sourceRo: 'config/financing-lines.json (demo)' });
  const mortInit = R.calc('list_financing_lines', 'line.standard.collateral_initial', 'Costuri inițiale ipotecă', P.mortgageInitial, 'EUR', { sourceRo: 'config/financing-lines.json (demo)' });
  const mortAnnual = R.calc('list_financing_lines', 'line.standard.collateral_annual', 'Costuri anuale ipotecă', P.mortgageAnnual, 'EUR_PER_YEAR', { sourceRo: 'config/financing-lines.json (demo)' });
  const feiCov = R.calc('list_financing_lines', 'guarantee.sustainability.coverage', 'Garanție FEI – InvestEU Sustainability', P.feiCoverage, 'PCT', { sourceRo: 'Acord FEI cu Raiffeisen, 25.10.2023; procentul pentru 2026 e de confirmat' });
  R.tool(A2, 'list_financing_lines', 1, {}, '🔧 Citesc liniile de finanțare Raiffeisen', '🔧 Credit standard cu ipotecă și credit verde cu garanție FEI 70%; dobânzile se calculează pe componente', () => [mortInit, mortAnnual, feiCov, term, horizon, affLimit], {
    lines: [
      { lineId: 'rbro.invest.standard', kind: 'STANDARD_LOAN', green: false, collateral: 'MORTGAGE', repayment: ['EQUAL_MONTHLY'], rate: 'PRICED_BY_PRICE_LOAN' },
      { lineId: 'rbro.agri.green_investeu', kind: 'GREEN_LOAN', green: true, collateral: 'GUARANTEE', repayment: ['EQUAL_MONTHLY', 'SEASONAL'], rate: 'PRICED_BY_PRICE_LOAN', guaranteeId: 'eif.investeu.sustainability' },
    ],
  });

  R.tool(A2, 'check_program_eligibility', 2, { configId: 'cfg_recommended' }, '🔧 Verific granturile AFIR și garanțiile disponibile', '🔧 Nicio sesiune AFIR deschisă pentru irigații; garanția InvestEU e disponibilă', null, {
    programs: [
      { programCode: 'DR_26', result: 'ELIGIBLE', session: 'NOT_OPEN' },
      { programCode: 'DR_16', result: 'ELIGIBLE', session: 'NOT_OPEN' },
      { programCode: 'DR_12', result: 'NOT_ELIGIBLE', session: 'OPEN' },
      { programCode: 'FM_PV', result: 'NOT_ELIGIBLE', session: 'CLOSED' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT' },
    ],
  });

  const verdePlusMultiplier = 1.5;
  const requestedPct = spr.pct;
  const financedPct = green.pct;
  const dnshOverall = worstDnsh(assessment.dnshChecks);
  const tierName = greenTierOf(P.threshold, verdePlusMultiplier, requestedPct, financedPct, dnshOverall);
  const tierThr = R.calc('determine_green_tier', 'green_tier.threshold', 'Pragul verde', P.threshold, 'PCT', { sourceRo: 'README §6.1: economie de apă ≥ 25% față de sistemul actual (propunere, de confirmat cu Raiffeisen)' });
  const tierReq = R.calc('determine_green_tier', 'green_tier.requested_indicator', 'Indicatorul investiției cerute', requestedPct, 'PCT');
  const tierFin = R.calc('determine_green_tier', 'green_tier.financed_indicator', 'Indicatorul investiției finanțate de creditul verde', financedPct, 'PCT');
  const tierPlus = R.calc('determine_green_tier', 'green_tier.verde_plus_min', 'Pragul pentru Verde Plus', P.threshold * verdePlusMultiplier, 'PCT', { formula: 'prag × multiplicator', sourceRo: 'config/pricing.json: greenTiers.verdePlusThresholdMultiplier (README §4, pasul 8)', dependsOn: [tierThr] });
  const tier = {
    tier: tierName, thresholdMet: financedPct >= P.threshold, upgradeNeeded: requestedPct < P.threshold, dnshStatus: dnshOverall,
    thresholdCalcId: tierThr.calcId, requestedIndicatorCalcId: tierReq.calcId, financedIndicatorCalcId: tierFin.calcId, verdePlusMinCalcId: tierPlus.calcId,
  };
  R.tool(A2, 'determine_green_tier', 3, { requestedConfigId: 'cfg_initial', financedConfigId: 'cfg_recommended' }, '🔧 Stabilesc nivelul verde', `🔧 Verde Plus: ${tierFin.display} față de pragul de ${tierThr.display} (minimum ${tierPlus.display}), DNSH fără condiții`, () => [tierThr, tierReq, tierFin, tierPlus], { tier: tierName, thresholdMet: tier.thresholdMet, upgradeNeeded: tier.upgradeNeeded, dnshStatus: dnshOverall });

  R.thought(A2, 'Pentru irigații nu există azi o sesiune AFIR deschisă: DR-26 și DR-16 au ghid, dar nicio sesiune în 2026, iar DR-12 nu se aplică (administrator de 52 de ani). Construiesc creditul verde cu garanție InvestEU și rate după recoltă (iulie–octombrie, din Open Banking), la dobânda calculată pe componente.', 3);

  const stackStdAmt = R.calc('build_funding_stack', 'option_a.loan.amount', 'Credit standard de investiții', P.offer, 'EUR', { dependsOn: [cfgInitCost] });
  const stackGreenAmt = R.calc('build_funding_stack', 'option_b.loan.amount', 'Credit verde Raiffeisen pentru agricultură, garantat InvestEU', costGreen, 'EUR', { dependsOn: [recCost] });
  const stackGuarAmt = R.calc('build_funding_stack', 'option_b.guarantee.amount', 'Valoare garantată', (costGreen * P.feiCoverage) / 100, 'EUR', { formula: 'credit × acoperire garanție', dependsOn: [stackGreenAmt, feiCov] });
  R.tool(A2, 'build_funding_stack', 3, { options: [{ optionId: 'A', configId: 'cfg_initial', products: ['rbro.invest.standard'] }, { optionId: 'B', configId: 'cfg_recommended', products: ['rbro.agri.green_investeu'] }] }, '🔧 Construiesc structura de finanțare A și B', `🔧 A: credit standard ${stackStdAmt.display} cu ipotecă. B: credit verde ${stackGreenAmt.display} cu garanție FEI 70%`, () => [stackStdAmt, stackGreenAmt, stackGuarAmt], { options: [{ optionId: 'A', configId: 'cfg_initial', components: ['STANDARD_LOAN'] }, { optionId: 'B', configId: 'cfg_recommended', components: ['GREEN_LOAN', 'GUARANTEE'] }] });

  const pA = priceClassic();
  const pB = priceGreen(P.feiCoverage, tierName);
  const rA = rateCalcs(R, 'option_a.rate', pA);
  const rB = rateCalcs(R, 'option_b.rate', pB);
  const diff = rateDiffCalcs(R, pA, pB);
  R.tool(A2, 'price_loan', 4, { optionIds: ['A', 'B'] }, '🔧 Calculez dobânda pe componente', `🔧 Clasic ${rA.rate.display}; verde ${rB.rate.display} (${diff.total.display}): garanția FEI, finanțarea verde și analiza automată`, () => [...Object.values(rA).filter((c) => c.calcId), ...Object.values(rB).filter((c) => c.calcId), ...diff.calcs, diff.total], { options: [{ optionId: 'A', pricing: 'CLASSIC' }, { optionId: 'B', pricing: 'GREEN' }] });

  // scenario A: classic, equal monthly, mortgage
  const schA = schedule(P.offer, pA.rate, P.term, 2027, 1);
  const aWaterSav = spr.saved * P.waterPrice;
  const aEnergySav = spr.energySaved * P.elecPrice;
  const aSav = aWaterSav + aEnergySav;
  const aCollateral = P.mortgageInitial + P.mortgageAnnual * P.horizonYears;
  const aInst = R.calc('build_scenario', 'option_a.installment', 'Rata lunară', schA.installment, 'EUR_PER_MONTH', { decimals: 0, formula: 'PMT = P · r / (1 − (1 + r)^−n)', dependsOn: [stackStdAmt, rA.rate, term] });
  const aSched = R.calc('build_scenario', 'option_a.schedule', 'Total plătit pe credit', schA.totalPayments, 'EUR', { series: schA.series, dependsOn: [aInst] });
  const aTotal = R.calc('build_scenario', 'option_a.total_payments', 'Total plăți (credit + punte)', schA.totalPayments, 'EUR');
  const aInterest = R.calc('build_scenario', 'option_a.total_interest', 'Total dobânzi', schA.totalInterest, 'EUR');
  const aColl = R.calc('build_scenario', 'option_a.collateral_costs', 'Costuri cu ipoteca', aCollateral, 'EUR', { formula: 'cost inițial + cost anual × ani', dependsOn: [mortInit, mortAnnual, horizon] });
  const aWaterEur = R.calc('build_scenario', 'option_a.savings.water_eur', 'Economie anuală (water_eur)', aWaterSav, 'EUR_PER_YEAR', { dependsOn: [cfgInitSaved, waterPrice] });
  const aEnergyEur = R.calc('build_scenario', 'option_a.savings.energy_eur', 'Economie anuală (energy_eur)', aEnergySav, 'EUR_PER_YEAR', { dependsOn: [cfgInitKwhSaved, elecPrice] });
  const aSavH = R.calc('build_scenario', 'option_a.savings_horizon', 'Economii pe 5 ani', aSav * P.horizonYears, 'EUR', { dependsOn: [aWaterEur, aEnergyEur, horizon] });
  const aNetCost = P.offer + schA.totalInterest + aCollateral - aSav * P.horizonYears;
  const aNet = R.calc('build_scenario', 'option_a.net_cost', 'Cost net pe 5 ani', aNetCost, 'EUR', { formula: 'investiție − grant + dobânzi + costuri garanții − economii', dependsOn: [aTotal, aColl, aSavH] });
  R.tool(A2, 'build_scenario', 5, { optionId: 'A', scheduleType: 'EQUAL_MONTHLY' }, '🔧 Calculez creditul A (standard, rate lunare egale)', `🔧 A: ${aInst.display}, 60 de luni, plus ${aColl.display} costuri de ipotecă; aspersia crește costul cu energia`, () => [aInst, aSched, aTotal, aInterest, aColl, aWaterEur, aEnergyEur, aSavH, aNet], { optionId: 'A', scheduleType: 'EQUAL_MONTHLY', firstInstallmentMonth: '2027-02' });

  // scenario B: green, seasonal after harvest, F1 guarantee instead of the mortgage
  const schB = schedule(costGreen, pB.rate, P.term, 2027, 1, P.cashinMonths);
  const grace = schB.series.findIndex((p) => p.values.payment > 0);
  const bWaterSav = green.saved * P.waterPrice;
  const bEnergySav = green.energySaved * P.elecPrice;
  const bSav = bWaterSav + bEnergySav;
  const bInst = R.calc('build_scenario', 'option_b.installment', 'Rata sezonieră', schB.installment, 'EUR', { decimals: 0, formula: 'rate egale doar în lunile cu încasări; VA la dobânda creditului = principalul', dependsOn: [stackGreenAmt, rB.rate, term] });
  const bGrace = R.calc('build_scenario', 'option_b.grace', 'Luni fără rată până la prima încasare', grace, 'MONTHS', { sourceRo: 'grația până la prima recoltă, cel mult 12 luni (config/modules)' });
  const bSched = R.calc('build_scenario', 'option_b.schedule', 'Total plătit pe credit', schB.totalPayments, 'EUR', { series: schB.series, dependsOn: [bInst] });
  const bTotal = R.calc('build_scenario', 'option_b.total_payments', 'Total plăți (credit + punte)', schB.totalPayments, 'EUR');
  const bInterest = R.calc('build_scenario', 'option_b.total_interest', 'Total dobânzi', schB.totalInterest, 'EUR');
  const bWaterEur = R.calc('build_scenario', 'option_b.savings.water_eur', 'Economie anuală (water_eur)', bWaterSav, 'EUR_PER_YEAR', { dependsOn: [recSaved, waterPrice] });
  const bEnergyEur = R.calc('build_scenario', 'option_b.savings.energy_eur', 'Economie anuală (energy_eur)', bEnergySav, 'EUR_PER_YEAR', { dependsOn: [recKwhSaved, elecPrice] });
  const bSavH = R.calc('build_scenario', 'option_b.savings_horizon', 'Economii pe 5 ani', bSav * P.horizonYears, 'EUR', { dependsOn: [bWaterEur, bEnergyEur, horizon] });
  const bNetCost = costGreen + schB.totalInterest - bSav * P.horizonYears;
  const bNet = R.calc('build_scenario', 'option_b.net_cost', 'Cost net pe 5 ani', bNetCost, 'EUR', { formula: 'investiție − grant + dobânzi + costuri garanții − economii', dependsOn: [bTotal, bSavH] });
  R.tool(A2, 'build_scenario', 5, { optionId: 'B', scheduleType: 'SEASONAL', paymentMonths: P.cashinMonths }, '🔧 Calculez creditul B (verde, rate după recoltă)', `🔧 B: ${bInst.display} în iulie, august, septembrie și octombrie, după ${bGrace.display} de grație; fără ipotecă`, () => [bInst, bGrace, bSched, bTotal, bInterest, bWaterEur, bEnergyEur, bSavH, bNet], { optionId: 'B', scheduleType: 'SEASONAL', firstInstallmentMonth: schB.series[grace].period });

  const cmpAdv = R.calc('compare_scenarios', 'compare.net_advantage', 'Avantaj net B față de A', aNetCost - bNetCost, 'EUR', { formula: 'cost net A − cost net B', dependsOn: [aNet, bNet] });
  const dInv = R.calc('compare_scenarios', 'compare.driver.investment', 'Contribuția la avantaj: investment', P.offer - costGreen, 'EUR');
  const dInt = R.calc('compare_scenarios', 'compare.driver.interest', 'Contribuția la avantaj: interest', schA.totalInterest - schB.totalInterest, 'EUR', { dependsOn: [aInterest, bInterest] });
  const dColl = R.calc('compare_scenarios', 'compare.driver.collateral', 'Contribuția la avantaj: collateral', aCollateral, 'EUR', { dependsOn: [aColl] });
  const dSav = R.calc('compare_scenarios', 'compare.driver.savings', 'Contribuția la avantaj: savings', (bSav - aSav) * P.horizonYears, 'EUR', { dependsOn: [aSavH, bSavH] });
  const payback = R.calc('compare_scenarios', 'compare.upgrade_payback', 'Recuperarea investiției suplimentare din economii', (costGreen - P.offer) / ((bSav - aSav) / 12), 'MONTHS', { decimals: 1, formula: 'cost suplimentar / economie lunară suplimentară (fără grant)', dependsOn: [recUpgrade, aSavH, bSavH] });
  R.tool(A2, 'compare_scenarios', 6, { optionIds: ['A', 'B'] }, '🔧 Compar A și B pe 5 ani', `🔧 B costă mai puțin cu ${cmpAdv.display} pe 5 ani; upgrade-ul se recuperează în ${payback.display}`, () => [cmpAdv, dInv, dInt, dColl, dSav, payback], { better: 'B' });

  const aRatio = R.calc('check_affordability', 'option_a.affordability_ratio', 'Ratele din primul an față de cashflow-ul net', (firstYearPayments(schA.series) / P.annualNetCf) * 100, 'PCT', { formula: 'rate pe 12 luni / cashflow net anual (Open Banking)', dependsOn: [aInst] });
  const bRatio = R.calc('check_affordability', 'option_b.affordability_ratio', 'Ratele din primul an față de cashflow-ul net', (firstYearPayments(schB.series) / P.annualNetCf) * 100, 'PCT', { formula: 'rate pe 12 luni / cashflow net anual (Open Banking)', dependsOn: [bInst] });
  R.tool(A2, 'check_affordability', 7, { optionIds: ['A', 'B'] }, '🔧 Verific dacă ratele încap în cashflow', '🔧 Ambele încap; ratele lui A cad și în lunile ianuarie–aprilie, când cashflow-ul e negativ', () => [aRatio, bRatio], { A: { result: 'PASS_WITH_WARNING', deficitMonths: ['2027-02', '2027-03', '2027-04', '2028-01'] }, B: { result: 'PASS', deficitMonths: [] } });

  const dsA = dscrOf(schA.series, P.annualNetCf, aSav);
  const dsB = dscrOf(schB.series, P.annualNetCf, bSav);
  const aDs = R.calc('compute_dscr', 'option_a.debt_service_year', 'Rate și dobânzi în cel mai greu an de credit', dsA.heaviest, 'EUR_PER_YEAR', { dependsOn: [aInst] });
  const aDscr = R.calc('compute_dscr', 'option_a.dscr', 'DSCR: acoperirea ratelor din cashflow și economii', dsA.dscr, 'RATIO', { formula: '(cashflow net anual + economii anuale) / rate și dobânzi pe an, minimul pe anii creditului', sourceRo: 'Open Banking (cashflow pe 12 luni)', dependsOn: [aDs] });
  const bDs = R.calc('compute_dscr', 'option_b.debt_service_year', 'Rate și dobânzi în cel mai greu an de credit', dsB.heaviest, 'EUR_PER_YEAR', { dependsOn: [bInst] });
  const bDscr = R.calc('compute_dscr', 'option_b.dscr', 'DSCR: acoperirea ratelor din cashflow și economii', dsB.dscr, 'RATIO', { formula: '(cashflow net anual + economii anuale) / rate și dobânzi pe an, minimul pe anii creditului', sourceRo: 'Open Banking (cashflow pe 12 luni)', dependsOn: [bDs] });
  R.tool(A2, 'compute_dscr', 7, { optionIds: ['A', 'B'] }, '🔧 Calculez DSCR-ul fiecărei variante', `🔧 DSCR: A ${aDscr.display}, B ${bDscr.display}`, () => [aDs, aDscr, bDs, bDscr], { optionIds: ['A', 'B'] });

  const funding = {
    options: [
      {
        optionId: 'A', kind: 'STANDARD', configId: 'cfg_initial', titleRo: 'Credit clasic pentru aspersie',
        investmentCalcId: cfgInitCost.calcId,
        fundingStack: [
          { itemId: 'fs_a_loan', type: 'STANDARD_LOAN', productId: 'rbro.invest.standard', amountCalcId: stackStdAmt.calcId, rateCalcId: rA.rate.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'EQUAL_MONTHLY', installmentCalcId: aInst.calcId, scheduleCalcId: aSched.calcId }, status: 'AVAILABLE', noteRo: 'Garantat cu ipotecă pe teren.' },
        ],
        headlineInstallmentCalcId: aInst.calcId,
        collateral: ['MORTGAGE'],
        totals: { totalPaymentsCalcId: aTotal.calcId, totalInterestCalcId: aInterest.calcId, collateralCostsCalcId: aColl.calcId, savingsOverHorizonCalcId: aSavH.calcId, netCostCalcId: aNet.calcId },
        annualSavings: [{ metric: 'WATER_COST_SAVED_EUR', calcId: aWaterEur.calcId }, { metric: 'ENERGY_COST_SAVED_EUR', calcId: aEnergyEur.calcId }],
        rate: rA.block,
        affordability: { status: 'PASS_WITH_WARNING', ratioCalcId: aRatio.calcId, limitCalcId: affLimit.calcId, dscrCalcId: aDscr.calcId, debtServiceCalcId: aDs.calcId, noteRo: 'Încape pe an, dar ratele din ianuarie–aprilie cad în luni cu cashflow negativ și se plătesc din rezervă.' },
        greenEligible: false,
      },
      {
        optionId: 'B', kind: 'GREEN_PACKAGE', configId: 'cfg_recommended', titleRo: 'Credit verde Raiffeisen cu rate după recoltă',
        investmentCalcId: recCost.calcId,
        fundingStack: [
          { itemId: 'fs_b_green_loan', type: 'GREEN_LOAN', productId: 'rbro.agri.green_investeu', amountCalcId: stackGreenAmt.calcId, rateCalcId: rB.rate.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'SEASONAL', installmentCalcId: bInst.calcId, scheduleCalcId: bSched.calcId, graceCalcId: bGrace.calcId, paymentMonths: P.cashinMonths }, status: 'TO_CONFIRM', noteRo: 'Rate doar în lunile în care vinzi recolta; condițiile se confirmă cu banca.' },
          { itemId: 'fs_b_guarantee', type: 'GUARANTEE', productId: 'eif.investeu.sustainability', programCode: 'INVESTEU_FEI', amountCalcId: stackGuarAmt.calcId, coverageCalcId: feiCov.calcId, guaranteesItemId: 'fs_b_green_loan', status: 'TO_CONFIRM', noteRo: 'Fără ipotecă, datorită unei garanții europene.' },
        ],
        headlineInstallmentCalcId: bInst.calcId,
        collateral: ['GUARANTEE_INVESTEU_FEI', 'PLEDGE_EQUIPMENT'],
        totals: { totalPaymentsCalcId: bTotal.calcId, totalInterestCalcId: bInterest.calcId, savingsOverHorizonCalcId: bSavH.calcId, netCostCalcId: bNet.calcId },
        annualSavings: [{ metric: 'WATER_COST_SAVED_EUR', calcId: bWaterEur.calcId }, { metric: 'ENERGY_COST_SAVED_EUR', calcId: bEnergyEur.calcId }],
        rate: rB.block,
        affordability: { status: 'PASS', ratioCalcId: bRatio.calcId, limitCalcId: affLimit.calcId, dscrCalcId: bDscr.calcId, debtServiceCalcId: bDs.calcId, noteRo: 'Ratele cad doar în lunile cu încasări mari (iulie–octombrie).' },
        greenEligible: true,
      },
    ],
    recommendedOptionId: 'B',
    recommendationBasis: { greenEligible: true, netAdvantagePositive: aNetCost - bNetCost > 0, affordabilityPassed: true },
    greenTier: tier,
    programChecks: [
      { programCode: 'DR_26', result: 'ELIGIBLE', session: 'NOT_OPEN', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'WATER_METERING', result: 'PASS', noteRo: 'Contorul e inclus în configurația recomandată.' }, { criterion: 'MIN_WATER_SAVING', result: 'PASS', calcId: recPct.calcId }, { criterion: 'SESSION_OPEN', result: 'FAIL', noteRo: 'Ghid publicat, nicio sesiune în 2026.' }], noteRo: 'Proiectul s-ar potrivi, dar nu există sesiune deschisă.' },
      { programCode: 'DR_16', result: 'ELIGIBLE', session: 'NOT_OPEN', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'SECTOR_ELIGIBLE', result: 'PASS', noteRo: 'Legume.' }, { criterion: 'SESSION_OPEN', result: 'FAIL' }], noteRo: 'Ghid publicat, nicio sesiune în 2026.' },
      { programCode: 'DR_12', result: 'NOT_ELIGIBLE', session: 'OPEN', deadline: '2026-12-02T16:00:00+02:00', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/domenii-de-interventie/detalii-si-anexe-dr-12/', criteria: [{ criterion: 'MANAGER_AGE', result: 'FAIL', noteRo: 'Administratorul are 52 de ani; limita e 45.' }], noteRo: 'Deschis, dar ferma nu e eligibilă.' },
      { programCode: 'FM_PV', result: 'NOT_ELIGIBLE', session: 'CLOSED', checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/', criteria: [{ criterion: 'SECTOR_ELIGIBLE', result: 'FAIL', noteRo: 'Configurația nu are pompă solară sau panouri.' }, { criterion: 'SESSION_OPEN', result: 'FAIL', noteRo: 'Sesiunea iunie–august 2026 s-a închis.' }], noteRo: 'Ar finanța o pompă solară, care nu e în configurația recomandată.' },
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
      rateDifferenceCalcId: diff.total.calcId,
      rateDrivers: diff.rateDrivers,
    },
    farmerExplanationRo: `Creditul verde e mai mare cu 28.000 EUR, dar dobânda e ${rB.rate.display} în loc de ${rA.rate.display}, plătești doar în lunile în care vinzi recolta (iulie–octombrie) și nu ai nevoie de ipotecă. Folosești cu 40% mai puțină apă decât azi. Câștigi ${cmpAdv.display} în 5 ani alegând creditul verde.`,
    officerNotesRo: `Opțiunea B: credit verde ${stackGreenAmt.display}, 60 de luni, rate sezoniere iul–oct, garanție InvestEU 70% (fără ipotecă), nivel Verde Plus. Dobânda pe componente: ${rB.rate.display} față de ${rA.rate.display} la creditul clasic (${diff.total.display}). Nu există grant AFIR deschis pentru irigații; DR-12 neeligibil (vârsta administratorului). Parametrii dobânzii sunt valori demo.`,
  };
  R.completed(A2, 'submit_funding_recommendation', `✅ Agentul 2 a terminat: recomand B, avantaj net ${cmpAdv.display} pe 5 ani`, funding, 7, 27400);

  // =================== AGENT 3 ===================
  R.state('AGENT_2', 'AGENT_3', 'Pornește underwriter-ul verde', {}, 300);
  R.started(A3, 'AGENT_3', 'Agentul 3 (underwriter verde) a pornit');
  R.tool(A3, 'get_labeling_rules', 1, { configId: 'cfg_recommended' }, '🔧 Citesc regulile de etichetare', '🔧 Picurare, senzori și contor: verde de piață. Pompa din ofertă nu are etichetă', null, {
    rules: [
      { componentId: 'cmp_offer_ln_2', category: 'PUMP', label: 'NONE' }, { componentId: 'cmp_drip_system', category: 'IRRIGATION_DRIP', label: 'MARKET_GREEN' },
      { componentId: 'cmp_water_meter', category: 'WATER_METER', label: 'MARKET_GREEN' }, { componentId: 'cmp_soil_sensors', category: 'SOIL_MOISTURE_SENSORS', label: 'MARKET_GREEN' },
    ],
  });
  R.tool(A3, 'get_dnsh_criteria', 1, {}, '🔧 Citesc criteriile DNSH', '🔧 5 obiective de verificat: climă (atenuare, adaptare), circularitate, poluare, biodiversitate', null, {
    objectives: ['CLIMATE_MITIGATION', 'CLIMATE_ADAPTATION', 'CIRCULAR_ECONOMY', 'POLLUTION_PREVENTION', 'BIODIVERSITY'],
  });
  const greenAmtValue = P.drip + P.sensorCost + P.meter;
  const greenAmt = R.calc('calculate_impact', 'label.green_amount', 'Sumă etichetată verde', greenAmtValue, 'EUR', { dependsOn: [cDrip, cSens, cMeter] });
  const taxAmt = R.calc('calculate_impact', 'label.taxonomy_amount', 'Din care aliniată la Taxonomia UE', 0, 'EUR');
  const transAmt = R.calc('calculate_impact', 'label.transition_amount', 'Sumă etichetată tranziție', 0, 'EUR');
  const greenPct = R.calc('calculate_impact', 'label.green_share', 'Ponderea verde a investiției', (greenAmtValue / costGreen) * 100, 'PCT', { formula: 'sumă verde / investiție totală', dependsOn: [greenAmt, recCost] });
  const waterH = R.calc('calculate_impact', 'impact.water_horizon', 'Apă economisită pe orizont', green.saved * P.horizonYears, 'M3', { dependsOn: [recSaved, horizon] });
  const energyH = R.calc('calculate_impact', 'impact.energy_horizon', 'Energie economisită pe orizont', green.energySaved * P.horizonYears, 'KWH', { dependsOn: [recKwhSaved, horizon] });
  const co2H = R.calc('calculate_impact', 'impact.co2_horizon', 'CO₂ evitat pe orizont', green.co2 * P.horizonYears, 'T_CO2', { dependsOn: [recCo2, horizon] });
  R.tool(A3, 'calculate_impact', 2, { configId: 'cfg_recommended' }, '🔧 Calculez impactul de mediu', `🔧 ${recSaved.display} apă, ${recKwhSaved.display} energie, ${recCo2.display} evitate`, () => [greenAmt, taxAmt, transAmt, greenPct, waterH, energyH, co2H], { configId: 'cfg_recommended' });

  const fundCov = R.calc('select_fund', 'fund.coverage', 'Acoperirea garanției F1', P.feiCoverage, 'PCT', { sourceRo: 'config/funds.json: F1, acordul FEI cu Raiffeisen din 2023 (procentul pentru 2026, de confirmat)' });
  R.tool(A3, 'select_fund', 3, { optionId: 'B' }, '🔧 Aleg fondul care susține creditul verde', '🔧 F1, garanția FEI InvestEU de sustenabilitate: fondul principal pentru irigații', () => [fundCov], {
    fundId: 'F1', nameRo: 'Garanția FEI InvestEU de sustenabilitate', kind: 'GUARANTEE', role: 'PRIMARY',
    alternatives: [
      { fundId: 'F4', nameRo: 'Finanțare pentru irigații cu FEI (cu RWA Raiffeisen Agro)', status: 'TO_CONFIRM' },
      { fundId: 'F6', nameRo: 'Granturi AFIR / PNS', status: 'NOT_AVAILABLE' },
    ],
  });
  const requirementReasons = {
    SME_STATUS: 'Firma e IMM după bilanțul de la ANAF (angajați, cifră de afaceri, active).',
    ELIGIBLE_CATEGORY: 'Categoria Irigații e legată de fond (README §3.3).',
    TECHNICAL_THRESHOLD: 'Configurația finanțată trece pragul verde, calculat de motor din documente.',
    DNSH: 'DNSH trecut pe toate obiectivele.',
    IMPACT_QUANTIFIED: 'Impactul e calculat de motor pe acest credit.',
    CLIENT_BENEFIT: 'Dobândă mai mică decât la creditul clasic și fără ipotecă.',
    PERIODIC_REPORTING: 'Dosarul are indicatori de monitorizare la 12 luni, din contoare și facturi.',
  };
  const levels = { SME_STATUS: 'REQUIRED', ELIGIBLE_CATEGORY: 'REQUIRED', TECHNICAL_THRESHOLD: 'REQUIRED', DNSH: 'PROBABLE', IMPACT_QUANTIFIED: 'REQUIRED', CLIENT_BENEFIT: 'REQUIRED', PERIODIC_REPORTING: 'REQUIRED' };
  R.tool(A3, 'check_fund_requirements', 3, { fundId: 'F1', optionId: 'B' }, '🔧 Bifez cerințele fondului F1', '🔧 F1: 7 din 7 cerințe îndeplinite', null, {
    fundId: 'F1',
    requirements: Object.keys(levels).map((id) => ({ requirementId: id, level: levels[id], status: 'MET', reasonRo: requirementReasons[id] })),
    allMet: true,
  });
  R.tool(A3, 'get_bond_category', 3, {}, '🔧 Caut categoria din cadrul obligațiunilor verzi', '🔧 Categoria propusă: Agriculture and forestry', null, {
    categories: [{ categoryId: 'AGRICULTURE_FORESTRY', nameEn: 'Agriculture and forestry', nameRo: 'Agricultură și silvicultură' }],
    proposed: 'AGRICULTURE_FORESTRY', sourceRo: 'README §3.1: categoriile cadrului de obligațiuni verzi și sustenabile Raiffeisen (Sustainalytics, Second Party Opinion 2024)',
  });

  const report = {
    decision: 'ELIGIBLE_WITH_CONDITIONS',
    moduleId: 'irigatii',
    recommendedOptionId: 'B',
    criterion: { indicator: 'WATER_SAVING_PCT', valueCalcId: recPct.calcId, thresholdCalcId: threshold.calcId, result: 'PASS', sourceRo: 'README §6.1: economie de apă ≥ 25% față de sistemul actual (propunere, de confirmat cu Raiffeisen); minimul AFIR la modernizare e 10%.' },
    componentLabels: [
      { componentId: 'cmp_offer_ln_2', label: 'NONE', basis: 'NONE', amountCalcId: offerPumpCost.calcId, rationaleRo: 'Pompa din ofertă rămâne; nu e o investiție verde în sine.' },
      { componentId: 'cmp_drip_system', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cDrip.calcId, rationaleRo: 'Irigare prin picurare cu economie de apă măsurabilă peste prag.' },
      { componentId: 'cmp_water_meter', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cMeter.calcId, rationaleRo: 'Contorizarea face economia verificabilă; obligatorie pentru monitorizare.' },
      { componentId: 'cmp_soil_sensors', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: cSens.calcId, rationaleRo: 'Reduc udarea inutilă; duc pachetul la Verde Plus.' },
    ],
    greenShare: { greenAmountCalcId: greenAmt.calcId, transitionAmountCalcId: transAmt.calcId, greenSharePctCalcId: greenPct.calcId },
    greenBond: { category: 'AGRICULTURE_FORESTRY', status: 'TO_CONFIRM', eligibleAmountCalcId: greenAmt.calcId, noteRo: 'Categoria „Agriculture and forestry” exista în cadrul RBRO 2022; cadrul RBI 2025 nu o mai are. De confirmat cu echipa Green Bonds.' },
    fund: {
      fundId: 'F1', role: 'PRIMARY',
      requirements: [
        { requirementId: 'SME_STATUS', level: 'REQUIRED', status: 'MET', noteRo: 'IMM după bilanțul ANAF pe 2025.' },
        { requirementId: 'ELIGIBLE_CATEGORY', level: 'REQUIRED', status: 'MET', noteRo: 'Irigațiile intră în investițiile verzi acoperite de garanție.' },
        { requirementId: 'TECHNICAL_THRESHOLD', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [recPct.calcId, threshold.calcId], noteRo: 'Economia de apă a configurației recomandate trece pragul de 25%.' },
        { requirementId: 'DNSH', level: 'PROBABLE', status: 'MET', noteRo: 'Trecut pe toate obiectivele.' },
        { requirementId: 'IMPACT_QUANTIFIED', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [recSaved.calcId, recCo2.calcId], noteRo: 'Apa și energia economisite, calculate pe acest credit.' },
        { requirementId: 'CLIENT_BENEFIT', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [diff.total.calcId], noteRo: 'Dobândă mai mică și fără ipotecă față de creditul clasic.' },
        { requirementId: 'PERIODIC_REPORTING', level: 'REQUIRED', status: 'MET', noteRo: 'Contorul de apă și facturile de energie, la 12 luni.' },
      ],
      alternatives: [
        { fundId: 'F4', status: 'TO_CONFIRM', noteRo: 'Finanțarea pentru irigații cu FEI poate înlocui F1 dacă mai e activă; de confirmat cu Raiffeisen.' },
        { fundId: 'F6', status: 'NOT_AVAILABLE', noteRo: 'Nicio sesiune AFIR deschisă pentru care ferma e eligibilă.' },
      ],
    },
    substantialContribution: 'WATER_MARINE_RESOURCES',
    dnsh: [
      { objective: 'CLIMATE_MITIGATION', status: 'PASS', justificationRo: 'Picurarea cu senzori consumă mai puțină energie de pompare decât brazdele de azi.', evidence: ['ENERGY_INVOICES', 'TECHNICAL_SHEET'] },
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', justificationRo: 'Parcelele au risc de secetă ridicat; picurarea cu senzori crește reziliența culturilor.', evidence: [] },
      { objective: 'CIRCULAR_ECONOMY', status: 'PASS', justificationRo: 'Nu se înlocuiește un echipament existent; tuburile de picurare uzate se predau furnizorului, angajament cerut în oferta finală.', evidence: [] },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS', justificationRo: 'Nicio parcelă în zonă vulnerabilă la nitrați.', evidence: [] },
      { objective: 'BIODIVERSITY', status: 'PASS', justificationRo: 'Nicio parcelă nu se suprapune cu situri Natura 2000.', evidence: [] },
    ],
    impact: [
      { metric: 'WATER_SAVED_M3', calcId: recSaved.calcId, period: 'ANNUAL' },
      { metric: 'WATER_SAVING_PCT', calcId: recPct.calcId, period: 'ANNUAL' },
      { metric: 'ENERGY_SAVED_KWH', calcId: recKwhSaved.calcId, period: 'ANNUAL' },
      { metric: 'CO2_AVOIDED_T', calcId: recCo2.calcId, period: 'ANNUAL' },
      { metric: 'WATER_SAVED_M3', calcId: waterH.calcId, period: 'HORIZON' },
      { metric: 'CO2_AVOIDED_T', calcId: co2H.calcId, period: 'HORIZON' },
    ],
    conditionsPrecedent: [
      { conditionId: 'cp_investeu_guarantee', type: 'GUARANTEE_APPROVAL', documentType: 'GUARANTEE_APPROVAL', descriptionRo: 'Includerea creditului în portofoliul garantat InvestEU (FEI).', timing: 'BEFORE_SIGNING', blocking: true },
      { conditionId: 'cp_final_offer', type: 'DOCUMENT', documentType: 'OFFER', descriptionRo: 'Oferta finală a furnizorului pentru picurare, senzori și contor, cu preluarea tuburilor uzate la reciclare; suma se ajustează după ea.', timing: 'BEFORE_FIRST_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_final_invoice', type: 'INVOICE_MATCH', documentType: 'FINAL_INVOICE', descriptionRo: 'Factura finală corespunde configurației aprobate: picurare, senzori, contor.', timing: 'BEFORE_FINAL_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_commissioning', type: 'DOCUMENT', documentType: 'COMMISSIONING_REPORT', descriptionRo: 'Proces-verbal de punere în funcțiune și poze geolocalizate.', timing: 'AFTER_INSTALLATION', blocking: false },
      { conditionId: 'cp_water_meter', type: 'TECHNICAL_SPEC', documentType: 'WATER_METER_CERTIFICATE', descriptionRo: 'Certificatul metrologic al contorului de apă montat.', timing: 'AFTER_INSTALLATION', blocking: false, missingFieldKey: 'water_meter_certificate' },
    ],
    monitoringKpis: [
      { kpiId: 'kpi_water_use', metric: 'WATER_USE_M3', targetCalcId: recWater.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'WATER_METER', descriptionRo: 'Consumul real de apă, citit de pe contor, comparat cu estimarea.' },
      { kpiId: 'kpi_pumping_energy', metric: 'PUMPING_ENERGY_KWH', targetCalcId: recKwh.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'INVOICES', descriptionRo: 'Energia folosită la pompare, din facturi.' },
      { kpiId: 'kpi_commissioning', metric: 'WATER_SAVING_PCT', targetCalcId: recPct.calcId, frequency: 'ONCE', firstDue: 'AFTER_INSTALLATION', dataSource: 'COMMISSIONING_REPORT', descriptionRo: 'Sistemul montat corespunde configurației care trece pragul.' },
      { kpiId: 'kpi_satellite', metric: 'AREA_HA', targetCalcId: area.calcId, frequency: 'SEMIANNUAL', firstDue: 'MONTH_6', dataSource: 'SATELLITE', descriptionRo: 'Parcelele sunt cultivate și vegetația e sănătoasă (Sentinel-2).' },
    ],
    risks: [
      { category: 'CLIMATE_DROUGHT', severity: 'HIGH', descriptionRo: 'Sud-estul are risc ridicat de secetă.', mitigationRo: 'Picurarea și senzorii reduc expunerea; recomandăm asigurarea culturilor.' },
      { category: 'WATER_AVAILABILITY', severity: 'MEDIUM', descriptionRo: 'Stres hidric ridicat în zonă.', mitigationRo: 'Consumul nou (141.200 m³) e mult sub volumul autorizat de ANAR (240.000 m³).' },
      { category: 'DATA_QUALITY', severity: 'LOW', descriptionRo: 'Facturile de energie acoperă tot locul de consum, nu doar pompa.', mitigationRo: 'Contorul și KPI-ul de energie corectează estimarea după 12 luni.' },
    ],
    committeeSummaryRo: `Fermă de legume, 40 ha, sud-est, irigată azi prin brazde. Aspersia cerută (85.000 EUR) economisea ${cfgInitPct.display} apă (sub pragul de 25%) și creștea energia de pompare. Configurația recomandată (picurare, senzori, contor, 113.000 EUR) atinge ${recPct.display}: nivel Verde Plus, DNSH trecut pe toate obiectivele. Credit verde cu garanție InvestEU 70%, fără ipotecă, rate sezoniere iul–oct, la ${rB.rate.display} față de ${rA.rate.display}; avantaj net pentru client ${cmpAdv.display} pe 5 ani. Recomandare: eligibil cu condiții (aprobarea garanției, oferta și factura finală).`,
    farmerNextSteps: [
      { stepRo: 'Cere furnizorului oferta finală pentru picurare, senzori și contor, cu preluarea tuburilor uzate.', conditionId: 'cp_final_offer' },
      { stepRo: 'După montaj: procesul-verbal de punere în funcțiune și poze geolocalizate.', conditionId: 'cp_commissioning' },
      { stepRo: 'După montaj: certificatul metrologic al contorului de apă.', conditionId: 'cp_water_meter' },
      { stepRo: 'La 12 luni: citirea contorului de apă și facturile de energie.' },
    ],
  };
  R.completed(A3, 'submit_underwriting_report', '✅ Agentul 3 a terminat: eligibil verde cu condiții, nivel Verde Plus', report, 6, 21600);

  R.state('AGENT_3', 'GATA', 'Ofertele sunt gata; fermierul alege varianta și trimite cererea', {}, 300);
  const t0 = Date.parse('2026-10-28T09:30:00.000Z');
  R.emit('run.completed', null, `Analiză completă: eligibil cu condiții, recomandăm B (+${cmpAdv.display} în 5 ani)`, {
    state: 'GATA', durationMs: R.t - t0 + 200, decision: 'ELIGIBLE_WITH_CONDITIONS', recommendedOptionId: 'B', netAdvantageCalcId: cmpAdv.calcId,
    sources: { TECHNICAL_AUDITOR: 'LIVE', FUNDING_OPTIMIZER: 'LIVE', GREEN_UNDERWRITER: 'LIVE' },
  }, 200);
  R.state('GATA', 'TRIMIS', 'Cererea a fost trimisă la bancă: Credit verde', { actor: 'FARMER' }, 40000);
  R.state('TRIMIS', 'APROBAT', 'Banca a aprobat dosarul cu condițiile propuse', { actor: 'OFFICER', reasonRo: 'Aprobat cu cele 5 condiții din raport.' }, 5000);
  R.state('APROBAT', 'MONITORIZARE', 'Tragere simulată în demo; încep verificările de monitorizare', { reasonRo: 'Demo: tragerea e simulată imediat după aprobare.' }, 3000);

  return { R, assessment, funding, report, extractions: [extractionOffer, extractionPermit, extractionEnergy] };
}

// =====================================================================
// Scenario 2: utilaje — 400 ha cereal farm, manager aged 38
// =====================================================================

function buildUtilaje() {
  const R = new RunBuilder('run_utl3m8vz2c6h', '2026-10-28T10:15:00.000Z');
  // README §6.3: 400 ha of cereals, 4 tractors over 20 years old replaced by 4 Stage V tractors; the farmer chose 7 years.
  // The green offer is the green credit with the FEI guarantee (F1); the DR-12 grant is shown only as an alternative.
  const P = {
    areaHa: 400, invoiceLitres: 36180, nKgHa: 150, gNew: 246, gOld: 280, precisionFuelSaving: 0.1, vraSaving: 0.05,
    fuelPriceLei: 10.3, vat: 1.21, excise: 2.697, eurRon: 4.97, co2PerL: 2.68, co2PerKgN: 4.29, nPrice: 1.1,
    threshold: 20, tractor240: 250000, tractor180: 190000, precisionPerTractor: 13000, tractors: 4, powerHp: 840, maxHpHa: 2.5,
    newTractorEurPerHp: 525, grantIntensity: 65, grantCap: 200000, term: 84, horizonYears: 7, feiCoverage: 70,
    mortgageInitial: 1450, mortgageAnnual: 380, annualNetCf: 240000, affordLimit: 40, precisionPoints: 15,
    cashinMonths: ['JUL', 'AUG', 'SEP', 'OCT'],
  };
  const offer = P.tractor240 + P.tractor180;
  const precision = P.precisionPerTractor * P.tractors;
  const recTotal = offer + precision;

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
  const oCount = R.calc('extract_document', 'doc.offer.quantity', 'Număr tractoare', P.tractors, 'COUNT', { sourceRo: 'Oferta AgroTrac' });
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

  const invLitres = R.calc('extract_document', 'doc.fuel.litres_12m', 'Motorină facturată (12 luni)', P.invoiceLitres, 'L_PER_YEAR', { sourceRo: 'Facturi motorină 10.2025–09.2026' });
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

  const fuelEur = (P.fuelPriceLei / P.vat - P.excise) / P.eurRon;
  const thr = R.calc('get_module_rules', 'rules.threshold.fuel_saving', 'Pragul verde: economie de motorină', P.threshold, 'PCT', { sourceRo: 'README §6.3: reducere ≥ 20% de motorină pe hectar sau de azot pe hectar, cu motor Stage V (propunere, de confirmat cu Raiffeisen)' });
  const lHa = R.calc('get_module_rules', 'rules.norm.l_per_ha', 'Norma de motorină (doar fără facturi)', 90, 'L_PER_HA', { sourceRo: 'config/modules/utilaje.json (estimare echipă)' });
  const sTractor = R.calc('get_module_rules', 'rules.saving.new_vs_old', 'Economie tractor nou față de unul de peste 15 ani', (1 - P.gNew / P.gOld) * 100, 'PCT', { formula: '1 − g/kWh tractor nou / g/kWh tractor vechi', sourceRo: 'config/modules/utilaje.json: 246 g/kWh nou (DLG PowerMix), 280 g/kWh peste 15 ani (Nebraska/UNL)' });
  const fuelPrice = R.calc('get_module_rules', 'rules.price.fuel_net', 'Costul net al motorinei', fuelEur, 'EUR_PER_L', { formula: '(preț la pompă / (1 + TVA) − acciză rambursată) / curs EUR', sourceRo: 'config/prices.json; acciză APIA 2026' });
  const co2L = R.calc('get_module_rules', 'rules.factor.diesel', 'Factor de emisie motorină', P.co2PerL, 'KG_CO2_PER_L', { sourceRo: 'config/factors.json (README §6: 2,68 kg/l)' });
  const co2N = R.calc('get_module_rules', 'rules.factor.nitrogen', 'Factor de emisie azot (kg CO₂e / kg N)', P.co2PerKgN, 'RATIO', { sourceRo: 'config/factors.json (IPCC: 1% din N aplicat × 44/28 × 273)' });
  const nPrice = R.calc('get_module_rules', 'rules.price.nitrogen', 'Prețul azotului', P.nPrice, 'EUR_PER_KG', { sourceRo: 'config/prices.json (estimare echipă)' });
  const maxHpHa = R.calc('get_module_rules', 'rules.sizing.max_hp_ha', 'Putere maximă pe hectar', P.maxHpHa, 'HP_PER_HA', { sourceRo: 'config/modules/utilaje.json (valoare demo, de verificat în Anexa 6 DR-12)' });
  R.tool(A1, 'get_module_rules', 2, { moduleId: 'utilaje' }, '🔧 Citesc regulile modulului Utilaje & precizie', '🔧 Prag verde: −20% motorină sau azot pe hectar, motor Stage V', () => [thr, lHa, sTractor, fuelPrice, co2L, co2N, nPrice, maxHpHa], { indicator: 'FUEL_SAVING_PCT', calculator: 'machinery', thresholdKind: 'MIN_PCT' });

  const baseL = P.invoiceLitres;
  const baseN = P.areaHa * P.nKgHa;
  const area = R.calc('compute_baseline', 'baseline.area', 'Suprafața lucrată', P.areaHa, 'HA', { sourceRo: 'APIA' });
  const basePerHa = R.calc('compute_baseline', 'baseline.fuel_per_ha', 'Motorină pe hectar azi', baseL / P.areaHa, 'L_PER_HA', { formula: 'litri din facturile pe 12 luni / ha lucrate', sourceRo: 'facturile de motorină', dependsOn: [area, invLitres] });
  const baseFuel = R.calc('compute_baseline', 'baseline.fuel', 'Motorină consumată azi', baseL, 'L_PER_YEAR', { formula: 'l/ha × ha', dependsOn: [basePerHa, area] });
  const bN = R.calc('compute_baseline', 'baseline.nitrogen', 'Azot aplicat azi', baseN, 'KG_N_PER_YEAR', { formula: 'ha × kg N/ha (chestionar)', dependsOn: [area] });
  const bCo2 = R.calc('compute_baseline', 'baseline.co2', 'CO₂ din motorină azi', (baseL * P.co2PerL) / 1000, 'T_CO2_PER_YEAR', { formula: 'l × factor motorină', dependsOn: [baseFuel, co2L] });
  const fleetTotal = R.calc('compute_baseline', 'baseline.fleet_total', 'Tractoare în fermă azi', 4, 'COUNT');
  const fleetReplaced = R.calc('compute_baseline', 'baseline.fleet_replaced', 'Tractoare scoase din fermă după investiție', 4, 'COUNT');
  const fleetAge = R.calc('compute_baseline', 'baseline.replaced_age', 'Vechimea tractoarelor înlocuite', 22, 'YEARS');
  R.tool(A1, 'compute_baseline', 2, { currentFleet: { totalCount: 4, replacedCount: 4, averageAgeYears: 22 } }, '🔧 Calculez situația actuală (4 tractoare de peste 20 de ani)', `🔧 Azi: ${basePerHa.display} motorină, ${baseFuel.display} și ${bCo2.display}`, () => [area, basePerHa, baseFuel, bN, bCo2, fleetTotal, fleetReplaced, fleetAge], { dataSource: 'INVOICES', fleetChange: 'FULL_REPLACEMENT' });

  const tractorSaving = 1 - P.gNew / P.gOld;
  const fuelSaving = 1 - (1 - tractorSaving) * (1 - P.precisionFuelSaving);
  const aL = baseL * tractorSaving;
  const bL = baseL * fuelSaving;
  const bNSaved = baseN * P.vraSaving;
  const iCost = R.calc('compute_indicator', 'cfg_initial.total_cost', 'Cost total cfg_initial', offer, 'EUR', { dependsOn: [oTotal] });
  const iTractor = R.calc('compute_indicator', 'cfg_initial.tractor_saving_pct', 'Economie din tractoare (vechime, flotă înlocuită)', tractorSaving * 100, 'PCT', { formula: '(1 − g/kWh tractor ofertat / g/kWh tractor înlocuit) × tractoare scoase / flotă', dependsOn: [sTractor] });
  const iPct = R.calc('compute_indicator', 'cfg_initial.fuel_saving_pct', 'Economie de motorină pe hectar', tractorSaving * 100, 'PCT', { formula: '1 − l/ha nou / l/ha azi = 1 − (1 − s_tractor) × (1 − s_precizie)', dependsOn: [iTractor] });
  const iSaved = R.calc('compute_indicator', 'cfg_initial.fuel_saved', 'Motorină economisită pe an', aL, 'L_PER_YEAR', { dependsOn: [baseFuel, iPct] });
  const iFuelUse = R.calc('compute_indicator', 'cfg_initial.fuel_use', 'Consum de motorină după investiție', baseL - aL, 'L_PER_YEAR');
  const sizing = R.calc('compute_indicator', 'cfg_initial.hp_per_ha', 'Putere pe hectar', P.powerHp / P.areaHa, 'HP_PER_HA', { formula: 'CP total / ha', dependsOn: [oPower, area] });
  const iCo2 = R.calc('compute_indicator', 'cfg_initial.co2_avoided', 'CO₂e evitat pe an (motorină + azot)', (aL * P.co2PerL) / 1000, 'T_CO2_PER_YEAR', { formula: '(Δ litri × 2,68 + Δ kg N × 4,29) / 1000', dependsOn: [iSaved, co2L] });
  R.tool(A1, 'compute_indicator', 3, { configId: 'cfg_initial', documentId: 'doc_oferta_tractoare' }, '🔧 Verific pragul pentru tractoarele din ofertă', `🔧 Tractoarele noi economisesc ${iPct.display} motorină. NU TRECE (prag 20%). Dimensionare: ${sizing.display}, în limită`, () => [iCost, iTractor, iPct, iSaved, iFuelUse, sizing, iCo2], { configId: 'cfg_initial', thresholdResult: 'FAIL', meetsSafetyMargin: false, sizing: 'PASS' });

  R.thought(A1, 'Tractoarele Stage V aduc doar 12% economie de motorină: sunt tranziție, nu verde. Caut în catalog pachetul care trece pragul de 20%.', 3);

  const candPrecPct = R.calc('search_upgrades', 'cand.precision.pct', 'Indicator cu pachetul pkg_precision', fuelSaving * 100, 'PCT');
  const candPrecCost = R.calc('search_upgrades', 'cand.precision.cost', 'Cost total cu pachetul pkg_precision', recTotal, 'EUR');
  const candTracPct = R.calc('search_upgrades', 'cand.tractor.pct', 'Indicator cu pachetul pkg_tractor', tractorSaving * 100, 'PCT');
  const candTracCost = R.calc('search_upgrades', 'cand.tractor.cost', 'Cost total cu pachetul pkg_tractor', P.powerHp * P.newTractorEurPerHp, 'EUR');
  R.tool(A1, 'search_upgrades', 4, { baseConfigId: 'cfg_initial' }, '🔧 Caut upgrade-uri în catalogul de utilaje', `🔧 Pachetul de precizie trece pragul: ${candPrecPct.display}`, () => [candTracPct, candTracCost, candPrecPct, candPrecCost], {
    candidates: [
      { packageId: 'pkg_tractor', catalogIds: ['utl.tractor.new_stage_v'], thresholdResult: 'FAIL', meetsSafetyMargin: false },
      { packageId: 'pkg_precision', catalogIds: ['utl.precision.rtk_sc_vra'], thresholdResult: 'PASS', meetsSafetyMargin: false },
    ],
  });

  const rCost = R.calc('simulate_upgrade_package', 'cfg_recommended.total_cost', 'Cost total cfg_recommended', recTotal, 'EUR');
  const rUp = R.calc('simulate_upgrade_package', 'cfg_recommended.upgrade_cost', 'Cost suplimentar față de oferta inițială', precision, 'EUR', { sourceRo: 'data/catalog/utilaje.json: utl.precision.rtk_sc_vra' });
  const rPct = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_saving_pct', 'Economie de motorină pe hectar', fuelSaving * 100, 'PCT', { formula: '1 − l/ha nou / l/ha azi = 1 − (1 − s_tractor) × (1 − s_precizie)', dependsOn: [iTractor] });
  const rSaved = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_saved', 'Motorină economisită pe an', bL, 'L_PER_YEAR', { dependsOn: [baseFuel, rPct] });
  const rFuelUse = R.calc('simulate_upgrade_package', 'cfg_recommended.fuel_use', 'Consum de motorină după investiție', baseL - bL, 'L_PER_YEAR', { dependsOn: [baseFuel, rSaved] });
  const rNPct = R.calc('simulate_upgrade_package', 'cfg_recommended.nitrogen_saving_pct', 'Reducerea dozei de azot', P.vraSaving * 100, 'PCT');
  const rN = R.calc('simulate_upgrade_package', 'cfg_recommended.nitrogen_saved', 'Azot economisit pe an', bNSaved, 'KG_N_PER_YEAR', { formula: 'ha × kg N/ha × reducerea dozei', dependsOn: [bN, rNPct] });
  const rNCost = R.calc('simulate_upgrade_package', 'cfg_recommended.nitrogen_cost_saved', 'Cost cu azotul economisit pe an', bNSaved * P.nPrice, 'EUR_PER_YEAR', { formula: 'kg N × preț azot', dependsOn: [rN, nPrice] });
  const rShare = R.calc('simulate_upgrade_package', 'cfg_recommended.precision_share', 'Ponderea agriculturii de precizie', (precision / recTotal) * 100, 'PCT', { formula: 'cost precizie / cost total', dependsOn: [rUp, rCost] });
  const rCo2Value = (bL * P.co2PerL + bNSaved * P.co2PerKgN) / 1000;
  const rCo2 = R.calc('simulate_upgrade_package', 'cfg_recommended.co2_avoided', 'CO₂e evitat pe an (motorină + azot)', rCo2Value, 'T_CO2_PER_YEAR', { formula: '(Δ litri × 2,68 + Δ kg N × 4,29) / 1000', dependsOn: [rSaved, rN, co2L, co2N] });
  R.tool(A1, 'simulate_upgrade_package', 4, { baseConfigId: 'cfg_initial', configId: 'cfg_recommended', add: ['utl.precision.rtk_sc_vra'] }, '🔧 Simulez tractoare + pachet de precizie', `🔧 Tractoare + precizie: ${rPct.display} economie de motorină. TRECE (prag 20%)`, () => [rCost, rUp, rPct, rSaved, rFuelUse, rNPct, rN, rNCost, rShare, rCo2], { configId: 'cfg_recommended', thresholdResult: 'PASS', meetsSafetyMargin: false });

  R.tool(A1, 'check_dnsh_inputs', 5, { configId: 'cfg_recommended' }, '🔧 Verific datele pentru DNSH', '🔧 Motoare Stage V; tractoarele vechi trebuie casate; nicio parcelă în Natura 2000', null, {
    natura2000Parcels: [], nitrateVulnerableParcels: [], droughtRisk: 'MEDIUM', oldEquipmentFate: 'CASARE', emissionStages: ['ln_1: Stage V', 'ln_2: Stage V'], tillage: 'ARATURA', usedEquipment: [],
  });

  const assessment = {
    moduleId: 'utilaje',
    indicator: 'FUEL_SAVING_PCT',
    threshold: { thresholdCalcId: thr.calcId, sourceRo: 'README §6.3: reducere ≥ 20% de motorină pe hectar sau de azot pe hectar, cu motor Stage V (propunere, de confirmat cu Raiffeisen)' },
    baseline: {
      descriptionRo: '4 tractoare de peste 20 de ani pe 400 ha de cereale. Motorina pe hectar vine din facturile pe 12 luni.',
      dataSource: 'INVOICES',
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
          { componentId: 'cmp_offer_ln_1', category: 'TRACTOR', nameRo: '2 tractoare 240 CP, Stage V', source: 'OFFER', costCalcId: o240.calcId },
          { componentId: 'cmp_offer_ln_2', category: 'TRACTOR', nameRo: '2 tractoare 180 CP, Stage V', source: 'OFFER', costCalcId: o180.calcId },
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
          { componentId: 'cmp_offer_ln_1', category: 'TRACTOR', nameRo: '2 tractoare 240 CP, Stage V', source: 'OFFER', costCalcId: o240.calcId },
          { componentId: 'cmp_offer_ln_2', category: 'TRACTOR', nameRo: '2 tractoare 180 CP, Stage V', source: 'OFFER', costCalcId: o180.calcId },
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
          { metric: 'INPUTS_COST_SAVED_EUR', calcId: rNCost.calcId },
          { metric: 'CO2_AVOIDED_T', calcId: rCo2.calcId },
          { metric: 'PRECISION_SHARE_PCT', calcId: rShare.calcId },
        ],
        noteRo: 'Precizia depășește 10% din valoarea investiției; contează și la DR-12, dacă fermierul cere grantul.',
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
    summaryRo: `Cele 4 tractoare Stage V (440.000 EUR) economisesc ${iPct.display} motorină, sub pragul de 20%: sunt investiție de tranziție. Cu pachetul de precizie (52.000 EUR) economia ajunge la ${rPct.display}: ${rSaved.display} motorină și ${rN.display}, adică ${rCo2.display} CO₂e evitat. Dimensionarea e în limită (2,10 CP/ha).`,
    farmerMessageRo: 'Tractoarele noi economisesc 12% motorină. Cu un pachet de precizie (GPS RTK, oprire pe secțiuni, doză variabilă) ajungi la 21% și folosești mai puțin azot.',
  };
  R.completed(A1, 'submit_technical_assessment', `✅ Agentul 1 a terminat: sub prag → precizie → ${rPct.display}, peste prag`, assessment, 5, 28900);

  // =================== AGENT 2 ===================
  R.state('AGENT_1', 'AGENT_2', 'Pornește optimizatorul de finanțare', {}, 300);
  R.started(A2, 'AGENT_2', 'Agentul 2 (finanțare) a pornit');

  const term = R.calc('list_financing_lines', 'line.term', 'Durata creditului', P.term, 'MONTHS', { sourceRo: 'chestionar: 7 ani (implicit 5, config/modules/utilaje.json)' });
  const horizon = R.calc('list_financing_lines', 'line.horizon', 'Orizontul comparației', P.horizonYears, 'YEARS', { sourceRo: 'durata aleasă de fermier' });
  const affLimit = R.calc('list_financing_lines', 'line.affordability_limit', 'Limita ratelor față de cashflow', P.affordLimit, 'PCT', { sourceRo: 'config/financing-lines.json (demo)' });
  const mortInit = R.calc('list_financing_lines', 'line.standard.collateral_initial', 'Costuri inițiale ipotecă', P.mortgageInitial, 'EUR', { sourceRo: 'config/financing-lines.json (demo)' });
  const mortAnnual = R.calc('list_financing_lines', 'line.standard.collateral_annual', 'Costuri anuale ipotecă', P.mortgageAnnual, 'EUR_PER_YEAR', { sourceRo: 'config/financing-lines.json (demo)' });
  const feiCov = R.calc('list_financing_lines', 'guarantee.sustainability.coverage', 'Garanție FEI – InvestEU Sustainability', P.feiCoverage, 'PCT', { sourceRo: 'Acord FEI cu Raiffeisen, 25.10.2023; procentul pentru 2026 e de confirmat' });
  R.tool(A2, 'list_financing_lines', 1, { termMonths: P.term }, '🔧 Citesc liniile de finanțare Raiffeisen', '🔧 Credit standard cu ipotecă, credit verde cu garanție FEI 70%; cofinanțarea AFIR și puntea rămân pentru varianta cu grant', () => [mortInit, mortAnnual, feiCov, term, horizon, affLimit], {
    lines: [
      { lineId: 'rbro.invest.standard', kind: 'STANDARD_LOAN', green: false, collateral: 'MORTGAGE', repayment: ['EQUAL_MONTHLY'], rate: 'PRICED_BY_PRICE_LOAN' },
      { lineId: 'rbro.agri.green_investeu', kind: 'GREEN_LOAN', green: true, collateral: 'GUARANTEE', repayment: ['EQUAL_MONTHLY', 'SEASONAL'], rate: 'PRICED_BY_PRICE_LOAN', guaranteeId: 'eif.investeu.sustainability' },
    ],
  });

  const gInt = R.calc('check_program_eligibility', 'dr_12.intensity', 'Intensitatea grantului DR-12', P.grantIntensity, 'PCT', { sourceRo: 'config/funding-programs.json: DR-12 (≤45 ani: 65%; ≤40 ani + competențe: 80%)' });
  const gCap = R.calc('check_program_eligibility', 'dr_12.cap', 'Plafonul grantului DR-12', P.grantCap, 'EUR', { sourceRo: 'Ghidul solicitantului DR-12, 18.09.2026' });
  const gPts = R.calc('check_program_eligibility', 'dr_12.precision_points', 'Punctaj pentru precizie ≥ 10%', P.precisionPoints, 'POINTS', { sourceRo: 'Ghidul DR-12, criteriile de selecție', dependsOn: [rShare] });
  const age = R.calc('check_program_eligibility', 'dr_12.manager_age', 'Vârsta administratorului', 38, 'YEARS', { sourceRo: 'ONRC (mock)' });
  R.tool(A2, 'check_program_eligibility', 2, { configId: 'cfg_recommended' }, '🔧 Verific DR-12, FGCR și celelalte programe', '🔧 DR-12 deschis până la 02.12.2026: ferma e eligibilă, 65%, plafon 200.000 EUR', () => [gInt, gCap, gPts, age], {
    programs: [
      { programCode: 'DR_12', result: 'ELIGIBLE', session: 'OPEN' },
      { programCode: 'FGCR', result: 'ELIGIBLE', session: 'PERMANENT' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT' },
      { programCode: 'RABLA_AGRI', result: 'ELIGIBLE', session: 'NO_BUDGET' },
    ],
  });

  const verdePlusMultiplier = 1.5;
  const requestedPct = tractorSaving * 100;
  const financedPct = fuelSaving * 100;
  const dnshOverall = worstDnsh(assessment.dnshChecks);
  const tierName = greenTierOf(P.threshold, verdePlusMultiplier, requestedPct, financedPct, dnshOverall);
  const tierThr = R.calc('determine_green_tier', 'green_tier.threshold', 'Pragul verde', P.threshold, 'PCT', { sourceRo: 'README §6.3 (propunere, de confirmat cu Raiffeisen)' });
  const tierReq = R.calc('determine_green_tier', 'green_tier.requested_indicator', 'Indicatorul investiției cerute', requestedPct, 'PCT');
  const tierFin = R.calc('determine_green_tier', 'green_tier.financed_indicator', 'Indicatorul investiției finanțate de creditul verde', financedPct, 'PCT');
  const tierPlus = R.calc('determine_green_tier', 'green_tier.verde_plus_min', 'Pragul pentru Verde Plus', P.threshold * verdePlusMultiplier, 'PCT', { formula: 'prag × multiplicator', sourceRo: 'config/pricing.json: greenTiers.verdePlusThresholdMultiplier (README §4, pasul 8)', dependsOn: [tierThr] });
  const tier = {
    tier: tierName, thresholdMet: financedPct >= P.threshold, upgradeNeeded: requestedPct < P.threshold, dnshStatus: dnshOverall,
    thresholdCalcId: tierThr.calcId, requestedIndicatorCalcId: tierReq.calcId, financedIndicatorCalcId: tierFin.calcId, verdePlusMinCalcId: tierPlus.calcId,
  };
  R.tool(A2, 'determine_green_tier', 3, { requestedConfigId: 'cfg_initial', financedConfigId: 'cfg_recommended' }, '🔧 Stabilesc nivelul verde', `🔧 Verde cu upgrade: ${tierFin.display} față de pragul de ${tierThr.display}; Verde Plus ar cere ${tierPlus.display}`, () => [tierThr, tierReq, tierFin, tierPlus], { tier: tierName, thresholdMet: tier.thresholdMet, upgradeNeeded: tier.upgradeNeeded, dnshStatus: dnshOverall });

  R.thought(A2, 'Ferma e eligibilă și la DR-12 (65%, plafon 200.000 EUR), dar oferta verde e creditul cu garanție FEI: îl prezint pe acela și arăt grantul ca alternativă pe care fermierul o poate cere separat. Ratele merg după recoltă (iulie–octombrie), pe 7 ani, cum a ales fermierul.', 3);

  const fsStd = R.calc('build_funding_stack', 'option_a.loan.amount', 'Credit standard de investiții', offer, 'EUR', { dependsOn: [iCost] });
  const fsGreen = R.calc('build_funding_stack', 'option_b.loan.amount', 'Credit verde Raiffeisen pentru agricultură, garantat InvestEU', recTotal, 'EUR', { dependsOn: [rCost] });
  const fsGuar = R.calc('build_funding_stack', 'option_b.guarantee.amount', 'Valoare garantată', (recTotal * P.feiCoverage) / 100, 'EUR', { formula: 'credit × acoperire garanție', dependsOn: [fsGreen, feiCov] });
  R.tool(A2, 'build_funding_stack', 4, { options: [{ optionId: 'A', configId: 'cfg_initial', products: ['rbro.invest.standard'] }, { optionId: 'B', configId: 'cfg_recommended', products: ['rbro.agri.green_investeu'] }] }, '🔧 Construiesc structura de finanțare A și B', `🔧 A: credit standard ${fsStd.display} cu ipotecă. B: credit verde ${fsGreen.display} cu garanție FEI 70%`, () => [fsStd, fsGreen, fsGuar], { options: [{ optionId: 'A', configId: 'cfg_initial', components: ['STANDARD_LOAN'] }, { optionId: 'B', configId: 'cfg_recommended', components: ['GREEN_LOAN', 'GUARANTEE'] }] });

  const pA = priceClassic();
  const pB = priceGreen(P.feiCoverage, tierName);
  const rA = rateCalcs(R, 'option_a.rate', pA);
  const rB = rateCalcs(R, 'option_b.rate', pB);
  const diff = rateDiffCalcs(R, pA, pB);
  R.tool(A2, 'price_loan', 4, { optionIds: ['A', 'B'] }, '🔧 Calculez dobânda pe componente', `🔧 Clasic ${rA.rate.display}; verde ${rB.rate.display} (${diff.total.display}), cu ${rB.tier.display} pentru nivelul Verde cu upgrade`, () => [...Object.values(rA).filter((c) => c.calcId), ...Object.values(rB).filter((c) => c.calcId), ...diff.calcs, diff.total], { options: [{ optionId: 'A', pricing: 'CLASSIC' }, { optionId: 'B', pricing: 'GREEN' }] });

  const schA = schedule(offer, pA.rate, P.term, 2027, 1);
  const schB = schedule(recTotal, pB.rate, P.term, 2027, 1, P.cashinMonths);
  const grace = schB.series.findIndex((p) => p.values.payment > 0);
  const aFuelEur = aL * fuelEur;
  const bFuelEur = bL * fuelEur;
  const bNEur = bNSaved * P.nPrice;
  const aCollateral = P.mortgageInitial + P.mortgageAnnual * P.horizonYears;

  const aInst = R.calc('build_scenario', 'option_a.installment', 'Rata lunară', schA.installment, 'EUR_PER_MONTH', { formula: 'PMT = P · r / (1 − (1 + r)^−n)', dependsOn: [fsStd, rA.rate, term] });
  const aSched = R.calc('build_scenario', 'option_a.schedule', 'Total plătit pe credit', schA.totalPayments, 'EUR', { series: schA.series, dependsOn: [aInst] });
  const aTotal = R.calc('build_scenario', 'option_a.total_payments', 'Total plăți (credit + punte)', schA.totalPayments, 'EUR');
  const aInt = R.calc('build_scenario', 'option_a.total_interest', 'Total dobânzi', schA.totalInterest, 'EUR');
  const aColl = R.calc('build_scenario', 'option_a.collateral_costs', 'Costuri cu ipoteca', aCollateral, 'EUR', { formula: 'cost inițial + cost anual × ani', dependsOn: [mortInit, mortAnnual, horizon] });
  const aFuel = R.calc('build_scenario', 'option_a.savings.fuel_eur', 'Economie anuală (fuel_eur)', aFuelEur, 'EUR_PER_YEAR', { dependsOn: [iSaved, fuelPrice] });
  const aNitrogen = R.calc('build_scenario', 'option_a.savings.nitrogen_eur', 'Economie anuală (nitrogen_eur)', 0, 'EUR_PER_YEAR');
  const aSavH = R.calc('build_scenario', 'option_a.savings_horizon', 'Economii pe 7 ani', aFuelEur * P.horizonYears, 'EUR', { dependsOn: [aFuel, horizon] });
  const aNetCost = offer + schA.totalInterest + aCollateral - aFuelEur * P.horizonYears;
  const aNet = R.calc('build_scenario', 'option_a.net_cost', 'Cost net pe 7 ani', aNetCost, 'EUR', { formula: 'investiție − grant + dobânzi + costuri garanții − economii', dependsOn: [aTotal, aColl, aSavH] });
  R.tool(A2, 'build_scenario', 5, { optionId: 'A', scheduleType: 'EQUAL_MONTHLY' }, '🔧 Calculez creditul A (standard, rate lunare egale, 84 de luni)', `🔧 A: ${aInst.display}, plus ${aColl.display} costuri de ipotecă`, () => [aInst, aSched, aTotal, aInt, aColl, aFuel, aNitrogen, aSavH, aNet], { optionId: 'A', scheduleType: 'EQUAL_MONTHLY', firstInstallmentMonth: '2027-02' });

  const bInst = R.calc('build_scenario', 'option_b.installment', 'Rata sezonieră', schB.installment, 'EUR', { formula: 'rate egale doar în lunile cu încasări; VA la dobânda creditului = principalul', dependsOn: [fsGreen, rB.rate, term] });
  const bGrace = R.calc('build_scenario', 'option_b.grace', 'Luni fără rată până la prima încasare', grace, 'MONTHS', { sourceRo: 'grația până la prima recoltă, cel mult 12 luni (config/modules)' });
  const bSched = R.calc('build_scenario', 'option_b.schedule', 'Total plătit pe credit', schB.totalPayments, 'EUR', { series: schB.series, dependsOn: [bInst] });
  const bTotal = R.calc('build_scenario', 'option_b.total_payments', 'Total plăți (credit + punte)', schB.totalPayments, 'EUR');
  const bInt = R.calc('build_scenario', 'option_b.total_interest', 'Total dobânzi', schB.totalInterest, 'EUR');
  const bFuel = R.calc('build_scenario', 'option_b.savings.fuel_eur', 'Economie anuală (fuel_eur)', bFuelEur, 'EUR_PER_YEAR', { dependsOn: [rSaved, fuelPrice] });
  const bNitrogen = R.calc('build_scenario', 'option_b.savings.nitrogen_eur', 'Economie anuală (nitrogen_eur)', bNEur, 'EUR_PER_YEAR', { dependsOn: [rNCost] });
  const bSavH = R.calc('build_scenario', 'option_b.savings_horizon', 'Economii pe 7 ani', (bFuelEur + bNEur) * P.horizonYears, 'EUR', { dependsOn: [bFuel, bNitrogen, horizon] });
  const bNetCost = recTotal + schB.totalInterest - (bFuelEur + bNEur) * P.horizonYears;
  const bNet = R.calc('build_scenario', 'option_b.net_cost', 'Cost net pe 7 ani', bNetCost, 'EUR', { formula: 'investiție − grant + dobânzi + costuri garanții − economii', dependsOn: [bTotal, bSavH] });
  R.tool(A2, 'build_scenario', 5, { optionId: 'B', scheduleType: 'SEASONAL', paymentMonths: P.cashinMonths }, '🔧 Calculez creditul B (verde, rate după recoltă)', `🔧 B: ${bInst.display} în iulie–octombrie, după ${bGrace.display} de grație; fără ipotecă`, () => [bInst, bGrace, bSched, bTotal, bInt, bFuel, bNitrogen, bSavH, bNet], { optionId: 'B', scheduleType: 'SEASONAL', firstInstallmentMonth: schB.series[grace].period });

  const cmpAdv = R.calc('compare_scenarios', 'compare.net_advantage', 'Avantaj net B față de A', aNetCost - bNetCost, 'EUR', { formula: 'cost net A − cost net B', dependsOn: [aNet, bNet] });
  const dInv = R.calc('compare_scenarios', 'compare.driver.investment', 'Contribuția la avantaj: investment', -precision, 'EUR', { dependsOn: [rUp] });
  const dInt = R.calc('compare_scenarios', 'compare.driver.interest', 'Contribuția la avantaj: interest', schA.totalInterest - schB.totalInterest, 'EUR', { dependsOn: [aInt, bInt] });
  const dColl = R.calc('compare_scenarios', 'compare.driver.collateral', 'Contribuția la avantaj: collateral', aCollateral, 'EUR', { dependsOn: [aColl] });
  const dSav = R.calc('compare_scenarios', 'compare.driver.savings', 'Contribuția la avantaj: savings', (bFuelEur + bNEur - aFuelEur) * P.horizonYears, 'EUR', { dependsOn: [aSavH, bSavH] });
  const payback = R.calc('compare_scenarios', 'compare.upgrade_payback', 'Recuperarea investiției suplimentare din economii', precision / ((bFuelEur + bNEur - aFuelEur) / 12), 'MONTHS', { decimals: 1, formula: 'cost suplimentar / economie lunară suplimentară (fără grant)', dependsOn: [rUp, dSav] });
  R.tool(A2, 'compare_scenarios', 6, { optionIds: ['A', 'B'] }, '🔧 Compar A și B pe 7 ani', `🔧 B costă mai puțin cu ${cmpAdv.display} pe 7 ani; precizia se recuperează din economii în ${payback.display}`, () => [cmpAdv, dInv, dInt, dColl, dSav, payback], { better: 'B' });

  const aRatio = R.calc('check_affordability', 'option_a.affordability_ratio', 'Ratele din primul an față de cashflow-ul net', (firstYearPayments(schA.series) / P.annualNetCf) * 100, 'PCT', { formula: 'rate pe 12 luni / cashflow net anual (Open Banking)', dependsOn: [aInst] });
  const bRatio = R.calc('check_affordability', 'option_b.affordability_ratio', 'Ratele din primul an față de cashflow-ul net', (firstYearPayments(schB.series) / P.annualNetCf) * 100, 'PCT', { formula: 'rate pe 12 luni / cashflow net anual (Open Banking)', dependsOn: [bInst] });
  R.tool(A2, 'check_affordability', 7, { optionIds: ['A', 'B'] }, '🔧 Verific dacă ratele încap în cashflow', `🔧 A: ${aRatio.display} din cashflow, cu rate și în lunile de iarnă. B: ${bRatio.display}, doar după recoltă`, () => [aRatio, bRatio], { A: { result: 'PASS_WITH_WARNING', deficitMonths: ['2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2028-01'] }, B: { result: 'PASS', deficitMonths: [] } });

  const dsA = dscrOf(schA.series, P.annualNetCf, aFuelEur);
  const dsB = dscrOf(schB.series, P.annualNetCf, bFuelEur + bNEur);
  const aDs = R.calc('compute_dscr', 'option_a.debt_service_year', 'Rate și dobânzi în cel mai greu an de credit', dsA.heaviest, 'EUR_PER_YEAR', { dependsOn: [aInst] });
  const aDscr = R.calc('compute_dscr', 'option_a.dscr', 'DSCR: acoperirea ratelor din cashflow și economii', dsA.dscr, 'RATIO', { formula: '(cashflow net anual + economii anuale) / rate și dobânzi pe an, minimul pe anii creditului', sourceRo: 'Open Banking (cashflow pe 12 luni)', dependsOn: [aDs] });
  const bDs = R.calc('compute_dscr', 'option_b.debt_service_year', 'Rate și dobânzi în cel mai greu an de credit', dsB.heaviest, 'EUR_PER_YEAR', { dependsOn: [bInst] });
  const bDscr = R.calc('compute_dscr', 'option_b.dscr', 'DSCR: acoperirea ratelor din cashflow și economii', dsB.dscr, 'RATIO', { formula: '(cashflow net anual + economii anuale) / rate și dobânzi pe an, minimul pe anii creditului', sourceRo: 'Open Banking (cashflow pe 12 luni)', dependsOn: [bDs] });
  R.tool(A2, 'compute_dscr', 7, { optionIds: ['A', 'B'] }, '🔧 Calculez DSCR-ul fiecărei variante', `🔧 DSCR: A ${aDscr.display}, B ${bDscr.display}`, () => [aDs, aDscr, bDs, bDscr], { optionIds: ['A', 'B'] });

  // first submit rejected by schema validation, then corrected
  const badToolUseId = `tooluse_${hash12(`${R.runId}|submit_funding_recommendation|bad`)}`;
  R.emit('agent.tool_result', A2, '⚠️ Output respins de validare: lipsește grantOutlook. Agentul se corectează', {
    toolUseId: badToolUseId, tool: 'submit_funding_recommendation', status: 'ERROR', durationMs: 12, calcs: [], result: {},
    errors: [{ path: '/grantOutlook', messageRo: 'Câmp obligatoriu lipsă.' }],
  }, 2600);

  const funding = {
    options: [
      {
        optionId: 'A', kind: 'STANDARD', configId: 'cfg_initial', titleRo: 'Credit clasic pentru 4 tractoare',
        investmentCalcId: iCost.calcId,
        fundingStack: [
          { itemId: 'fs_a_loan', type: 'STANDARD_LOAN', productId: 'rbro.invest.standard', amountCalcId: fsStd.calcId, rateCalcId: rA.rate.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'EQUAL_MONTHLY', installmentCalcId: aInst.calcId, scheduleCalcId: aSched.calcId }, status: 'AVAILABLE', noteRo: 'Garantat cu ipotecă.' },
        ],
        headlineInstallmentCalcId: aInst.calcId,
        collateral: ['MORTGAGE'],
        totals: { totalPaymentsCalcId: aTotal.calcId, totalInterestCalcId: aInt.calcId, collateralCostsCalcId: aColl.calcId, savingsOverHorizonCalcId: aSavH.calcId, netCostCalcId: aNet.calcId },
        annualSavings: [{ metric: 'FUEL_COST_SAVED_EUR', calcId: aFuel.calcId }],
        rate: rA.block,
        affordability: { status: 'PASS_WITH_WARNING', ratioCalcId: aRatio.calcId, limitCalcId: affLimit.calcId, dscrCalcId: aDscr.calcId, debtServiceCalcId: aDs.calcId, noteRo: 'Încape pe an, dar ratele cad și în lunile de iarnă, când cashflow-ul e negativ.' },
        greenEligible: false,
      },
      {
        optionId: 'B', kind: 'GREEN_PACKAGE', configId: 'cfg_recommended', titleRo: 'Credit verde Raiffeisen cu rate după recoltă',
        investmentCalcId: rCost.calcId,
        fundingStack: [
          { itemId: 'fs_b_green_loan', type: 'GREEN_LOAN', productId: 'rbro.agri.green_investeu', amountCalcId: fsGreen.calcId, rateCalcId: rB.rate.calcId, termCalcId: term.calcId, repayment: { scheduleType: 'SEASONAL', installmentCalcId: bInst.calcId, scheduleCalcId: bSched.calcId, graceCalcId: bGrace.calcId, paymentMonths: P.cashinMonths }, status: 'TO_CONFIRM', noteRo: 'Rate doar după recoltă; condițiile se confirmă cu banca.' },
          { itemId: 'fs_b_guarantee', type: 'GUARANTEE', productId: 'eif.investeu.sustainability', programCode: 'INVESTEU_FEI', amountCalcId: fsGuar.calcId, coverageCalcId: feiCov.calcId, guaranteesItemId: 'fs_b_green_loan', status: 'TO_CONFIRM', noteRo: 'Fără ipotecă, datorită unei garanții europene.' },
        ],
        headlineInstallmentCalcId: bInst.calcId,
        collateral: ['GUARANTEE_INVESTEU_FEI', 'PLEDGE_EQUIPMENT'],
        totals: { totalPaymentsCalcId: bTotal.calcId, totalInterestCalcId: bInt.calcId, savingsOverHorizonCalcId: bSavH.calcId, netCostCalcId: bNet.calcId },
        annualSavings: [{ metric: 'FUEL_COST_SAVED_EUR', calcId: bFuel.calcId }, { metric: 'INPUTS_COST_SAVED_EUR', calcId: bNitrogen.calcId }],
        rate: rB.block,
        affordability: { status: 'PASS', ratioCalcId: bRatio.calcId, limitCalcId: affLimit.calcId, dscrCalcId: bDscr.calcId, debtServiceCalcId: bDs.calcId, noteRo: 'Ratele cad doar în lunile cu încasări mari (iulie–octombrie).' },
        greenEligible: true,
      },
    ],
    recommendedOptionId: 'B',
    recommendationBasis: { greenEligible: true, netAdvantagePositive: aNetCost - bNetCost > 0, affordabilityPassed: true },
    greenTier: tier,
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
        noteRo: 'Sesiune deschisă 06.10–02.12.2026. Alternativă la creditul verde, nu parte din oferta propusă.',
      },
      { programCode: 'FGCR', result: 'ELIGIBLE', session: 'PERMANENT', checkedAt: '2026-10-28', sourceUrl: 'https://www.fgcr.ro/', criteria: [{ criterion: 'SECTOR_ELIGIBLE', result: 'PASS' }], noteRo: 'Ar garanta creditul de cofinanțare dacă fermierul alege grantul.' },
      { programCode: 'INVESTEU_FEI', result: 'ELIGIBLE', session: 'PERMANENT', checkedAt: '2026-10-28', sourceUrl: 'https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth', criteria: [{ criterion: 'SME_STATUS', result: 'PASS' }, { criterion: 'NO_DOUBLE_FUNDING', result: 'PASS' }], noteRo: 'Garanția creditului verde propus.' },
      { programCode: 'RABLA_AGRI', result: 'ELIGIBLE', session: 'NO_BUDGET', checkedAt: '2026-10-28', sourceUrl: 'https://www.afm.ro/', criteria: [{ criterion: 'SESSION_OPEN', result: 'FAIL' }], noteRo: 'Fără buget în 2026.' },
    ],
    grantOutlook: {
      status: 'ALTERNATIVE_AVAILABLE', programCode: 'DR_12',
      messageRo: 'Poți cere și grantul DR-12, deschis până la 02.12.2026, ora 16:00: până la 65% din valoare, cel mult 200.000 EUR. Dacă îl primești, creditul scade. Grantul nu e inclus în oferta de mai sus. Dacă vrei să aplici, nu semna contracte și nu plăti avansuri înainte de depunerea cererii.',
      checkedAt: '2026-10-28', sourceUrl: 'https://www.afir.ro/domenii-de-interventie/detalii-si-anexe-dr-12/',
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
      rateDifferenceCalcId: diff.total.calcId,
      rateDrivers: diff.rateDrivers,
    },
    farmerExplanationRo: `Investiția crește cu 52.000 EUR pentru pachetul de precizie, dar dobânda e ${rB.rate.display} în loc de ${rA.rate.display}, nu ai nevoie de ipotecă și plătești doar după recoltă. Câștigi ${cmpAdv.display} în 7 ani alegând creditul verde. Poți cere și grantul DR-12, care ar micșora creditul.`,
    officerNotesRo: `Opțiunea B: credit verde ${fsGreen.display} pe 84 de luni, garanție InvestEU 70% (fără ipotecă), rate sezoniere iul–oct, nivel Verde cu upgrade (+0,20 pp). Dobânda: ${rB.rate.display} față de ${rA.rate.display} la creditul clasic. DR-12 e deschis și ferma e eligibilă (65%, plafon 200.000 EUR): rămâne alternativa cu cofinanțare FGCR. Parametrii dobânzii sunt valori demo.`,
  };
  R.completed(A2, 'submit_funding_recommendation', `✅ Agentul 2 a terminat: recomand B, avantaj net ${cmpAdv.display} pe 7 ani`, funding, 8, 34100);

  // =================== AGENT 3 ===================
  R.state('AGENT_2', 'AGENT_3', 'Pornește underwriter-ul verde', {}, 300);
  R.started(A3, 'AGENT_3', 'Agentul 3 (underwriter verde) a pornit');
  R.emit('agent.degraded', A3, '⚠️ Bedrock a răspuns lent; reîncerc (badge: retry)', { level: 'RETRY', reason: 'THROTTLED', attempt: 2, modelId: MODEL_AGENT, detailRo: 'ThrottlingException la primul apel; reîncercare după 1,5 s.' }, 4200);
  R.tool(A3, 'get_labeling_rules', 1, { configId: 'cfg_recommended' }, '🔧 Citesc regulile de etichetare', '🔧 Tractoare diesel: tranziție. Pachet de precizie: verde de piață', null, {
    rules: [{ componentId: 'cmp_offer_ln_1', category: 'TRACTOR', label: 'TRANSITION' }, { componentId: 'cmp_offer_ln_2', category: 'TRACTOR', label: 'TRANSITION' }, { componentId: 'cmp_precision', category: 'PRECISION_PACKAGE', label: 'MARKET_GREEN' }],
  }, { callDt: 1600 });
  R.tool(A3, 'get_dnsh_criteria', 1, {}, '🔧 Citesc criteriile DNSH', '🔧 5 obiective de verificat: adaptare, apă, circularitate, poluare, biodiversitate', null, {
    objectives: ['CLIMATE_ADAPTATION', 'WATER_MARINE_RESOURCES', 'CIRCULAR_ECONOMY', 'POLLUTION_PREVENTION', 'BIODIVERSITY'],
  });
  const greenAmt = R.calc('calculate_impact', 'label.green_amount', 'Sumă etichetată verde', precision, 'EUR', { dependsOn: [rUp] });
  const taxAmt = R.calc('calculate_impact', 'label.taxonomy_amount', 'Din care aliniată la Taxonomia UE', 0, 'EUR');
  const transAmt = R.calc('calculate_impact', 'label.transition_amount', 'Sumă etichetată tranziție', offer, 'EUR', { dependsOn: [o240, o180] });
  const greenPct = R.calc('calculate_impact', 'label.green_share', 'Ponderea verde a investiției', (precision / recTotal) * 100, 'PCT', { formula: 'sumă verde / investiție totală', dependsOn: [greenAmt, rCost] });
  const fuelH = R.calc('calculate_impact', 'impact.fuel_horizon', 'Motorină economisită pe orizont', bL * P.horizonYears, 'L', { dependsOn: [rSaved, horizon] });
  const co2H = R.calc('calculate_impact', 'impact.co2_horizon', 'CO₂ evitat pe orizont', rCo2Value * P.horizonYears, 'T_CO2', { dependsOn: [rCo2, horizon] });
  R.tool(A3, 'calculate_impact', 2, { configId: 'cfg_recommended' }, '🔧 Calculez impactul de mediu', `🔧 ${rSaved.display} motorină, ${rN.display}, ${rCo2.display} evitate`, () => [greenAmt, taxAmt, transAmt, greenPct, fuelH, co2H], { configId: 'cfg_recommended' });

  const fundCov = R.calc('select_fund', 'fund.coverage', 'Acoperirea garanției F1', P.feiCoverage, 'PCT', { sourceRo: 'config/funds.json: F1, acordul FEI cu Raiffeisen din 2023 (procentul pentru 2026, de confirmat)' });
  R.tool(A3, 'select_fund', 3, { optionId: 'B' }, '🔧 Aleg fondul care susține creditul verde', '🔧 F1, garanția FEI InvestEU de sustenabilitate; grantul DR-12 (F6) e disponibil ca alternativă', () => [fundCov], {
    fundId: 'F1', nameRo: 'Garanția FEI InvestEU de sustenabilitate', kind: 'GUARANTEE', role: 'PRIMARY',
    alternatives: [{ fundId: 'F6', nameRo: 'Granturi AFIR / PNS', status: 'AVAILABLE' }],
  });
  R.tool(A3, 'check_fund_requirements', 3, { fundId: 'F1', optionId: 'B' }, '🔧 Bifez cerințele fondului F1', '🔧 F1: 6 din 7 cerințe îndeplinite; DNSH are condiții înainte de tragere', null, {
    fundId: 'F1',
    requirements: [
      { requirementId: 'SME_STATUS', level: 'REQUIRED', status: 'MET', reasonRo: 'Firma e IMM după bilanțul de la ANAF (angajați, cifră de afaceri, active).' },
      { requirementId: 'ELIGIBLE_CATEGORY', level: 'REQUIRED', status: 'MET', reasonRo: 'Categoria Utilaje & precizie e legată de fond (README §3.3).' },
      { requirementId: 'TECHNICAL_THRESHOLD', level: 'REQUIRED', status: 'MET', reasonRo: 'Configurația finanțată trece pragul verde, calculat de motor din documente.' },
      { requirementId: 'DNSH', level: 'PROBABLE', status: 'TO_CONFIRM', reasonRo: 'DNSH trecut cu condiții înainte de tragere.' },
      { requirementId: 'IMPACT_QUANTIFIED', level: 'REQUIRED', status: 'MET', reasonRo: 'Impactul e calculat de motor pe acest credit.' },
      { requirementId: 'CLIENT_BENEFIT', level: 'REQUIRED', status: 'MET', reasonRo: 'Dobândă mai mică decât la creditul clasic și fără ipotecă.' },
      { requirementId: 'PERIODIC_REPORTING', level: 'REQUIRED', status: 'MET', reasonRo: 'Dosarul are indicatori de monitorizare la 12 luni, din contoare și facturi.' },
    ],
    allMet: false,
  });
  R.tool(A3, 'get_bond_category', 3, {}, '🔧 Caut categoria din cadrul obligațiunilor verzi', '🔧 Categoria propusă: Agriculture and forestry; alternativ Energy efficiency', null, {
    categories: [
      { categoryId: 'AGRICULTURE_FORESTRY', nameEn: 'Agriculture and forestry', nameRo: 'Agricultură și silvicultură' },
      { categoryId: 'ENERGY_EFFICIENCY', nameEn: 'Energy efficiency', nameRo: 'Eficiență energetică' },
    ],
    proposed: 'AGRICULTURE_FORESTRY', sourceRo: 'README §3.1: categoriile cadrului de obligațiuni verzi și sustenabile Raiffeisen (Sustainalytics, Second Party Opinion 2024)',
  });

  const report = {
    decision: 'ELIGIBLE_WITH_CONDITIONS',
    moduleId: 'utilaje',
    recommendedOptionId: 'B',
    criterion: { indicator: 'FUEL_SAVING_PCT', valueCalcId: rPct.calcId, thresholdCalcId: thr.calcId, result: 'PASS', sourceRo: 'README §6.3: reducere ≥ 20% de motorină pe hectar sau de azot pe hectar, cu motor Stage V (propunere, de confirmat cu Raiffeisen).' },
    componentLabels: [
      { componentId: 'cmp_offer_ln_1', label: 'TRANSITION', basis: 'MEASURABLE_SAVING_NO_LABEL', amountCalcId: o240.calcId, rationaleRo: 'Tractor diesel Stage V: economie măsurabilă, dar nu e activitate verde în sine.' },
      { componentId: 'cmp_offer_ln_2', label: 'TRANSITION', basis: 'MEASURABLE_SAVING_NO_LABEL', amountCalcId: o180.calcId, rationaleRo: 'Tractor diesel Stage V: economie măsurabilă, dar nu e activitate verde în sine.' },
      { componentId: 'cmp_precision', label: 'MARKET_GREEN', basis: 'LMA_GREEN_LOAN_PRINCIPLES', amountCalcId: rUp.calcId, rationaleRo: 'Ghidaj RTK, section control și doză variabilă: mai puțină motorină și mai puțin azot.' },
    ],
    greenShare: { greenAmountCalcId: greenAmt.calcId, transitionAmountCalcId: transAmt.calcId, greenSharePctCalcId: greenPct.calcId },
    greenBond: { category: 'AGRICULTURE_FORESTRY', status: 'TO_CONFIRM', eligibleAmountCalcId: greenAmt.calcId, noteRo: 'Doar pachetul de precizie poate intra în portofoliul verde; tractoarele diesel sunt excluse. Categoria agricultură trebuie confirmată cu echipa Green Bonds (cadrul RBI 2025).' },
    fund: {
      fundId: 'F1', role: 'PRIMARY',
      requirements: [
        { requirementId: 'SME_STATUS', level: 'REQUIRED', status: 'MET', noteRo: 'IMM după bilanțul ANAF pe 2025.' },
        { requirementId: 'ELIGIBLE_CATEGORY', level: 'REQUIRED', status: 'MET', noteRo: 'Utilajele cu precizie intră în investițiile acoperite de garanție.' },
        { requirementId: 'TECHNICAL_THRESHOLD', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [rPct.calcId, thr.calcId], noteRo: 'Reducerea de motorină trece pragul de 20%; motoare Stage V.' },
        { requirementId: 'DNSH', level: 'PROBABLE', status: 'TO_CONFIRM', conditionId: 'cp_scrapping', noteRo: 'Trecut cu condiții: certificatele de dezmembrare pentru tractoarele vechi.' },
        { requirementId: 'IMPACT_QUANTIFIED', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [rSaved.calcId, rN.calcId, rCo2.calcId], noteRo: 'Motorină, azot și CO₂e, calculate pe acest credit.' },
        { requirementId: 'CLIENT_BENEFIT', level: 'REQUIRED', status: 'MET', evidenceCalcIds: [diff.total.calcId], noteRo: 'Dobândă mai mică și fără ipotecă față de creditul clasic.' },
        { requirementId: 'PERIODIC_REPORTING', level: 'REQUIRED', status: 'MET', noteRo: 'Motorina și azotul cumpărate, la 12 luni.' },
      ],
      alternatives: [{ fundId: 'F6', status: 'AVAILABLE', noteRo: 'Grantul DR-12 e deschis și ferma e eligibilă (65%, plafon 200.000 EUR); varianta cu cofinanțare FGCR, dacă fermierul îl cere.' }],
    },
    substantialContribution: 'CLIMATE_MITIGATION',
    dnsh: [
      { objective: 'CLIMATE_ADAPTATION', status: 'PASS', justificationRo: 'Lucrări mai precise și la timp; riscul de secetă e mediu.', evidence: [] },
      { objective: 'WATER_MARINE_RESOURCES', status: 'PASS', justificationRo: 'Doza variabilă reduce scurgerile de azot în apă.', evidence: [] },
      { objective: 'CIRCULAR_ECONOMY', status: 'PASS_WITH_CONDITIONS', justificationRo: 'Tractoarele vechi se casează: e nevoie de certificatele de dezmembrare.', evidence: [], conditionId: 'cp_scrapping' },
      { objective: 'POLLUTION_PREVENTION', status: 'PASS', justificationRo: 'Motoare Stage V; mai puțin azot aplicat.', evidence: ['TECHNICAL_SHEET'] },
      { objective: 'BIODIVERSITY', status: 'PASS', justificationRo: 'Nicio parcelă în Natura 2000.', evidence: [] },
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
      { conditionId: 'cp_investeu_guarantee', type: 'GUARANTEE_APPROVAL', documentType: 'GUARANTEE_APPROVAL', descriptionRo: 'Includerea creditului în portofoliul garantat InvestEU (FEI).', timing: 'BEFORE_SIGNING', blocking: true },
      { conditionId: 'cp_final_offer', type: 'DOCUMENT', documentType: 'OFFER', descriptionRo: 'Oferta dealerului care include pachetul de precizie (ghidaj RTK, section control, doză variabilă).', timing: 'BEFORE_FIRST_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_fertilizer_invoices', type: 'DOCUMENT', documentType: 'FERTILIZER_INVOICES', descriptionRo: 'Facturile de îngrășăminte pe 12 luni, pentru doza de azot de azi.', timing: 'BEFORE_FIRST_DISBURSEMENT', blocking: false, missingFieldKey: 'fertilizer_invoices' },
      { conditionId: 'cp_final_invoice', type: 'INVOICE_MATCH', documentType: 'FINAL_INVOICE', descriptionRo: 'Factura finală include tractoarele și pachetul de precizie aprobat.', timing: 'BEFORE_FINAL_DISBURSEMENT', blocking: true },
      { conditionId: 'cp_scrapping', type: 'DOCUMENT', documentType: 'SCRAPPING_CERTIFICATE', descriptionRo: 'Certificatele de dezmembrare pentru cele 4 tractoare vechi.', timing: 'AFTER_INSTALLATION', blocking: false, missingFieldKey: 'scrapping_certificate' },
    ],
    monitoringKpis: [
      { kpiId: 'kpi_fuel_use', metric: 'FUEL_USE_L', targetCalcId: rFuelUse.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'OPEN_BANKING', descriptionRo: 'Motorina cumpărată, din tranzacții și facturi, comparată cu estimarea.' },
      { kpiId: 'kpi_nitrogen_saved', metric: 'NITROGEN_SAVED_KG', targetCalcId: rN.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'INVOICES', descriptionRo: 'Azotul cumpărat, din facturile de îngrășăminte.' },
      { kpiId: 'kpi_precision_use', metric: 'AREA_HA', targetCalcId: area.calcId, frequency: 'ANNUAL', firstDue: 'MONTH_12', dataSource: 'TELEMATICS', descriptionRo: 'Hectarele lucrate cu ghidaj RTK, din jurnalul terminalului.' },
    ],
    risks: [
      { category: 'GREENWASHING', severity: 'LOW', descriptionRo: 'Tractoarele diesel ar putea fi raportate greșit ca verzi.', mitigationRo: 'Etichetare pe componente: tractoarele sunt tranziție, doar precizia e verde.' },
      { category: 'AFFORDABILITY', severity: 'LOW', descriptionRo: `Opțiunea B folosește ${bRatio.display} din cashflow-ul net în primul an.`, mitigationRo: 'Rate doar după recoltă; DSCR confortabil.' },
      { category: 'DATA_QUALITY', severity: 'LOW', descriptionRo: 'Doza de azot vine din chestionar, nu din facturi.', mitigationRo: 'Facturile de îngrășăminte devin condiție înainte de tragere.' },
    ],
    committeeSummaryRo: `Fermă de cereale, 400 ha, administrator de 38 de ani. Cererea inițială (4 tractoare Stage V, 440.000 EUR) economisea ${iPct.display} motorină, sub pragul de 20%. Cu pachetul de precizie (52.000 EUR) economia ajunge la ${rPct.display}: ${rSaved.display}, ${rN.display}, ${rCo2.display} CO₂e. Etichete: tractoarele sunt tranziție, precizia e verde de piață. Credit verde ${fsGreen.display} cu garanție InvestEU 70%, rate după recoltă pe 7 ani, la ${rB.rate.display} față de ${rA.rate.display}; avantaj net ${cmpAdv.display}. DR-12 rămâne alternativă. Recomandare: eligibil cu condiții.`,
    farmerNextSteps: [
      { stepRo: 'Cere dealerului oferta care include pachetul de precizie.', conditionId: 'cp_final_offer' },
      { stepRo: 'Trimite facturile de îngrășăminte pe ultimele 12 luni.', conditionId: 'cp_fertilizer_invoices' },
      { stepRo: 'După livrare: certificatele de dezmembrare pentru tractoarele vechi.', conditionId: 'cp_scrapping' },
      { stepRo: 'Opțional: depune cererea DR-12 la AFIR până la 02.12.2026, fără să semnezi contracte înainte.', dueDate: '2026-12-02' },
    ],
  };
  R.completed(A3, 'submit_underwriting_report', '✅ Agentul 3 a terminat: eligibil cu condiții; tractoare = tranziție, precizie = verde de piață', report, 6, 24800, 'RETRY');

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
    ['ct_0415_01', 28.452, 44.1725, 'varză', false],
    ['ct_0415_02', 28.4555, 44.1725, 'ceapă', false],
  ];
  return {
    cui: '45871203',
    company: { cui: '45871203', name: 'Legume Dobrogea Verde SRL', legalForm: 'SRL', caen: '0113', caenLabelRo: 'Cultivarea legumelor, a pepenilor, a rădăcinoaselor și tuberculilor', county: 'Constanța', locality: 'Valu lui Traian', registeredAt: '2014-03-12', employees: 14, turnoverEur: 486000, netProfitEur: 61000, totalAssetsEur: 1320000, financialYear: 2025, vatPayer: true, smeStatus: 'SME', manager: { age: 52, installedAt: '2014-03-12' } },
    farm: { totalHa: 40, standardOutputEur: 412000, irrigatedNow: true, currentIrrigation: 'BRAZDE', crops: [{ year: 2026, crop: 'legume în câmp', ha: 40, yieldTPerHa: 38 }, { year: 2025, crop: 'legume în câmp', ha: 40, yieldTPerHa: 35 }, { year: 2024, crop: 'legume în câmp', ha: 38, yieldTPerHa: 31 }], livestock: [], apiaSubsidiesEur: 9800 },
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
    cashflow: cashflow([-5500, -6500, -11500, -9500, -3500, 6500, 80500, 54500, 40500, 48500, 24500, 21500], 15000),
    dataSources: [
      { source: 'ANAF', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:00Z' }, { source: 'APIA', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:00Z' },
      { source: 'OPEN_BANKING', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' }, { source: 'COPERNICUS', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' },
      { source: 'NATURA_2000', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' }, { source: 'NITRATES', mode: 'MOCK', fetchedAt: '2026-10-28T10:15:01Z' },
    ],
  };
}

// The 6 modules exactly as /api/modules returns them, read from config/modules/*.json.
const MODULE_ORDER = ['irigatii', 'energie', 'utilaje', 'zootehnie', 'post_recolta', 'ecologic'];
function modules() {
  return MODULE_ORDER.map((id) => {
    const m = JSON.parse(readFileSync(join(ROOT, '..', 'config', 'modules', `${id}.json`), 'utf8'));
    return {
      moduleId: m.moduleId, nameRo: m.nameRo, icon: m.icon, status: m.status, descriptionRo: m.descriptionRo, examplesRo: m.examplesRo,
      indicator: m.indicator, threshold: m.threshold, requiredDocs: m.requiredDocs, questionnaire: m.questionnaire,
    };
  });
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
  questionnaire: { crops_main: 'tomate, ardei, castraveți, varză, ceapă; 35-38 t/ha', nitrogen_kg_ha: 180, tillage: 'MINIMA', cover_crops: 'ROTATIE', irrigation_current: 'BRAZDE', crop_insurance: false, certifications: ['GLOBALGAP'], offtake_contracts: true, cashin_months: ['JUL', 'AUG', 'SEP', 'OCT'], old_equipment_fate: 'NU_E_CAZUL', water_source: 'PUT', pumping_head_m: 35 },
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
  questionnaire: { crops_main: 'grâu 6,1 t/ha; porumb 7,4 t/ha; floarea-soarelui 2,8 t/ha; rapiță 3,2 t/ha', nitrogen_kg_ha: 150, tillage: 'ARATURA', cover_crops: 'ROTATIE', irrigation_current: 'NU', crop_insurance: true, certifications: ['NICIUNA'], offtake_contracts: true, cashin_months: ['JUL', 'AUG', 'SEP', 'OCT'], old_equipment_fate: 'CASARE', hours_per_year: 650, manager_competences: false, loan_term: 'ANI_7' },
  submission: null,
  officerActions: [],
})));

const show = (b) => {
  const c = (k) => [...b.R.calcs.values()].find((x) => x.key === k)?.display;
  return `${b.R.runId}: ${b.R.events.length} events, ${b.R.calcs.size} calcs | A ${c('option_a.installment')} | B ${c('option_b.installment')} | net ${c('compare.net_advantage')} | payback ${c('compare.upgrade_payback')}`;
};
console.log(show(irg));
console.log(show(utl));
