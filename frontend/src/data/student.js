// Fictional demo data for Matei, a student without a stable income (see design/coach-students.md).
// Same shapes as demo.js, tracking.js and activation.js, so the coach screens work unchanged.
// State shown: Thursday 12 November 2026, day 12 of the budget period 1–30 November.
// Money for November: 361 lei left from October + 1.500 lei received (family 1.200, tutoring 2 × 150).
// Spent 1.071 lei (necessary 697, optional 374) and 150 lei moved to the safety fund, so 640 lei are left.

import { apps as dariaApps, calendar as dariaCalendar, intro, questions as dariaQuestions, statements as dariaStatements } from "./activation.js";
import { bankPages, bankServices } from "./bank.js";
import { filters } from "./tracking.js";

export { filters, intro };

export const today = { label: "Joi, 12 noiembrie" };

export const client = { firstName: "Matei", name: "Matei Popescu", initial: "M", segment: "persoană fizică · student", card: "Card Visa •••• 5678" };

// No payday: the period ends the day before the next certain income (money from family, on the 1st).
// The scholarship is estimated, so it counts only once it arrives. `pace` appears when, at the current
// pace, the money runs out before the end of the period.
export const cycle = {
  label: "1 – 30 nov.",
  endsOn: "30 noiembrie",
  basis: "Banii de la familie intră pe 1 decembrie.",
  pace: "La ritmul de până acum, circa 55 lei pe zi, banii îți ajung până pe 23 noiembrie.",
  total: 1861,
  totalNote: "Din 1.861 lei: 1.500 lei încasați în noiembrie și 361 lei rămași din octombrie. Bursa nu e inclusă.",
  spendable: 1711,
  spent: 1071,
  left: 640,
  perDay: 34,
  daysLeftLabel: "19 zile",
};

export const allocation = [
  { id: "needs", label: "Necesare", lei: 1200, tone: "fixed" },
  { id: "aside", label: "Fond de siguranță", lei: 150, tone: "aside" },
  { id: "spend", label: "Opționale", lei: 511, tone: "spend" },
];

// What must still be paid until the end of the period, before any optional spending.
export const essentials = {
  title: "Necesare până pe 30 noiembrie",
  total: 503,
  items: [
    { name: "Cămin și transport", icon: "home", note: "400 lei, plătite pe 2 noiembrie", status: "Plătite" },
    { name: "Alimente", icon: "cart", note: "Circa 21 lei pe zi", lei: 403 },
    { name: "Studii", icon: "book", note: "Cărți și imprimări", lei: 75 },
    { name: "Telefon și internet", icon: "phone", note: "Pe 20 noiembrie", lei: 25 },
  ],
  rest: { label: "Rămân pentru opționale", lei: 137 },
  pending: "Bursa nu e inclusă: circa 700 lei, în jur de 15 noiembrie. O adaug în buget când intră în cont.",
};

export const week = {
  spent: 183,
  daysSoFar: 4,
  guidePerDay: 34,
  scaleMax: 120,
  days: [
    { d: "L", name: "luni", lei: 26 },
    { d: "Ma", name: "marți", lei: 107 },
    { d: "Mi", name: "miercuri", lei: 42 },
    { d: "J", name: "joi", lei: 8, today: true },
    { d: "V", name: "vineri" },
    { d: "S", name: "sâmbătă" },
    { d: "D", name: "duminică" },
  ],
};

export const lastMessage = {
  icon: "wallet",
  meta: "Ieri, 19:32 · Fond de siguranță",
  title: "Ai pus 15 lei deoparte",
  text: "10% din cei 150 lei de la meditații, cum am stabilit. Fondul de siguranță are acum 650 din 1.200 lei.",
};

export const insight = {
  figure: "6 zile",
  text: "Atât ți-au lipsit în medie până la 1 în lunile fără bursă, din iulie până în septembrie. În octombrie, cu bursa, ai încheiat luna cu 361 lei în cont.",
};

export const budgetGroups = [
  { id: "necesare", title: "Necesare", src: "agreed", note: "stabilite de tine" },
  { id: "optionale", title: "Opționale", note: "mai ai 137 lei" },
];

