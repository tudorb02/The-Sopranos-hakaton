// The demo dossier of Legume Bărăgan SRL (fictional): vegetables in the south-east, the irrigation module.
// Amounts in EUR. The figures are what the financial engine would return (README §8); the arithmetic is below,
// so the backend tests can start from the same values.
//
// A, standard: 85.000 EUR, 15% advance 12.750, loan 72.250 at 7,2% over 60 months → 1.437/month, 86.248 paid;
//   mortgage costs: valuation 600 + notary 1.200 + insurance 300 × 5 = 3.300.
// B, green: 96.500 EUR (85.000 + upgrade 11.500), advance 14.475, loan 82.025 at 5,4% over 60 months →
//   93.778 paid, in 20 seasonal payments of 4.689 (July–October: same total, only in the income months).
// Savings: water and pumping cost 14.000 EUR/year; A saves 15% = 2.100/year, B 32% = 4.480 + solar pump 3.220
//   = 7.700/year; over 5 years 10.500 vs 38.500.
// Net advantage = (38.500 − 14.475 − 93.778 − 0) − (10.500 − 12.750 − 86.248 − 3.300) = 22.045.
// Upgrade payback = 11.500 / ((7.700 − 2.100) / 12) ≈ 25 months.
// Water: 40 ha × 3.500 m³ = 140.000 m³/year; A saves 21.000, B 44.800.
// CO₂ at 0,26 kg/kWh and 0,3 kWh/m³: A 21.000 × 0,3 = 6.300 kWh → 1,6 t; B 13.440 + 20.000 solar kWh → 8,7 t.

import { bankServices } from "../../bank.js";

export const selectedModule = "irigatii";

// src: where the value comes from, shown as "din …".
export const company = {
  name: "Legume Bărăgan SRL",
  account: "CUI 4•••••7 · din contul firmei",
  facts: [
    { label: "Activitate", value: "CAEN 0113 · Cultivarea legumelor și a pepenilor", src: "ANAF" },
    { label: "Angajați", value: "9", src: "ANAF" },
    { label: "Cifra de afaceri 2025", value: "2,1 mil. lei", src: "ANAF" },
    { label: "Suprafață", value: "44 ha, în 6 parcele", src: "APIA" },
    { label: "Culturi 2024–2026", value: "Roșii, ardei, ceapă și varză, în rotație", src: "APIA" },
    { label: "Subvenții 2025", value: "Circa 9.500 EUR", src: "APIA" },
    { label: "Încasări", value: "Cele mai mari în iulie–octombrie", src: "Open Banking" },
  ],
};

// fixed: public data, no consent needed.
export const consents = [
  { id: "anaf", label: "ANAF și ONRC", hint: "Date publice despre firmă", on: true, fixed: true },
  { id: "apia", label: "APIA", hint: "Parcelele, culturile pe 3 ani și subvențiile", on: true },
  { id: "ansvsa", label: "ANSVSA", hint: "Animalele din exploatație, doar dacă ai", on: false },
  { id: "open-banking", label: "Open Banking", hint: "Încasările și plățile pe 12–24 de luni, ca ratele să vină în lunile în care încasezi", on: true },
];

// variant: which "where" step the area uses (parcels for agriculture). Points are in a 320 × 170 view.
export const location = {
  variant: "parcels",
  title: "Pe ce parcele?",
  lead: "Parcelele vin din APIA. Bifează-le pe cele pe care faci investiția.",
  canal: "M4 20 C 90 12, 210 24, 316 14",
  parcels: [
    { id: "P1", name: "La canal", ha: 12, crop: "Roșii", selected: true, points: "16,32 132,28 136,88 20,92", label: [76, 58] },
    { id: "P2", name: "Lunca", ha: 8.5, crop: "Ardei", selected: true, points: "140,28 216,26 220,84 144,88", label: [180, 55] },
    { id: "P3", name: "Hotar", ha: 9.5, crop: "Ceapă", selected: true, points: "224,26 306,22 308,82 228,84", label: [266, 52] },
    { id: "P4", name: "Grădina mare", ha: 6, crop: "Varză", selected: true, points: "20,98 98,96 100,150 22,154", label: [60, 122] },
    { id: "P5", name: "Fântână", ha: 4, crop: "Roșii", selected: true, points: "104,96 160,94 162,148 106,150", label: [133, 120] },
    { id: "P6", name: "Deal", ha: 4, crop: "Lucernă", selected: false, points: "166,94 222,92 224,146 168,148", label: [195, 118] },
  ],
  layers: [
    { label: "Risc de secetă", value: "Ridicat", src: "Copernicus" },
    { label: "Zonă Natura 2000", value: "Nu", src: "Natura 2000" },
    { label: "Zonă vulnerabilă la nitrați", value: "Nu", src: "lista oficială" },
  ],
};

