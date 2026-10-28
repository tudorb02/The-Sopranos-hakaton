// The demo dossier of Legume Bărăgan SRL (fictional): vegetables in the south-east, 40 ha irrigated by furrows,
// asking for classic sprinklers (GreenStruct README §12). Amounts in EUR. The figures are what the calculation
// engine would return with the README formulas (§4, §6 category 1); the inputs are below, for the backend tests.
//
// Water: net need 140.000 m³/year; furrows η 0,60 → 233.333 m³; sprinklers η 0,75 → 186.667 (−20%, under the
//   25% threshold); drip η 0,90 + soil sensors 10% → 140.000 (−40%, Verde Plus: at least 37,5%).
// Pumping (well, 18 m): 36.000 kWh/year now, 33.000 with sprinklers, 22.000 with drip. Prices: water 0,03 EUR/m³
//   (ANAR), energy 0,18 EUR/kWh. Savings: classic 46.667 × 0,03 + 3.000 × 0,18 = 1.940; green 93.333 × 0,03 +
//   14.000 × 0,18 = 5.320 EUR/year. CO₂ at 0,26 t/MWh: 0,8 and 3,6 t/year.
// Classic: 85.000, advance 15% = 12.750, loan 72.250 at 8,9% over 60 months → 1.496/month, 89.777 paid;
//   mortgage: valuation 600 + notary 1.200 + registration 200 + insurance 300 × 5 = 3.500.
// Green: 93.000 (upgrade + 8.000), advance 13.950, loan 79.050 at 6,3%: interest only until the first harvest
//   (6 × 415), then 20 payments of 4.523 in July–October, same present value as the annuity → 92.948 paid.
// Net advantage over 5 years = (26.600 − 13.950 − 92.948) − (9.700 − 12.750 − 89.777 − 3.500) = 16.030.
// Upgrade payback = 8.000 / ((5.320 − 1.940) / 12) ≈ 28 months. DSCR = (95.000 + 5.320) / (4 × 4.523) ≈ 5,5.

import { bankServices } from "../../bank.js";

export const selectedModule = "irigatii";

// src: where the value comes from, shown as "din …".
export const company = {
  name: "Legume Bărăgan SRL",
  account: "CUI 4•••••7 · din contul firmei",
  facts: [
    { label: "Activitate", value: "CAEN 0113 · Cultivarea legumelor și a pepenilor", src: "ANAF" },
    { label: "Statut", value: "IMM: 9 angajați, cifră de afaceri de 2,1 mil. lei în 2025", src: "ANAF" },
    { label: "Suprafață", value: "44 ha, în 6 parcele", src: "APIA" },
    { label: "Culturi 2024–2026", value: "Roșii, ardei, ceapă și varză, în rotație", src: "APIA" },
    { label: "Subvenții 2025", value: "Circa 9.500 EUR", src: "APIA" },
    { label: "Încasări nete din activitate", value: "Circa 95.000 EUR pe an, cele mai mari în iulie–octombrie", src: "Open Banking" },
  ],
};

// fixed: public data, no consent needed. The README asks for two consents (§2, step 1).
export const consents = [
  { id: "anaf", label: "ANAF și ONRC", hint: "Date publice despre firmă", on: true, fixed: true },
  { id: "apia", label: "APIA", hint: "Parcelele, culturile pe 3 ani și subvențiile", on: true },
  { id: "open-banking", label: "Open Banking", hint: "Încasările și plățile pe 12–24 de luni, ca ratele să vină în lunile în care încasezi", on: true },
];

// variant: which "where" step the area uses (parcels for agriculture). Points are in a 320 × 170 view.
export const location = {
  variant: "parcels",
  title: "Unde?",
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
    { label: "Stres hidric", value: "Moderat, nu sever", src: "hărți publice" },
    { label: "Zonă Natura 2000", value: "Nu", src: "Natura 2000" },
    { label: "Zonă vulnerabilă la nitrați", value: "Nu", src: "lista oficială" },
  ],
};

// state: "done", "ready" or "missing"; `file` is what was uploaded or why it helps.
export const documents = {
  oferta: { state: "done", file: "oferta_aspersie_agroirig.pdf · 4 pagini" },
  loc: { state: "ready", file: "5 parcele, 40 ha" },
  anar: { state: "done", file: "autorizatie_gospodarire_ape_2025.pdf" },
  consum: { state: "missing", file: "Opțional: face estimarea mai precisă" },
};