export const budgets = [
  { id: "camin", group: "necesare", name: "Cămin", icon: "home", kind: "paid", spent: 350, note: "Plătit pe 2 noiembrie" },
  { id: "transport", group: "necesare", name: "Transport", icon: "bus", kind: "paid", spent: 50, note: "Abonament de student, plătit pe 2 noiembrie" },
  { id: "alimente", group: "necesare", name: "Alimente", icon: "cart", kind: "amount", spent: 297, limit: 700, note: "Circa 21 lei pe zi până pe 30 noiembrie" },
  { id: "studii", group: "necesare", name: "Studii", icon: "book", kind: "amount", spent: 0, limit: 75, note: "Cărți și imprimări" },
  { id: "telefon", group: "necesare", name: "Telefon și internet", icon: "phone", kind: "amount", spent: 0, limit: 25, note: "Se plătește pe 20 noiembrie" },
  { id: "iesiri", group: "optionale", name: "Restaurante", icon: "utensils", kind: "amount", spent: 120, limit: 120, warn: true, note: "Limita lunii atinsă", onHome: true },
  { id: "livrari", group: "optionale", name: "Livrări de mâncare", icon: "bag", kind: "amount", spent: 86, limit: 120, note: "2 comenzi luna aceasta", onHome: true },
  { id: "cafenele", group: "optionale", name: "Cafenele", icon: "cup", kind: "amount", spent: 40, limit: 60, note: "5 cafele luna aceasta", onHome: true },
  { id: "taxi", group: "optionale", name: "Taxi", icon: "car", kind: "amount", spent: 40, limit: 60, note: "Doar seara târziu, cum am stabilit" },
];

export const unbudgeted = {
  total: 88,
  items: [
    { name: "Abonamente", icon: "repeat", lei: 60, note: "LinguaPlus și MuzicaPlus Student" },
    { name: "Fără categorie", icon: "help", lei: 28, note: "O plată de clarificat" },
  ],
};

export const question = {
  amount: 28,
  merchant: "PLAYNET*STORE",
  date: "7 noiembrie",
  options: ["Un joc", "Un abonament", "Altceva"],
  txId: "m13",
};

export const agenda = [
  { day: "15", month: "nov.", title: "Bursa, circa 700 lei", note: "Estimat: o adaug în buget când intră" },
  { day: "20", month: "nov.", title: "Telefon", note: "25 lei, din necesare" },
  { day: "1", month: "dec.", title: "Bani de la familie", note: "1.200 lei · 120 lei în fondul de siguranță" },
];

// The plan counts only certain money: 10% of the family money and of the smallest tutoring month.
export const goal = {
  name: "Fond de siguranță",
  icon: "shield",
  note: "O lună de cheltuieli necesare",
  saved: 650,
  amount: 1200,
  due: { label: "Obiectiv atins în", date: "martie 2027", note: "10% din fiecare încasare" },
  plan: [
    { month: "oct.", add: 500, total: 500 },
    { month: "nov.", add: 165, total: 665 },
    { month: "dec.", add: 135, total: 800 },
    { month: "ian.", add: 135, total: 935 },
    { month: "feb.", add: 135, total: 1070 },
    { month: "mar.", add: 130, total: 1200 },
  ],
  reason: "Am pornit de la cei 500 lei rămași din jobul de vară. Planific doar cu banii siguri, de la familie și din meditații. Dacă intră bursa, termenul se apropie.",
  fundingLabel: "estimat, pe lună",
  funding: [
    { name: "10% din banii de la familie", lei: 120 },
    { name: "10% din meditații, cel puțin", lei: 15 },
  ],
  storage: "savings",
  suggestion: "savingbox",
};

export const pots = [];

export const nextGoals = [
  {
    name: "Curs de UX design",
    icon: "book",
    amount: 900,
    when: "Începe în martie 2027",
    text: "Cu planul de acum, începi să economisești pentru curs după fondul de siguranță. Cu ideea săptămânii, banii sunt gata în februarie.",
    action: "Vezi ideea",
    href: "#/idei",
  },
];

export const reserve = null;