// state: "done", "ready" or "missing"; `file` is what was uploaded.
export const documents = {
  oferta: { state: "done", file: "oferta_aspersie_agroirig.pdf · 4 pagini" },
  actual: { state: "done", file: "Descriere: aspersie mobilă cu tambur, din 2014" },
  loc: { state: "ready", file: "5 parcele, 40 ha" },
  anar: { state: "missing", file: "O poți trimite și după aprobare" },
  consum: { state: "done", file: "facturi_energie_pompare_2025.pdf · 12 luni" },
};

// Answers by question id; `src` marks what was filled in from APIA or Open Banking.
export const answers = {
  culturi: { value: "Roșii 45 t/ha, ardei 28 t/ha, ceapă 35 t/ha", src: "APIA" },
  azot: { value: "120" },
  sol: { selected: ["Arătură"] },
  rotatie: { selected: ["Rotație"], src: "APIA" },
  irigare: { selected: ["Da, prin aspersie"] },
  asigurare: { selected: ["Da"] },
  certificari: { selected: ["GlobalGAP"] },
  contracte: { selected: ["Da"] },
  incasari: { selected: ["Iul.", "Aug.", "Sep.", "Oct."], src: "Open Banking" },
  deseuri: { selected: ["Vând utilajul", "Predau ambalajele și folia unui colector autorizat"] },
};

// The three agents, named for the farmer (design/pj-greenstruct.md §4). tone: "warn" or "ok" highlights a message.
export const analysis = {
  title: "Analizăm investiția",
  lead: "Durează câteva minute. Poți închide aplicația: îți scriem când oferta e gata.",
  phases: [
    { label: "Verificăm investiția", state: "done", note: "Oferta, documentele și criteriul verde" },
    { label: "Comparăm creditele", state: "done", note: "Creditul standard și cel verde, pe 5 ani" },
    { label: "Pregătim dosarul pentru bancă", state: "running", note: "Raportul pentru ofițerul de credit", progress: 80 },
  ],
  messages: [
    { phase: "Verificăm investiția", text: "Am citit oferta: aspersie clasică pentru 40 ha, 85.000 EUR." },
    { phase: "Verificăm investiția", text: "Sistemul ales economisește 15% apă. Pentru creditul verde e nevoie de 25%.", tone: "warn" },
    {
      phase: "Verificăm investiția",
      text: "Am găsit o soluție: picurare, senzori de umiditate și o pompă solară. Economia ajunge la 32%, cu 11.500 EUR în plus.",
      tone: "ok",
    },
    { phase: "Verificăm investiția", text: "Investiția nu atinge zone Natura 2000 și nu crește consumul de îngrășăminte." },
    { phase: "Comparăm creditele", text: "Cu creditul verde, ratele vin după recoltă, în iulie–octombrie." },
    { phase: "Comparăm creditele", text: "Ratele încap în încasările firmei din ultimele 24 de luni." },
    { phase: "Pregătim dosarul pentru bancă", text: "Mai lipsește autorizația de gospodărire a apelor: o poți trimite și după aprobare." },
  ],
  note: "Cifrele sunt calculate de bancă, după reguli fixe, nu de AI.",
};

const MONTHS = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];
const NAMES = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const GREEN_MONTHS = [6, 7, 8, 9];