// Answers by question id; `src` marks what was filled in from APIA.
export const answers = {
  "sistem-actual": { selected: ["Prin brazde"] },
  "sursa-apei": { selected: ["Puț"] },
  pompare: { value: "18" },
  "culturi-irigate": { value: "Roșii 16 ha, ardei 8,5 ha, ceapă 9,5 ha, varză 6 ha", src: "APIA" },
  "echipament-vechi": { selected: ["Îl predau la reciclare autorizată"] },
};

// The three agents, named for the farmer (design/pj-greenstruct.md §4). tone: "warn" or "ok" highlights a message.
export const analysis = {
  title: "Analizăm investiția",
  lead: "Durează câteva minute. Poți închide aplicația: îți scriem când ofertele sunt gata.",
  phases: [
    { label: "Verificăm investiția", state: "done", note: "Indicatorul verde, pragul și verificările de mediu" },
    { label: "Construim creditele", state: "done", note: "Creditul clasic și cel verde, cu fondul potrivit" },
    { label: "Pregătim dosarul pentru bancă", state: "running", note: "Raportul pentru ofițerul de credit", progress: 80 },
  ],
  messages: [
    { phase: "Verificăm investiția", text: "Am citit oferta: aspersie clasică pentru 40 ha, 85.000 EUR." },
    { phase: "Verificăm investiția", text: "Acum irigi prin brazde. Aspersia economisește 20% apă, iar pentru creditul verde e nevoie de 25%.", tone: "warn" },
    { phase: "Verificăm investiția", text: "Cu picurare și senzori de umiditate ajungi la 40%, cu 8.000 EUR în plus: nivelul Verde Plus.", tone: "ok" },
    { phase: "Verificăm investiția", text: "Ai autorizația ANAR, parcelele nu sunt în zone Natura 2000, iar zona nu are stres hidric sever." },
    { phase: "Construim creditele", text: "Fondul potrivit: garanția FEI InvestEU de sustenabilitate, pentru investiții verzi." },
    { phase: "Construim creditele", text: "Dobânda scade de la 8,9% la 6,3%, iar ratele vin după recoltă, în iulie–octombrie." },
    { phase: "Construim creditele", text: "Banii din activitate acoperă de 5,5 ori ratele anuale." },
    { phase: "Pregătim dosarul pentru bancă", text: "Documentele esențiale sunt complete. Poți adăuga facturile de energie pentru o estimare mai precisă." },
  ],
  note: "Cifrele sunt calculate de bancă, după formule fixe, nu de AI.",
};

const MONTHS = ["I", "F", "M", "A", "M", "I", "I", "A", "S", "O", "N", "D"];
const NAMES = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const HARVEST = [6, 7, 8, 9];