// Development ideas (design/coach-students.md §6): at most one new idea a week, each from a stated goal or interest.
export const ideas = {
  title: "Idei pentru tine",
  lead: "Pornesc de la ce mi-ai spus: vrei fondul de siguranță complet și cursul de UX design din martie. Primești cel mult o idee nouă pe săptămână.",
  featured: {
    icon: "wallet",
    eyebrow: "Ideea săptămânii · Venituri",
    title: "2 ore de meditații în plus pe săptămână",
    text: "La 50 lei ora, câștigi circa 400 lei în plus pe lună.",
    effects: ["Fondul de siguranță e complet în decembrie, nu în martie.", "Banii pentru cursul de UX design sunt gata în februarie."],
    why: "Pe 28 octombrie ai spus că dai meditații la matematică și că marțea și joia ai după-amiezile libere.",
    actions: ["Adaugă în plan", "Nu mă interesează"],
  },
  groups: [
    {
      title: "Venituri",
      items: [
        {
          icon: "calendar",
          title: "Jobul de vară din 2027",
          text: "Vara aceasta ai câștigat 2.400 lei, iar în octombrie mai aveai 500. Dacă împarți suma pe cele 9 luni de cursuri, ai circa 270 lei în plus în fiecare lună.",
          status: "Revin cu un plan în mai",
        },
      ],
    },
    {
      title: "Educație financiară gratuită",
      note: "de la Raiffeisen Bank",
      items: [
        {
          icon: "book",
          title: "5 sfaturi financiare pentru cei care se întrețin singuri",
          text: "Articol din ghidul „Despre bani 1:1” al băncii, despre bugetul celor care se descurcă pe cont propriu.",
          link: { href: bankPages.selfSupport, label: "Citește pe raiffeisen.ro" },
        },
        {
          icon: "shield",
          title: "Fondul de urgență",
          text: "De ce contează o rezervă și cum o construiești treptat. Se potrivește cu obiectivul tău de acum.",
          link: { href: bankPages.emergencyFund, label: "Citește pe raiffeisen.ro" },
        },
        {
          icon: "target",
          title: "Money Strike",
          text: "Hartă de joc gratuită pentru educație financiară. Modul de învățare are 10 runde și îți arată la final dacă ești Econom, Impulsiv sau Echilibrat.",
          link: { href: bankPages.moneyStrike, label: "Despre joc pe raiffeisen.ro" },
        },
        {
          icon: "lock",
          title: "Start în Investiții",
          text: "5 cursuri interactive în aplicație despre cum funcționează investițiile. Ți-l arăt după ce completezi fondul de siguranță și nu îți recomand fonduri.",
          link: { href: bankPages.startInvestitii, label: "Despre program pe raiffeisen.ro" },
          status: "După fondul de siguranță",
        },
      ],
    },
    {
      title: "Oportunități",
      items: [
        {
          icon: "calendar",
          title: "Bursa pentru semestrul al II-lea",
          text: "Termenul pentru dosar e pe 20 februarie, din calendarul tău. Îți amintesc cu o săptămână înainte.",
          status: "Memento pe 13 februarie",
        },
      ],
    },
  ],
  rules: "Ideile sunt orientative și le poți ascunde oricând. Nu îți promit venituri și nu îți propun pariuri, cripto sau scheme de câștig rapid.",
};

// type: "divider", "coach", "me", "proposal" or "service" (a card from `services`, by id).
export const chat = [
  { type: "divider", text: "28 octombrie" },
  {
    type: "coach",
    text: "În iulie, august și septembrie, banii s-au terminat cu 5–8 zile înainte de 1. În octombrie, cu bursa, mai ai 380 lei în cont cu 3 zile înainte de 1. Bursa vine sigur în fiecare lună de cursuri?",
  },
  { type: "me", text: "Doar dacă am media peste 9. Nu e sigur." },
  { type: "coach", text: "Atunci fac planul fără ea și o adaug doar după ce intră. Banii de la familie și meditațiile acoperă necesarele, de circa 1.200 lei pe lună." },
  {
    type: "proposal",
    title: "Regulă nouă: 10% deoparte",
    lines: ["La fiecare încasare de peste 100 lei îți propun să muți 10% în fondul de siguranță.", "Muți banii doar după ce confirmi.", "Ținta: 1.200 lei, adică o lună de necesare."],
    done: "Aprobat pe 28 octombrie",
  },
  { type: "me", text: "Pot să economisesc și automat, din sume mici?" },
  {
    type: "coach",
    text: "Da. Banca are un serviciu care pune deoparte un procent din fiecare plată cu cardul. Cât timp banii nu îți ajung până la 1, ți-l propun la 1%.",
  },
  { type: "service", id: "savingbox" },
  { type: "divider", text: "Azi" },
  { type: "me", text: "Mai pot comanda mâncare diseară?" },
  {
    type: "coach",
    text: "La Livrări de mâncare mai ai 34 lei din 120. O comandă obișnuită, de circa 40 lei, trece puțin peste limită. Decizia e a ta.",
  },
];

