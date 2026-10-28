#!/usr/bin/env node
// Writes data/demo/extractions/<documentId>.json for the energy, livestock and post-harvest demo scenarios, from the
// Product team's documents (data/demo/test-documents/farms/DEMO-000X.json) so the numbers stay identical to the PDFs.
// The output has the shape of contracts/schemas/submit_offer_extraction.json (raw text values, parsed live by the
// backend). Irrigation and ecologic readings are written by hand next to these. Usage: node extractions.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const farm = (n) => JSON.parse(readFileSync(join(root, 'data/demo/test-documents/farms', `DEMO-000${n}.json`), 'utf8'));
const outDir = join(root, 'data/demo/extractions');

const ro = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const field = (key, rawValue, unit, page = 1) => ({ key, rawValue, unit, page, confidence: 'HIGH' });
const money = (s) => Number(s.replace(/\./g, '').replace(',', '.'));
const sectionRows = (doc, heading) => doc.sections.find((s) => s.heading === heading)?.rows ?? [];
const tableRows = (doc) => doc.sections.find((s) => s.table)?.table.rows.filter((r) => r[0] !== '') ?? [];
const total = (doc) => tableRows(doc).reduce((sum, r) => sum + money(r[3]), 0);
const cell = (doc, label) => sectionRows(doc, 'Parametri tehnici').find((r) => r[0].startsWith(label))?.[1];

function write(documentId, documentType, moduleId, doc, documentFields, lineItems) {
  const date = doc.date && doc.date.split('-').reverse().join('.');
  const extraction = {
    documentId, documentType, moduleId, currency: 'EUR', supplierName: doc.issuer.name,
    documentFields: [...(doc.number ? [field('DOCUMENT_NUMBER', doc.number, 'TEXT')] : []),
      ...(date ? [field('DOCUMENT_DATE', date, 'DATE')] : []), ...documentFields],
    lineItems, missingFields: [], warnings: [],
  };
  writeFileSync(join(outDir, `${documentId}.json`), JSON.stringify(extraction, null, 2) + '\n');
  console.log('wrote', documentId);
}

const line = (n, category, descriptionRo, quantity, price, ...extra) => ({
  lineId: `ln_${n}`, category, descriptionRo,
  fields: [...(quantity ? [field('QUANTITY', quantity, 'PCS')] : []), field('LINE_PRICE_NET', `${ro(money(price))} EUR`, 'EUR'), ...extra],
});

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const periodFrom = (period) => {
  const [m, y] = period.split(' ');
  return `01.${String(MONTHS.indexOf(m) + 1).padStart(2, '0')}.${y}`;
};
function energyInvoices(documentId, moduleId, doc, withLines) {
  const kwh = doc.invoices.reduce((s, i) => s + i.qty, 0);
  const lines = withLines ? doc.invoices.map((inv, i) => ({
    lineId: `ln_${i + 1}`, category: 'OTHER', descriptionRo: `Factură energie ${inv.number}`,
    fields: [field('PERIOD_FROM', periodFrom(inv.period), 'DATE'), field('ENERGY_KWH', `${ro(inv.qty)} kWh`, 'KWH'),
      field('ENERGY_COST', `${ro(Math.round(inv.qty * doc.unitPriceEur * 100) / 100)} EUR`, 'EUR')],
  })) : [];
  const fields = [field('ENERGY_KWH', `${ro(kwh)} kWh`, 'KWH')];
  if (withLines) fields.push(field('ENERGY_COST', `${ro(Math.round(kwh * doc.unitPriceEur * 100) / 100)} EUR`, 'EUR'));
  write(documentId, 'ENERGY_INVOICES', moduleId, { ...doc, number: undefined, date: undefined }, fields, lines);
  return kwh;
}