export const offer = {
  eyebrow: "Oferta ta · Irigații, 40 ha",
  headline: { label: "Câștigi în 5 ani cu creditul verde", eur: 22045 },
  sub: "Economii mai mari la apă și energie, fără costuri cu ipoteca și rate după recoltă.",
  recommended: "Recomandat: investiția optimizată e eligibilă pentru creditul verde, iar avantajul net e pozitiv.",
  change: {
    from: { name: "Aspersie clasică", note: "Economie de apă: 15%", eur: 85000 },
    to: { name: "Picurare, senzori de umiditate și pompă solară", note: "Economie de apă: 32%", eur: 96500 },
    payback: "Costul în plus, de 11.500 EUR, se recuperează din economii în circa 25 de luni.",
  },
  columns: ["Credit standard", "Credit verde"],
  rows: [
    { label: "Investiția", a: "85.000 EUR", b: "96.500 EUR" },
    { label: "Avans, 15%", a: "12.750 EUR", b: "14.475 EUR" },
    { label: "Dobânda, orientativ", a: "7,2% pe an", b: "5,4% pe an" },
    { label: "Garanția", a: "Ipotecă pe teren", b: "Garanție FEI, prin InvestEU" },
    { label: "Costuri cu ipoteca, în 5 ani", a: "3.300 EUR", b: "0 EUR" },
    { label: "Ratele", a: "1.437 EUR în fiecare lună", b: "4.689 EUR în iulie–octombrie" },
    { label: "Economii la apă și energie", a: "2.100 EUR pe an", b: "7.700 EUR pe an" },
    { label: "Apă economisită", a: "21.000 m³ pe an", b: "44.800 m³ pe an" },
    { label: "CO₂ evitat", a: "1,6 t pe an", b: "8,7 t pe an" },
    { label: "Ce te obligi să faci", a: "–", b: "Dovezi după instalare și monitorizare" },
  ],
  difference:
    "Cei 22.045 EUR vin din economii mai mari (+28.000 EUR) și din lipsa costurilor cu ipoteca (+3.300 EUR), minus plățile mai mari pentru investiția optimizată (−9.255 EUR).",
  payments: {
    standard: 1437,
    green: 4689,
    scaleMax: 5000,
    months: MONTHS.map((short, i) => ({ short, name: NAMES[i], eur: GREEN_MONTHS.includes(i) ? 4689 : 0 })),
  },
  obligations: [
    { when: "La tragere", what: "Factura finală", note: "Trebuie să corespundă configurației aprobate" },
    { when: "După instalare", what: "Procesul-verbal de punere în funcțiune", note: "Cu poze geolocalizate" },
    { when: "Automat", what: "Verificări prin satelit", note: "Parcelele sunt cultivate, vegetația e sănătoasă" },
    { when: "La 12 luni", what: "Consumul real de apă și energie", note: "Comparat cu estimarea din dosar" },
  ],
  guarantee: {
    ...bankServices.eifCompetitivitate,
    id: "eif",
    state: "active",
    status: "În oferta verde",
    helps:
      "Garanția acoperă 70% din creditul de 82.025 EUR. În oferta orientativă, ține locul ipotecii pe teren: economisești circa 3.300 EUR cu evaluarea, notarul și asigurarea.",
    whyLabel: "De ce se aplică",
    why: "Investiția optimizată trece criteriul verde pentru irigații: 32% economie de apă, peste pragul de 25%.",
    without: "Fără garanție, banca ar cere ipotecă pe teren, ca la creditul standard.",
  },
  notice: "Oferta e orientativă. Când trimiți cererea, dosarul ajunge la un ofițer de credit Raiffeisen, care stabilește dobânda finală și aprobarea.",
};

export const dossier = {
  href: "#/verde/agro/dosar",
  row: { title: "Irigații · 40 ha", note: "Agricultură · trimisă pe 12 noiembrie", status: "În analiză" },
  eyebrow: "Agricultură · Irigații · 40 ha",
  title: "Cerere trimisă, în analiză",
  text: "Ai trimis cererea pe 12 noiembrie. Un ofițer de credit verifică dosarul și îți scrie aici dacă are nevoie de ceva.",
  steps: [
    { label: "Trimisă", note: "12 noiembrie", state: "done" },
    { label: "În analiză", note: "La ofițerul de credit", state: "running" },
    { label: "Aprobată", note: "Urmează", state: "waiting" },
    { label: "Monitorizare", note: "După instalare", state: "waiting" },
  ],
  conditions: ["anar"],
};