// The two offers (README §4, step 5). level: the green level of README §4, step 8.
export const offer = {
  eyebrow: "Ofertele tale · Irigații, 40 ha",
  headline: { label: "Câștigi în 5 ani alegând creditul verde", eur: 16030 },
  level: { name: "Verde Plus", text: "Economia de apă, 40%, trece pragul de 25% cu mult: primești reducerea maximă de dobândă." },
  recommended: "Recomandat: investiția verde e eligibilă, iar avantajul net e pozitiv.",
  columns: ["Credit clasic", "Credit verde"],
  rows: [
    { label: "Investiția", a: "Aspersie clasică, 85.000 EUR", b: "Picurare și senzori, 93.000 EUR" },
    { label: "De unde vin banii", a: "Resursele obișnuite ale băncii", b: "Fondurile verzi: garanția FEI InvestEU și obligațiunile verzi" },
    { label: "Avans, 15%", a: "12.750 EUR", b: "13.950 EUR" },
    { label: "Dobânda", a: "8,9% pe an", b: "6,3% pe an" },
    { label: "Garanția", a: "Ipotecă pe teren", b: "Garanție FEI, în locul ipotecii" },
    { label: "Costuri cu ipoteca, în 5 ani", a: "3.500 EUR", b: "0 EUR" },
    { label: "Ratele", a: "1.496 EUR în fiecare lună", b: "Doar dobânda până la prima recoltă, apoi 4.523 EUR în iulie–octombrie" },
    { label: "Economii la apă și energie", a: "1.940 EUR pe an", b: "5.320 EUR pe an" },
    { label: "Apă economisită", a: "46.700 m³ pe an", b: "93.300 m³ pe an" },
    { label: "CO₂ evitat", a: "0,8 t pe an", b: "3,6 t pe an" },
  ],
  difference:
    "Cei 16.030 EUR vin din economii mai mari (+16.900 EUR) și din lipsa costurilor cu ipoteca (+3.500 EUR), minus plățile mai mari pentru investiția verde (−4.370 EUR).",
  // Why the green rate is lower (README §4, step 6). The parameters are illustrative; the bank sets the real ones.
  rate: {
    title: "De ce e mai mică dobânda verde",
    parts: [
      { label: "Garanția FEI: banca pierde mai puțin dacă un credit nu se plătește", pp: "−1,01 pp" },
      { label: "Partea garantată cere mai puțin capital: FEI are risc zero pentru bancă", pp: "−0,76 pp" },
      { label: "Bani din obligațiunile verzi ale băncii, cumpărate și de BERD și IFC", pp: "−0,30 pp" },
      { label: "Analiza tehnică e automată, nu manuală", pp: "−0,15 pp" },
      { label: "Comision redus pe programul de garanție", pp: "−0,40 pp" },
    ],
    total: { label: "De la 8,9% la 6,3%", pp: "−2,6 pp" },
    note: "Parametrii sunt orientativi. Banca își pune valorile reale.",
  },
  payments: {
    standard: 1496,
    green: 4523,
    scaleMax: 5000,
    months: MONTHS.map((short, i) => ({ short, name: NAMES[i], eur: HARVEST.includes(i) ? 4523 : 0 })),
  },
  guarantee: {
    ...bankServices.eifSustainability,
    id: "eif",
    state: "active",
    status: "În oferta verde",
    helps:
      "Garanția acoperă 70% din creditul de 79.050 EUR. În oferta orientativă, ține locul ipotecii pe teren: economisești circa 3.500 EUR cu evaluarea, notarul, înscrierea și asigurarea.",
    whyLabel: "De ce se aplică",
    why: "Irigațiile cu picurare și senzori sunt o investiție verde documentată: 40% economie de apă, cu impactul calculat.",
    without: "Fără garanție, banca ar cere ipotecă pe teren, ca la creditul clasic.",
  },
  notice: "Ofertele sunt orientative. Când trimiți cererea, dosarul ajunge la un ofițer de credit Raiffeisen, care stabilește dobânda finală și aprobarea.",
};

// What to change so the investment becomes green (README §4, step 4).
export const changes = {
  title: "Ce să schimbi",
  lead: "Investiția cerută nu trece pragul verde. Aceasta e cea mai ieftină schimbare care îl trece.",
  from: { name: "Aspersie clasică", note: "Economie de apă: 20%, sub pragul de 25%", eur: 85000 },
  to: { name: "Picurare și senzori de umiditate", note: "Economie de apă: 40%, nivelul Verde Plus", eur: 93000 },
  facts: [
    { label: "Cost în plus", value: "8.000 EUR" },
    { label: "Economie în plus", value: "3.380 EUR pe an" },
    { label: "Se recuperează în", value: "Circa 28 de luni" },
    { label: "Apă economisită", value: "De la 46.700 la 93.300 m³ pe an" },
  ],
  more: ["Programare automată a udării", "Pompă cu variator de turație", "Pompă solară, la categoria Energie la fermă"],
};