// src: "obs" (observat), "said" (spus), "agreed" (stabilit), "est" (estimat).
export const profile = {
  statements: [{ icon: "card", name: "Cont curent RON", note: "nov. 2025 – oct. 2026, importat din aplicație · se actualizează lunar", status: "Importat" }],
  about: [
    { label: "Prenume", value: "Matei", src: "obs" },
    { label: "Vârstă", value: "18–24 ani", src: "obs" },
    { label: "Ocupație", value: "Student, anul II", src: "said" },
    { label: "Locuință", value: "Cămin studențesc", src: "obs" },
    { label: "Istoric analizat", value: "12 luni, nov. 2025 – oct. 2026", src: "obs" },
  ],
  money: [
    { label: "Bani de la familie", value: "1.200 lei, pe 1 ale lunii", src: "obs" },
    { label: "Bursă", value: "circa 700 lei în lunile de cursuri, doar cu media peste 9", src: "said" },
    { label: "Meditații", value: "150–450 lei pe lună", src: "said" },
    { label: "Minimul lunar", value: "1.200 lei: cămin, alimente, transport, telefon, studii", src: "est" },
    { label: "Perioada de buget", value: "Din 1 până la sfârșitul lunii, după banii de la familie", src: "agreed" },
    { label: "Regula de economisire", value: "10% din fiecare încasare de peste 100 lei", src: "agreed" },
  ],
  income: 1500,
  spending: [
    { name: "Alimente", lei: 720 },
    { name: "Cămin", lei: 350 },
    { name: "Livrări de mâncare", lei: 210 },
    { name: "Restaurante", lei: 190 },
    { name: "Cafenele", lei: 90 },
    { name: "Taxi", lei: 70 },
    { name: "Abonamente", lei: 60 },
    { name: "Studii", lei: 60 },
    { name: "Transport", lei: 50 },
    { name: "Telefon și internet", lei: 25 },
  ],
  observed: [
    { text: "În iulie, august și septembrie, fără bursă, banii s-au terminat cu 5–8 zile înainte de 1", src: "obs" },
    { text: "Bursa a intrat în martie–iunie și în octombrie, în jur de 15 ale lunii", src: "obs" },
    { text: "Meditații: 2–3 plăți pe lună, de la aceleași persoane", quote: "dau meditații la matematică", src: "said" },
  ],
  subscriptions: [
    { name: "LinguaPlus", lei: 45, note: "Aplicația deschisă de 2 ori în octombrie · 135 lei plătiți din septembrie", status: "O păstrezi până la examenul din ianuarie" },
    { name: "MuzicaPlus Student", lei: 15 },
  ],
  talk: [
    { label: "Ton", value: "Prietenos, fără predici" },
    { label: "Notificări", value: "Cel mult una pe zi" },
    { label: "Fără notificări", value: "23:00 – 09:00" },
    { label: "Rezumat săptămânal", value: "Duminică, la 20:00" },
  ],
  permissions: [
    { id: "tx", label: "Extrase de cont", hint: "Contul curent · 12 luni", on: true },
    { id: "live", label: "Plăți cu cardul, în timp real", hint: "Pentru mesajele despre bugete", on: true },
    { id: "screen", label: "Screen Time", hint: "Doar aplicația LinguaPlus", on: true },
    { id: "calendar", label: "Google Calendar", hint: "Doar zilele de naștere și termenele marcate de tine", on: true },
    { id: "contacts", label: "Contacte", hint: "Nu e folosit", on: false },
    { id: "health", label: "Health", hint: "Nu e folosit", on: false },
  ],
  unknown: ["Cât costă anul următor", "Planuri pentru vară", "Datorii la prieteni"],
};

