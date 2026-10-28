// Renders the fictional demo documents of every farm in data/demo/test-documents/farms/
// into data/demo/test-documents/pdf/<farm id>/. Values come only from the farm JSON,
// so the PDFs always match the mocks (run verify.mjs first).
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PKG = join(root, 'data/demo/test-documents');
const farmsDir = join(PKG, 'farms');
const outRoot = join(PKG, 'pdf');

// Fonts with Romanian diacritics. Override with FONT_REGULAR / FONT_BOLD.
const FONT_REGULAR = process.env.FONT_REGULAR ?? '/System/Library/Fonts/Supplemental/Arial.ttf';
const FONT_BOLD = process.env.FONT_BOLD ?? '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
for (const f of [FONT_REGULAR, FONT_BOLD]) {
  if (!existsSync(f)) throw new Error(`Font not found: ${f}. Set FONT_REGULAR and FONT_BOLD to TTF files with Romanian diacritics.`);
}

const MARGIN = 50;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const ACCENT = '#1f5f3f';
const MUTED = '#666666';

const fmtNum = (n, decimals = 0) =>
  n.toLocaleString('ro-RO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtDate = (iso) => iso.split('-').reverse().join('.');

function newDoc(path) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: 'Document de test fictiv – GreenStruct Agro' } });
  doc.registerFont('R', FONT_REGULAR);
  doc.registerFont('B', FONT_BOLD);
  doc.pipe(createWriteStream(path));
  doc.on('pageAdded', () => decorate(doc));
  decorate(doc);
  return doc;
}

// Banner and watermark on every page, so no one mistakes a demo document for a real one.
function decorate(doc) {
  const { x, y } = { x: doc.x, y: doc.y };
  doc.save();
  doc.rect(0, 0, PAGE_W, 22).fill('#b42318');
  doc.font('B').fontSize(8.5).fillColor('#ffffff')
    .text('DOCUMENT DE TEST · FICTIV · creat pentru demo-ul GreenStruct Agro · nu are valoare juridică', 0, 7, { width: PAGE_W, align: 'center' });
  doc.rotate(-35, { origin: [PAGE_W / 2, 420] });
  doc.font('B').fontSize(110).fillColor('#000000').fillOpacity(0.05).text('DEMO', 0, 360, { width: PAGE_W, align: 'center' });
  doc.restore();
  doc.fillOpacity(1).fillColor('#000000');
  doc.x = x;
  doc.y = Math.max(y, 40);
}

function header(doc, d, farm, { number, date, title }) {
  const top = 44;
  doc.font('B').fontSize(12).fillColor(ACCENT).text(d.issuer.name, MARGIN, top, { width: CONTENT_W / 2 });
  doc.font('R').fontSize(8.5).fillColor(MUTED).text(d.issuer.address, MARGIN, doc.y + 2, { width: CONTENT_W / 2 });
  const leftBottom = doc.y;
  doc.font('B').fontSize(13).fillColor('#000000').text(title, MARGIN + CONTENT_W / 2, top, { width: CONTENT_W / 2, align: 'right' });
  doc.font('R').fontSize(9).fillColor('#000000')
    .text(`Nr. ${number}`, { width: CONTENT_W / 2, align: 'right' })
    .text(`Data: ${fmtDate(date)}`, { width: CONTENT_W / 2, align: 'right' });
  doc.y = Math.max(leftBottom, doc.y) + 12;
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).lineWidth(0.8).strokeColor(ACCENT).stroke();
  doc.y += 10;
  doc.font('B').fontSize(9).fillColor('#000000').text('Către / titular: ', MARGIN, doc.y, { continued: true })
    .font('R').text(`${farm.anaf.name}, CUI ${farm.anaf.cui}, ${farm.anaf.address}`);
  doc.y += 12;
}

function heading(doc, text) {
  ensureSpace(doc, 40);
  doc.font('B').fontSize(10.5).fillColor(ACCENT).text(text, MARGIN, doc.y, { width: CONTENT_W });
  doc.y += 4;
  doc.fillColor('#000000');
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - MARGIN - 20) doc.addPage();
}

function keyValues(doc, rows) {
  const keyW = CONTENT_W * 0.45;
  for (const [k, v] of rows) {
    ensureSpace(doc, 20);
    const y = doc.y;
    doc.font('R').fontSize(9).fillColor(MUTED).text(k, MARGIN, y, { width: keyW - 8 });
    const h1 = doc.y - y;
    doc.font('B').fontSize(9).fillColor('#000000').text(v, MARGIN + keyW, y, { width: CONTENT_W - keyW });
    const h2 = doc.y - y;
    doc.y = y + Math.max(h1, h2) + 4;
  }
  doc.y += 6;
}

