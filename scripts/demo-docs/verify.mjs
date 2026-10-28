// Recomputes every "expected" value of the demo farms from their raw inputs,
// using the formulas in README §6 and the reference values in data/demo/test-documents/reference/.
// Fails loudly if a document, an input and an expected value disagree.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PKG = 'data/demo/test-documents';
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const C = readJson(`${PKG}/reference/constants.json`);
const catalog = readJson(`${PKG}/reference/upgrades.json`);
const farmsDir = join(root, PKG, 'farms');
const farms = readdirSync(farmsDir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => readJson(join(PKG, 'farms', f)));

let failures = 0;
const check = (farm, label, actual, expected, tol = 0.01) => {
  const ok = typeof expected === 'number'
    ? Math.abs(actual - expected) <= Math.max(tol, Math.abs(expected) * 1e-4)
    : actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${farm.id} ${label}: ${actual} (expected ${expected})`);
};
const sumQty = (farm, file, pred = () => true) =>
  farm.documents.find((d) => d.file === file).invoices.filter(pred).reduce((s, i) => s + i.qty, 0);
const upgrade = (cat, code) => catalog[cat].find((u) => u.code === code);
const r2 = (x) => Math.round(x * 100) / 100;

const EF = C.emissionFactors;
const P = C.prices;

for (const farm of farms) {
  const e = farm.expected;
  const a = farm.answers;
  if (farm.category === 'irrigation') {
    const I = C.irrigation;
    const nir = a.crops.reduce((s, c) =>
      s + Math.max(0, c.kc * farm.location.et0SeasonMm - farm.location.effectiveRainSeasonMm) * 10 * c.ha, 0);
    const withdrawal = (sys, sensors = 0) => (nir * (1 - sensors)) / I.applicationEfficiency[sys];
    const pumping = (v, sys) =>
      (v * (a.liftHeightM + I.pressureHeadM[sys]) * C.physics.pumpingKwhPerM3PerM.value) / a.pumpEfficiency;
    const vOld = withdrawal(a.currentSystem);
    const vReq = withdrawal(farm.request.system);
    const vGreen = withdrawal('picurare', I.soilMoistureSensorReduction.value);
    check(farm, 'net irrigation need m3', nir, e.netIrrigationNeedM3);
    check(farm, 'current withdrawal m3', Math.round(vOld), e.currentWithdrawalM3);
    check(farm, 'requested water saving', r2(1 - vReq / vOld), e.requested.waterSaving);
    check(farm, 'requested passes', 1 - vReq / vOld >= e.threshold, e.requested.passes);
    check(farm, 'green water saving', r2(1 - vGreen / vOld), e.green.waterSaving);
    check(farm, 'current pumping kWh', Math.round(pumping(vOld, a.currentSystem)), e.currentPumpingKwh);
    check(farm, 'requested pumping kWh', Math.round(pumping(vReq, farm.request.system)), e.requested.pumpingKwh);
    check(farm, 'green pumping kWh', Math.round(pumping(vGreen, 'picurare')), e.green.pumpingKwh);
    check(farm, 'invoices = current pumping kWh', sumQty(farm, '03_facturi_energie_pompare.pdf'), e.currentPumpingKwh);
    const ha = a.crops.reduce((s, c) => s + c.ha, 0);
    const greenPrice = upgrade('irrigation', 'IRR-DRIP').priceEurPerUnit * ha + upgrade('irrigation', 'IRR-SENS').priceEur;
    check(farm, 'green investment EUR', greenPrice, e.green.investmentEur);
  }

  if (farm.category === 'energy') {
    const S = C.solar;
    const months = farm.documents.find((d) => d.file === '02_facturi_energie_12_luni.pdf').invoices;
    // invoices run Oct..Sep; map to calendar months Jan..Dec
    const monthIndex = { ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5, iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11 };
    const cons = Array(12).fill(0);
    for (const inv of months) cons[monthIndex[inv.period.split(' ')[0]]] += inv.qty;
    const total = cons.reduce((x, y) => x + y, 0);
    check(farm, 'annual consumption kWh', total, e.annualConsumptionKwh);
    const pv = (kwp) => {
      const prod = kwp * S.specificYieldKwhPerKwpYear.value;
      const self = S.monthlyProductionShare.values.reduce((s, f, i) => s + Math.min(prod * f, cons[i] * a.daytimeConsumptionShare), 0);
      const saving = self * P.electricityEurPerKwh.value + (prod - self) * P.electricityExportEurPerKwh.value;
      return { prod, self: Math.round(self), exp: Math.round(prod - self), share: r2((prod - self) / prod), saving: Math.round(saving) };
    };
    const req = pv(farm.request.kwp);
    check(farm, 'requested export share', req.share, e.requested.exportShare);
    check(farm, 'requested saving EUR/yr', req.saving, e.requested.savingEurYear);
    check(farm, 'requested payback yrs', Math.round((farm.request.priceEur / req.saving) * 10) / 10, e.requested.paybackYears);
    // sizing rule: largest catalog size whose export share stays within the limit
    const limit = S.maxExportShareForSizing.value;
    const fitting = catalog.energy.filter((u) => pv(u.kwp).share <= limit).sort((x, y) => y.kwp - x.kwp);
    const best = fitting[0];
    const g = pv(best.kwp);
    check(farm, 'recommended kWp', best.kwp, e.green.kwp);
    check(farm, 'green export share', g.share, e.green.exportShare);
    check(farm, 'green saving EUR/yr', g.saving, e.green.savingEurYear);
    check(farm, 'green payback yrs', Math.round((best.priceEur / g.saving) * 10) / 10, e.green.paybackYears);
    check(farm, 'green CO2 t', r2((g.prod / 1000) * EF.gridElectricityTco2PerMwh.value), e.green.co2AvoidedT);
  }

  if (farm.category === 'machinery') {
    const litres = sumQty(farm, '02_facturi_motorina_12_luni.pdf');
    const nKg = farm.documents.find((d) => d.file === '03_facturi_ingrasaminte.pdf').invoices
      .reduce((s, i) => s + i.qty * (i.item.includes('46%') ? 0.46 : 0.34), 0);
    const ha = a.haWorkedPerYear;
    check(farm, 'diesel litres (invoices)', litres, e.currentDieselLitres);
    check(farm, 'diesel l/ha', litres / ha, e.currentDieselLitresPerHa);
    check(farm, 'nitrogen kg (invoices)', Math.round(nKg), e.currentNitrogenKg);
    const lOld = litres / ha;
    check(farm, 'requested diesel reduction', Math.round((1 - farm.request.dieselLitresPerHa / lOld) * 1000) / 1000, e.requested.dieselReduction);
    const gps = upgrade('machinery', 'MCH-GPS');
    const lNew = farm.request.dieselLitresPerHa * (1 - gps.effect.dieselReduction);
    check(farm, 'green diesel l/ha', r2(lNew), e.green.dieselLitresPerHa);
    check(farm, 'green diesel reduction', Math.round((1 - lNew / lOld) * 1000) / 1000, e.green.dieselReduction);
    const dl = (lOld - lNew) * ha;
    const dn = nKg * gps.effect.nitrogenReduction;
    check(farm, 'diesel saved l/yr', Math.round(dl), e.green.dieselSavedLitresYear);
    check(farm, 'nitrogen saved kg/yr', Math.round(dn), e.green.nitrogenSavedKgYear);
    check(farm, 'green CO2e t', r2((dl * EF.dieselKgCo2PerLitre.value + dn * EF.nitrogenKgCo2ePerKgN.value) / 1000), e.green.co2eAvoidedT);
    check(farm, 'green investment EUR', farm.request.priceEur + gps.priceEur, e.green.investmentEur);
  }

  if (farm.category === 'livestock') {
    const ch4 = farm.ansvsa.heads * a.methaneKgPerHeadYear;
    check(farm, 'current methane kg', ch4, e.currentMethaneKgYear);
    check(farm, 'farm consumption kWh (invoices)', sumQty(farm, '03_facturi_energie_12_luni.pdf'), e.farmConsumptionKwhYear);
    const gwp = EF.methaneGwp.value;
    check(farm, 'requested CO2e t', r2((ch4 * farm.request.methaneReduction * gwp) / 1000), e.requested.co2eAvoidedT);
    check(farm, 'requested passes', farm.request.methaneReduction >= e.threshold, e.requested.passes);
    const cover = upgrade('livestock', 'LIV-COVER');
    check(farm, 'green CO2e t', r2((ch4 * cover.effect.methaneReductionTotal * gwp) / 1000), e.green.co2eAvoidedT);
    check(farm, 'green investment EUR', farm.request.priceEur + cover.priceEur, e.green.investmentEur);
  }

  if (farm.category === 'post_harvest') {
    const kwh = sumQty(farm, '02_facturi_energie_12_luni.pdf');
    check(farm, 'storage consumption kWh (invoices)', kwh, e.currentConsumptionKwhYear);
    const iOld = kwh / a.tonnesPerYear;
    check(farm, 'current kWh/t', r2(iOld), e.currentSpecificKwhPerT);
    check(farm, 'requested saving', Math.round((1 - farm.request.specificConsumptionKwhPerT / iOld) * 1000) / 1000, e.requested.energySaving);
    check(farm, 'green saving', Math.round((1 - e.green.specificKwhPerT / iOld) * 1000) / 1000, e.green.energySaving);
    const saved = (iOld - e.green.specificKwhPerT) * a.tonnesPerYear;
    check(farm, 'kWh saved/yr', Math.round(saved), e.green.kwhSavedYear);
    check(farm, 'green CO2 t', r2((saved / 1000) * EF.gridElectricityTco2PerMwh.value), e.green.co2AvoidedT);
    const price = farm.request.priceEur + upgrade('post_harvest', 'PH-R290').priceEur + upgrade('post_harvest', 'PH-PANEL').priceEur;
    check(farm, 'green investment EUR', price, e.green.investmentEur);
  }

  if (farm.category === 'organic') {
    const O = C.organic;
    const factor = { 0: 1, 1: O.yieldFactorConversionYear1.value, 2: O.yieldFactorConversionYear2.value, 3: O.yieldFactorCertified.value };
    const margin = (stage, share) => a.crops.reduce((s, c) => {
      const y = c.yieldTPerHa * factor[stage];
      const p = c.priceEurPerT * (stage === 3 ? 1 + O.organicPricePremium.value : 1);
      const sub = stage === 1 || stage === 2 ? O.conversionPaymentEurPerHa.value : stage === 3 ? O.maintenancePaymentEurPerHa.value : 0;
      const cost = stage === 0 ? O.costPerHaConventionalEur.value : O.costPerHaOrganicEur.value;
      return s + (y * p + sub - cost) * c.ha * share;
    }, 0);
    const conv = margin(0, 1);
    check(farm, 'conventional margin EUR/yr', Math.round(conv), e.conventionalMarginEurYear);
    const years = ['2027', '2028', '2029', '2030'];
    const full = [margin(1, 1), margin(2, 1), margin(3, 1), margin(3, 1)];
    const phased = [margin(1, 0.5) + margin(0, 0.5), margin(2, 0.5) + margin(1, 0.5), margin(3, 0.5) + margin(2, 0.5), margin(3, 1)];
    years.forEach((y, i) => {
      check(farm, `full ${y} vs conventional`, Math.round(full[i] - conv), e.marginVsConventionalEur.fullConversion[y]);
      check(farm, `phased ${y} vs conventional`, Math.round(phased[i] - conv), e.marginVsConventionalEur.phasedConversion[y]);
    });
    check(farm, 'full 4-year total', Math.round(full.reduce((s, m) => s + m - conv, 0)), e.marginVsConventionalEur.fullConversion.total4Years);
    check(farm, 'phased 4-year total', Math.round(phased.reduce((s, m) => s + m - conv, 0)), e.marginVsConventionalEur.phasedConversion.total4Years);
    const nKg = farm.documents.find((d) => d.file === '04_facturi_ingrasaminte.pdf').invoices.reduce((s, i) => s + i.qty * 0.34, 0);
    check(farm, 'nitrogen avoided kg', Math.round(nKg), e.nitrogenAvoidedKgYear);
    check(farm, 'CO2e t', r2((nKg * EF.nitrogenKgCo2ePerKgN.value) / 1000), e.co2eAvoidedT);
  }

  // every offer total must equal the requested price
  const offer = farm.documents[0];
  const totalRow = offer.sections.find((s) => s.table)?.table.rows.find((row) => row[1] === 'TOTAL');
  check(farm, 'offer TOTAL = request price', Number(totalRow[3].replace(/\./g, '')), farm.request.priceEur);
  const lines = offer.sections.find((s) => s.table).table.rows.filter((row) => row[1] !== 'TOTAL');
  check(farm, 'offer lines sum = TOTAL', lines.reduce((s, row) => s + Number(row[3].replace(/\./g, '')), 0), farm.request.priceEur);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