// Service cards (components/services.jsx): facts from data/bank.js plus why each one appears for Matei.
// No credit for this profile: no overdraft, credit card or instalments (design/coach-students.md §7).
export const services = {
  on: true,
  hint: "Cel mult una pe săptămână, doar pentru nevoi pe care le-ai spus sau confirmat. Fără credite.",
  items: [
    {
      ...bankServices.savingbox,
      id: "savingbox",
      state: "proposed",
      status: "Propunere",
      helps:
        "La 1%, din circa 1.500 lei plătiți lunar cu cardul, pui deoparte automat circa 15 lei pe lună. Până pe 30 noiembrie înseamnă circa 6 lei, deci nu simți diferența.",
      why: "Pe 28 octombrie ai întrebat cum poți economisi automat, din sume mici. Îți propun 1% cât timp banii nu îți ajung până la 1.",
      without: "Fără serviciu rămâne regula ta de 10% la fiecare încasare, pe care o confirmi de fiecare dată.",
      actions: ["Setez în aplicație", "Nu acum", "Nu-mi mai propune"],
    },
    {
      ...bankServices.savings,
      id: "savings",
      state: "active",
      status: "Activ",
      helps: "Aici stă fondul de siguranță: 650 din 1.200 lei. Banii sunt separați de cei de cheltuit, dar îi ai la îndemână dacă apare o urgență.",
      why: "Pe 28 octombrie ai spus că vrei un fond pentru situații neprevăzute.",
      without: "Fără cont de economii, fondul ar sta în contul curent, amestecat cu banii de cheltuit.",
    },
    {
      ...bankServices.zeroSimplu,
      id: "zero-simplu",
      state: "active",
      status: "Pachetul tău",
      helps: "Între 18 și 24 de ani nu plătești nimic lunar pentru cont și card, fără condiții. Banii de la familie și din meditații rămân întregi pentru tine.",
      whyLabel: "De ce îți arăt asta",
      why: "Îl ai deja. Îți arăt ce include, ca să nu plătești pentru ceva ce primești gratuit.",
    },
  ],
};

// ---------- spending tracker (shapes as in tracking.js) ----------

export const pickerCategories = ["alimente", "cafenele", "livrari", "iesiri", "taxi", "cumparaturi", "abonamente", "studii", "transport", "telefon", "locuinta"];

export const spending = {
  period: "1 – 12 noiembrie",
  title: "Cheltuieli variabile din 1 noiembrie",
  total: 611,
  fixed: 460,
  fixedNote: "căminul, transportul și abonamentele",
  compare: "Cu 85 lei mai mult față de aceeași perioadă din octombrie",
  parts: [
    { id: "alimente", lei: 297 },
    { id: "cafenele", lei: 40 },
    { id: "livrari", lei: 86 },
    { id: "iesiri", lei: 120 },
    { id: "taxi", lei: 40 },
    { id: "nesortat", lei: 28 },
  ],
};

export const review = { id: "m13", title: "1 plată de verificat", text: "PLAYNET*STORE · 28 lei · sâmbătă, 7 nov." };

const CANTINA = { merchant: "Cantina Studențească", raw: "CANTINA STUDENTEASCA 2 CLUJ-NAPOCA", name: "Prânz la cantină", category: "alimente", lei: -18, renamed: true, rule: true, status: "Finalizată", history: "Ultimele 3 luni: 41 de plăți, 738 lei" };
const COFFEE = { merchant: "Cafeteria Campus", raw: "CAFETERIA CAMPUS SRL CLUJ-NAPOCA", name: "Cafea", category: "cafenele", lei: -8, renamed: true, rule: true, tags: ["facultate"], status: "Finalizată", history: "Ultimele 3 luni: 24 de plăți, 192 lei" };
const MARKET = { merchant: "Market Express", raw: "MARKET EXPRESS 0217 CLUJ-NAPOCA", name: "Market Express", category: "alimente", status: "Finalizată" };
const FUND = { merchant: "Către Super Acces Plus", raw: "TRANSFER CONT PROPRIU · FOND SIGURANTA", name: "Fond de siguranță", category: "economii", renamed: true, status: "Finalizată" };
const TUTORING = { merchant: "Transfer de la o persoană", raw: "TRANSFER PRIMIT · MEDITATII", name: "Meditații", category: "venit", lei: 150, renamed: true, status: "Finalizată" };