function table(doc, { columns, rows }, widths) {
  // Only money columns are right-aligned; descriptive tables keep left alignment.
  const moneyLast = /EUR|Valoare|Preț/.test(columns[columns.length - 1]);
  const w = widths ?? defaultWidths(columns.length, moneyLast);
  const drawRow = (cells, bold, fill) => {
    const heights = cells.map((c, i) => doc.font(bold ? 'B' : 'R').fontSize(9).heightOfString(String(c), { width: w[i] - 8 }));
    const h = Math.max(...heights) + 8;
    ensureSpace(doc, h);
    const y = doc.y;
    if (fill) doc.rect(MARGIN, y, CONTENT_W, h).fill(fill);
    let x = MARGIN;
    cells.forEach((c, i) => {
      const right = moneyLast && i === cells.length - 1;
      doc.font(bold ? 'B' : 'R').fontSize(9).fillColor('#000000')
        .text(String(c), x + 4, y + 4, { width: w[i] - 8, align: right ? 'right' : 'left' });
      x += w[i];
    });
    doc.moveTo(MARGIN, y + h).lineTo(PAGE_W - MARGIN, y + h).lineWidth(0.4).strokeColor('#cccccc').stroke();
    doc.y = y + h;
  };
  drawRow(columns, true, '#e8f1ec');
  for (const row of rows) drawRow(row, row[1] === 'TOTAL', row[1] === 'TOTAL' ? '#f5f5f5' : null);
  doc.y += 10;
}

const defaultWidths = (n, moneyLast) => {
  if (n === 4 && moneyLast) return [40, CONTENT_W - 40 - 70 - 110, 70, 110];
  if (n === 4) return [50, 140, 80, CONTENT_W - 270];
  return Array(n).fill(CONTENT_W / n);
};

function paragraph(doc, text) {
  ensureSpace(doc, 30);
  doc.font('R').fontSize(9.5).fillColor('#000000').text(text, MARGIN, doc.y, { width: CONTENT_W, lineGap: 2 });
  doc.y += 10;
}

function footer(doc) {
  doc.font('R').fontSize(7.5).fillColor(MUTED)
    .text('Toate numele, codurile și cifrele din acest document sunt fictive și au fost generate pentru testarea aplicației GreenStruct Agro.',
      MARGIN, doc.page.height - MARGIN - 10, { width: CONTENT_W, align: 'center' });
}

function renderDocument(d, farm, path) {
  const doc = newDoc(path);
  header(doc, d, farm, d);
  for (const s of d.sections) {
    heading(doc, s.heading);
    if (s.text) paragraph(doc, s.text);
    if (s.rows) keyValues(doc, s.rows);
    if (s.table) table(doc, s.table);
  }
  footer(doc);
  doc.end();
}

function renderInvoiceSeries(d, farm, path) {
  const doc = newDoc(path);
  d.invoices.forEach((inv, idx) => {
    if (idx > 0) doc.addPage();
    header(doc, d, farm, { number: inv.number, date: inv.date, title: d.title });
    const item = inv.item ?? d.item;
    const unit = inv.unit ?? d.unit;
    const price = inv.unitPriceEur ?? d.unitPriceEur;
    const net = inv.qty * price;
    const vat = (net * d.vatPct) / 100;
    heading(doc, 'Detalii');
    keyValues(doc, [['Perioada', inv.period], ['Monedă', 'EUR (valori demo)']]);
    table(doc, {
      columns: ['Denumire', 'U.M.', 'Cantitate', 'Preț unitar', 'Valoare (fără TVA)'],
      rows: [[item, unit, fmtNum(inv.qty), fmtNum(price, 2), fmtNum(net, 2)]],
    }, [CONTENT_W - 60 - 75 - 70 - 95, 60, 75, 70, 95]);
    keyValues(doc, [
      ['Total fără TVA', `${fmtNum(net, 2)} EUR`],
      [`TVA ${d.vatPct}%`, `${fmtNum(vat, 2)} EUR`],
      ['Total de plată', `${fmtNum(net + vat, 2)} EUR`],
    ]);
    footer(doc);
  });
  doc.end();
}

const farms = readdirSync(farmsDir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(join(farmsDir, f), 'utf8')));
let count = 0;
for (const farm of farms) {
  const outDir = join(outRoot, farm.id);
  mkdirSync(outDir, { recursive: true });
  for (const d of farm.documents) {
    const path = join(outDir, d.file);
    if (d.kind === 'invoiceSeries') renderInvoiceSeries(d, farm, path);
    else renderDocument(d, farm, path);
    count++;
  }
}
console.log(`Generated ${count} documents for ${farms.length} farms in data/demo/test-documents/pdf/`);