// The request, checked by the consultant before it goes to the bank. The readiness counts the bank's criteria the
// dossier meets; it is not a probability of approval, which only the bank's assessment gives.
export const advice = {
  title: "Trimite cererea",
  lead: "Alege varianta, apoi vezi ce mai poți îmbunătăți și ce clauze să ceri. Nu e o promisiune de aprobare: decizia o ia un ofițer de credit.",
  variants: [
    { id: "verde", name: "Credit verde", note: "Picurare și senzori · 6,3% · rate după recoltă", selected: true, badge: "Recomandat" },
    { id: "clasic", name: "Credit clasic", note: "Aspersie clasică · 8,9% · rate lunare egale" },
  ],
  readiness: {
    title: "Cât de pregătit e dosarul",
    met: 5,
    total: 5,
    summary: "Toate cele 5 criterii ale băncii sunt îndeplinite. Nu e o probabilitate de aprobare: arată doar ce mai poți îmbunătăți.",
    items: [
      { state: "done", label: "Investiția e verde", note: "Nivelul Verde Plus: 40% economie de apă, față de pragul de 25%" },
      { state: "done", label: "Banii acoperă ratele", note: "Încasările din activitate și economiile acoperă de 5,5 ori ratele anuale" },
      { state: "done", label: "Garanția acoperă creditul", note: "Garanția FEI acoperă 70%, fără ipotecă pe teren" },
      { state: "done", label: "Plăți la timp", note: "Nicio întârziere la credite sau la furnizori în ultimii 2 ani, din conturile firmei" },
      { state: "done", label: "Documentele esențiale", note: "Oferta, parcelele și autorizația ANAR" },
    ],
  },
  actions: [
    { icon: "upload", title: "Adaugă facturile de energie pentru pompare", text: "Sunt opționale, dar fac estimarea economiilor mai precisă, iar ofițerul are mai puține întrebări.", button: "Încarcă" },
    { icon: "file", title: "Atașează contractele de vânzare pentru 2027", text: "Arată de unde vin banii pentru rate și întăresc analiza capacității de plată.", button: "Atașează" },
  ],
  // status: "offer" (already in the green offer), "ask" (to request from the officer) or "proposal" (a new idea
  // of the GreenStruct team, not an existing Raiffeisen product: README §4, step 6).
  clauses: [
    { title: "Grație până la prima recoltă, apoi rate după recoltă", text: "Până în iulie 2027 plătești doar dobânda, apoi ratele vin în iulie–octombrie.", status: "offer" },
    { title: "Garanție FEI în locul ipotecii", text: "Terenul rămâne liber pentru alte finanțări, iar costurile cu ipoteca, de circa 3.500 EUR, dispar.", status: "offer" },
    { title: "Impactul se raportează o dată, la 12 luni", text: "Trimiți consumul real de apă o singură dată, după un an.", status: "offer" },
    { title: "Bonus de impact", text: "Dobânda mai scade cu 0,25 pp dacă, la 12 luni, economia reală confirmă estimarea.", status: "proposal" },
    { title: "Avans mai mic sau durată mai lungă", text: "Potrivit FEI, garanția le poate permite. Întreabă dacă se aplică dosarului tău.", status: "ask" },
    { title: "Rambursare anticipată după o recoltă bună", text: "Întreabă dacă poți plăti mai devreme și ce comision se aplică.", status: "ask" },
  ],
  obligations: [
    { when: "La tragere", what: "Factura finală", note: "Pentru investiția aprobată, cu picurare și senzori" },
    { when: "După instalare", what: "Procesul-verbal de punere în funcțiune", note: "Cu poze geolocalizate" },
    { when: "La 12 luni", what: "Consumul real de apă", note: "Comparat cu estimarea din dosar" },
  ],
  note: "Consultantul e un serviciu al băncii și îți spune deschis ce îți crește șansele. Nu înfrumusețează datele: tot ce trimiți trebuie să fie corect. Clauzele de cerut și propunerile depind de decizia băncii.",
};

export const dossier = {
  href: "#/verde/agro/dosar",
  row: { title: "Irigații · 40 ha", note: "Agricultură · trimisă pe 12 noiembrie", status: "În analiză" },
  eyebrow: "Agricultură · Irigații · 40 ha · Verde Plus",
  title: "Cerere trimisă, în analiză",
  text: "Ai trimis cererea pentru creditul verde pe 12 noiembrie. Un ofițer de credit verifică dosarul și îți scrie aici dacă are nevoie de ceva.",
  steps: [
    { label: "Trimisă", note: "12 noiembrie", state: "done" },
    { label: "În analiză", note: "La ofițerul de credit", state: "running" },
    { label: "Aprobată", note: "Urmează", state: "waiting" },
    { label: "Monitorizare", note: "După instalare", state: "waiting" },
  ],
  impact: [
    { label: "Apă economisită", value: "93.300 m³ pe an" },
    { label: "Energie de pompare", value: "14.000 kWh mai puțin pe an" },
    { label: "CO₂ evitat", value: "3,6 t pe an" },
  ],
};