// Each day lists its payments newest first; `total` is that day's spending without savings and income.
export const days = [
  {
    label: "Azi",
    date: "joi, 12 nov.",
    total: 8,
    items: [{ ...COFFEE, id: "m1", time: "08:45", note: "Înainte de cursul de la 9", status: "În așteptare" }],
  },
  {
    label: "Ieri",
    date: "miercuri, 11 nov.",
    total: 42,
    items: [
      { id: "m2", time: "22:40", merchant: "TaxiGo", raw: "TAXIGO RIDE CLUJ-NAPOCA", name: "TaxiGo", category: "taxi", lei: -16, status: "Finalizată" },
      { ...FUND, id: "m3", time: "19:32", lei: -15 },
      { ...TUTORING, id: "m4", time: "19:30" },
      { ...CANTINA, id: "m5", time: "13:00" },
      { ...COFFEE, id: "m6", time: "08:40" },
    ],
  },
  {
    label: "Marți",
    date: "10 nov.",
    total: 107,
    items: [
      { id: "m7", time: "21:30", merchant: "Pizzeria Napoca", raw: "PIZZERIA NAPOCA SRL CLUJ-NAPOCA", name: "Pizza cu colegii", category: "iesiri", lei: -52, renamed: true, tags: ["prieteni"], status: "Finalizată" },
      { ...MARKET, id: "m8", time: "19:15", lei: -37 },
      { ...CANTINA, id: "m9", time: "13:00" },
    ],
  },
  {
    label: "Luni",
    date: "9 nov.",
    total: 26,
    items: [
      { ...CANTINA, id: "m10", time: "13:05" },
      { ...COFFEE, id: "m11", time: "08:30" },
    ],
  },
  {
    label: "Duminică",
    date: "8 nov.",
    total: 41,
    items: [{ id: "m12", time: "20:40", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 90544", name: "LivrareRapidă", category: "livrari", lei: -41, status: "Finalizată" }],
  },
  {
    label: "Sâmbătă",
    date: "7 nov.",
    total: 80,
    items: [
      { id: "m13", time: "16:20", merchant: "PLAYNET*STORE", raw: "PLAYNET*STORE 7781 ONLINE", name: "", category: "nesortat", lei: -28, needsReview: true, suggestion: "cumparaturi", status: "Finalizată" },
      { ...MARKET, id: "m14", time: "12:00", lei: -52 },
    ],
  },
  {
    label: "Vineri",
    date: "6 nov.",
    total: 110,
    items: [
      { id: "m15", time: "23:50", merchant: "TaxiGo", raw: "TAXIGO RIDE CLUJ-NAPOCA", name: "TaxiGo", category: "taxi", lei: -24, status: "Finalizată" },
      { id: "m16", time: "22:00", merchant: "Studio Pub", raw: "STUDIO PUB SRL CLUJ-NAPOCA", name: "Ieșire cu prietenii", category: "iesiri", lei: -68, renamed: true, tags: ["prieteni"], status: "Finalizată" },
      { ...CANTINA, id: "m17", time: "13:00" },
    ],
  },
  {
    label: "Joi",
    date: "5 nov.",
    total: 26,
    items: [
      { ...CANTINA, id: "m18", time: "13:00" },
      { ...COFFEE, id: "m19", time: "08:35" },
    ],
  },
  {
    label: "Miercuri",
    date: "4 nov.",
    total: 63,
    items: [
      { id: "m20", time: "21:10", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 89917", name: "LivrareRapidă", category: "livrari", lei: -45, status: "Finalizată" },
      { ...FUND, id: "m21", time: "19:02", lei: -15 },
      { ...TUTORING, id: "m22", time: "19:00" },
      { ...CANTINA, id: "m23", time: "13:00" },
    ],
  },
  {
    label: "Marți",
    date: "3 nov.",
    total: 86,
    items: [
      { ...CANTINA, id: "m24", time: "13:05" },
      { ...COFFEE, id: "m25", time: "08:40" },
      { id: "m26", time: "06:00", merchant: "LinguaPlus", raw: "LINGUAPLUS.COM SUBSCRIPTION", name: "LinguaPlus", category: "abonamente", lei: -45, recurring: true, status: "Finalizată" },
      { id: "m27", time: "06:00", merchant: "MuzicaPlus", raw: "MUZICAPLUS STUDENT", name: "MuzicaPlus Student", category: "abonamente", lei: -15, recurring: true, status: "Finalizată" },
    ],
  },
  {
    label: "Luni",
    date: "2 nov.",
    total: 418,
    items: [
      { ...CANTINA, id: "m28", time: "13:10" },
      { id: "m29", time: "09:20", merchant: "TransUrban", raw: "TRANSURBAN ABONAMENT STUDENT", name: "Abonament transport", category: "transport", lei: -50, recurring: true, renamed: true, status: "Finalizată" },
      { id: "m30", time: "09:00", merchant: "Cămin studențesc", raw: "CAMIN STUDENTESC C4 · TAXA NOIEMBRIE", name: "Cămin", category: "locuinta", lei: -350, recurring: true, renamed: true, status: "Finalizată" },
    ],
  },
  {
    label: "Duminică",
    date: "1 nov.",
    total: 64,
    items: [
      { ...MARKET, id: "m31", time: "18:30", lei: -64 },
      { ...FUND, id: "m32", time: "10:05", lei: -120 },
      { id: "m33", time: "10:02", merchant: "Transfer de la o persoană", raw: "TRANSFER PRIMIT · BANI NOIEMBRIE", name: "Bani de la familie", category: "venit", lei: 1200, recurring: true, renamed: true, status: "Finalizată" },
    ],
  },
];

export const tagSuggestions = ["facultate", "prieteni", "weekend", "cămin"];

// What the coach adds under the category picker, per category.
export const categoryNotes = {
  alimente: "Necesar: intră în minimul lunar, înaintea cheltuielilor opționale.",
  cafenele: "Opțional: intră la bugetul Cafenele, 60 lei pe lună.",
  nesortat: "Nu recunosc comerciantul. Pare o plată online: alege categoria, ca plata să fie inclusă în bugetul potrivit.",
  locuinta: "Necesar: căminul, plătit o dată pe lună.",
  transport: "Necesar: abonamentul de student.",
  abonamente: "Opțional: se plătește lunar.",
  economii: "Economii: nu se adună la cheltuieli.",
  venit: "Încasare: nu se adună la cheltuieli.",
};

// ---------- activation (shapes as in activation.js) ----------

export const statements = {
  ...dariaStatements,
  account: { name: "Cont curent RON", iban: "RO45 RZBR •••• 5678" },
  imported: { title: "12 extrase lunare importate", meta: "nov. 2025 – oct. 2026 · 1.104 plăți · se actualizează lunar" },
  files: [],
};

export const calendar = {
  ...dariaCalendar,
  found: [
    { day: "dec.", month: "2026", title: "3 zile de naștere", note: "Din contactele tale Google" },
    { day: "18", month: "ian.", title: "Sesiunea de iarnă", note: "Eveniment marcat de tine" },
    { day: "20", month: "feb.", title: "Termen pentru dosarul de bursă", note: "Eveniment marcat de tine" },
  ],
  gift: {
    question: "Cât vrei să dai de obicei pe un cadou?",
    groups: [
      { label: "Pentru prieteni", options: ["30 lei", "50 lei", "100 lei", "Altă sumă"], selected: "50 lei" },
      { label: "Pentru familie", options: ["50 lei", "100 lei", "150 lei", "Altă sumă"], selected: "50 lei" },
    ],
    result: "Pentru cele 3 zile de naștere din decembrie: aproximativ 150 lei.",
  },
};

export const apps = {
  ...dariaApps,
  found: "Am găsit 2 abonamente în extrase.",
  items: [
    { name: "LinguaPlus", lei: 45, note: "Plătit lunar din septembrie", on: true },
    { name: "MuzicaPlus Student", lei: 15, note: "Plătit lunar", on: false },
  ],
};

// The six questions of the first conversation for a student (design/coach-students.md §8).
export const questions = [
  {
    id: "venituri",
    title: "Din ce surse primești bani?",
    hint: "Poți alege mai multe. Așa știu pe ce bani te poți baza.",
    options: [
      { label: "Bani de la familie", selected: true },
      { label: "Bursă", selected: true },
      { label: "Meditații sau proiecte", selected: true },
      { label: "Job part-time" },
      { label: "Job de vară", selected: true },
      { label: "Altceva" },
    ],
    fields: [
      { label: "Bani de la familie pe lună", value: "1200", suffix: "lei", numeric: true },
      { label: "Bursa e sigură?", type: "select", value: "Nu, depinde de medie", options: ["Da", "Nu, depinde de medie", "Nu primesc bursă"] },
      { label: "Meditații pe lună, aproximativ", value: "300", suffix: "lei", numeric: true },
      { label: "Rămas din jobul de vară", value: "500", suffix: "lei", numeric: true },
    ],
  },
  {
    id: "necesare",
    title: "Ce cheltuieli trebuie acoperite în fiecare lună?",
    hint: "Din ele calculez minimul lunar. Restul sunt cheltuieli opționale.",
    options: [
      { label: "Cămin sau chirie", selected: true },
      { label: "Alimente", selected: true },
      { label: "Transport", selected: true },
      { label: "Telefon și internet", selected: true },
      { label: "Taxe și materiale de studiu", selected: true },
      { label: "Sănătate" },
    ],
    fields: [{ label: "Cămin pe lună", value: "350", suffix: "lei", numeric: true }],
  },
  {
    id: "obiective",
    title: "Pentru ce ai vrea să economisești?",
    hint: "Poți alege mai multe.",
    options: [
      { label: "Un fond de siguranță", selected: true },
      { label: "Un curs", selected: true },
      { label: "Echipament pentru facultate" },
      { label: "Erasmus sau o călătorie" },
      { label: "Nimic anume acum" },
    ],
    fields: [
      { label: "Ce curs?", value: "UX design" },
      { label: "Cât costă?", value: "900", suffix: "lei", numeric: true },
      { label: "Când începe?", type: "select", value: "Martie 2027", options: ["Ianuarie 2027", "Martie 2027", "Octombrie 2027", "Nu știu încă"] },
    ],
  },
  {
    id: "idei",
    title: "Te interesează idei de dezvoltare?",
    hint: "Cel mult una pe săptămână. Le poți opri oricând din Profil.",
    options: [
      { label: "Venituri suplimentare", selected: true },
      { label: "Cursuri și educație financiară", selected: true },
      { label: "Burse și oportunități", selected: true },
      { label: "Nu acum" },
    ],
    fields: [{ label: "Ce ai putea face contra cost?", type: "textarea", value: "Meditații la matematică, marțea și joia după-amiaza." }],
  },
  {
    id: "notificari",
    title: "Cât de des vrei să-ți scriu și când să nu te deranjez?",
    options: [{ label: "Doar când e important" }, { label: "Cel mult o dată pe zi", selected: true }, { label: "Doar rezumatul săptămânal" }],
    fields: [
      { label: "Fără notificări de la", value: "23:00" },
      { label: "până la", value: "09:00" },
      { label: "Rezumatul săptămânal", type: "select", value: "Duminică, la 20:00", options: ["Duminică, la 20:00", "Luni, la 08:00", "Vineri, la 18:00", "Fără rezumat"] },
    ],
  },
  dariaQuestions.find((question) => question.id === "servicii"),
];

export const analysis = {
  title: "Analizez ultimele 12 luni",
  lead: "12 luni importate din contul curent. Durează circa un minut.",
  items: [
    { label: "Venituri și cât de sigure sunt", state: "done", note: "Bani de la familie pe 1, în 12 din 12 luni" },
    { label: "Plăți recurente și abonamente", state: "done", note: "4 plăți recurente, dintre care 2 abonamente" },
    { label: "Categorii pentru 1.104 plăți", state: "running", note: "773 din 1.104", progress: 70 },
    { label: "Necesare și opționale", state: "waiting", note: "Urmează" },
  ],
  note: "Poți închide aplicația. Îți scriu când e gata.",
};

export const findings = {
  lead: "Din 12 luni de extrase, din calendar și din răspunsurile tale.",
  items: [
    { text: "În iulie, august și septembrie, fără bursă, banii s-au terminat cu 5–8 zile înainte de 1.", src: "obs" },
    { text: "Necesarele tale costă circa 1.200 lei pe lună, cât primești de la familie.", src: "est" },
    { text: "LinguaPlus: 45 lei pe lună, iar aplicația a fost deschisă de 2 ori în octombrie.", note: "Te întreb despre asta în discuție.", src: "obs" },
    { text: "Pe 20 februarie ai termenul pentru dosarul de bursă.", src: "obs", label: "din calendar" },
  ],
  firstStep: {
    icon: "wallet",
    title: "Primul pas pe care ți-l propun",
    text: "La fiecare încasare de peste 100 lei, pune 10% în fondul de siguranță. Pe 1 noiembrie, din cei 1.200 lei de la familie, înseamnă 120 lei.",
    action: "Vezi propunerea",
    href: "#/chat",
  },
};