// Energy (DEMO-0002): 300 kWp offer, 12 monthly invoices.
{
  const d = farm(2);
  const offer = d.documents[0];
  const rows = tableRows(offer);
  write('doc_oferta_fotovoltaice', 'OFFER', 'energie', offer,
    [field('TOTAL_NET', `${ro(total(offer))} EUR`, 'EUR'), field('ENGINE_POWER_KW', cell(offer, 'Putere instalată'), 'KW')],
    [line(1, 'PV_SYSTEM', rows[0][1], rows[0][2], rows[0][3]), line(2, 'PV_SYSTEM', rows[1][1], rows[1][2], rows[1][3]),
      line(3, 'PV_SYSTEM', rows[2][1], null, rows[2][3]), line(4, 'INSTALLATION_WORKS', rows[3][1], null, rows[3][3])]);
  const kwh = energyInvoices('doc_facturi_energie_avicola', 'energie', d.documents[1], true);
  if (kwh !== 215000) throw new Error(`energy invoices add up to ${kwh}, expected 215000`);
}

// Livestock (DEMO-0004): digester offer, environmental permit, 12 invoices (total only).
{
  const d = farm(4);
  const offer = d.documents[0];
  const rows = tableRows(offer);
  write('doc_oferta_digestor', 'OFFER', 'zootehnie', offer,
    [field('TOTAL_NET', `${ro(total(offer))} EUR`, 'EUR'), field('METHANE_REDUCTION_PCT', cell(offer, 'Reducerea emisiilor de metan'), 'PCT'),
      field('ENERGY_KWH', cell(offer, 'Energie electrică produsă'), 'KWH')],
    [line(1, 'DIGESTER', rows[0][1], rows[0][2], rows[0][3]),
      line(2, 'COGENERATION', rows[1][1], rows[1][2], rows[1][3], field('ENGINE_POWER_KW', cell(offer, 'Putere electrică'), 'KW')),
      line(3, 'INSTALLATION_WORKS', rows[2][1], rows[2][2], rows[2][3])]);
  const permit = d.documents[1];
  write('doc_autorizatie_mediu', 'ENVIRONMENTAL_PERMIT', 'zootehnie', permit, [field('PERMIT_NUMBER', permit.number, 'TEXT')], []);
  const kwh = energyInvoices('doc_facturi_energie_ferma', 'zootehnie', d.documents[2], false);
  if (kwh !== 120000) throw new Error(`livestock invoices add up to ${kwh}, expected 120000`);
}

// Post-harvest (DEMO-0005): cold-store unit offer, 12 invoices (total only), the old equipment sheet.
{
  const d = farm(5);
  const offer = d.documents[0];
  const rows = tableRows(offer);
  const refrigerant = cell(offer, 'Agent frigorific');
  const gwp = refrigerant.match(/GWP ([\d.]+)/)[1];
  write('doc_oferta_agregat', 'OFFER', 'post_recolta', offer,
    [field('TOTAL_NET', `${ro(total(offer))} EUR`, 'EUR'), field('SPECIFIC_CONSUMPTION_KWH_PER_UNIT', cell(offer, 'Consum specific'), 'KWH'),
      field('REFRIGERANT_TYPE', refrigerant, 'TEXT'), field('REFRIGERANT_GWP', gwp, 'PCS')],
    [line(1, 'REFRIGERATION_UNIT', rows[0][1], rows[0][2], rows[0][3]), line(2, 'REFRIGERATION_UNIT', rows[1][1], rows[1][2], rows[1][3]),
      line(3, 'INSTALLATION_WORKS', rows[2][1], rows[2][2], rows[2][3])]);
  const kwh = energyInvoices('doc_facturi_energie_depozit', 'post_recolta', d.documents[1], false);
  if (kwh !== 85000) throw new Error(`post-harvest invoices add up to ${kwh}, expected 85000`);
  const old = d.documents[2];
  const year = sectionRows(old, 'Echipament').find((r) => r[0].startsWith('An'))[1];
  write('doc_fisa_echipament_vechi', 'CURRENT_EQUIPMENT', 'post_recolta', old,
    [field('MANUFACTURE_YEAR', year, 'YEAR'), field('REFRIGERANT_GWP', gwp, 'PCS')], []);
}
