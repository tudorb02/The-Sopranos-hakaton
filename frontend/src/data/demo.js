// Fictional demo data for Daria, an employee paid on the 5th. The person, merchants and amounts are invented.
// The screens read everything from here, so this file can later be replaced by API calls.
// State shown: Thursday 12 November 2026, day 8 of the pay cycle 5 Nov – 4 Dec.

import { bankServices } from "./bank.js";

export const today = { label: "Joi, 12 noiembrie" };

export const client = { firstName: "Daria", name: "Daria Ionescu", initial: "D", segment: "persoană fizică", card: "Card Visa •••• 1234" };

// The budget period follows the client's profile: the day before the salary for an employee
// (Daria: paid on the 5th), the day before the pension for a pensioner, or a date the client
// picks when income is irregular. The screens only show `endsOn` and `basis`.
export const cycle = {
  label: "5 nov. – 4 dec.",
  endsOn: "4 decembrie",
  basis: "Salariul intră pe 5 decembrie.",
  total: 6200,
  totalNote: "Din salariul de 6.200 lei, intrat pe 5 noiembrie.",
  fixed: 3020,
  setAside: 1200,
  spendable: 1980,
  spent: 739,
  left: 1241,
  perDay: 54,
  daysLeftLabel: "23 de zile",
};

export const allocation = [
  { id: "fixed", label: "Cheltuieli fixe", lei: 3020, tone: "fixed" },
  { id: "aside", label: "Deoparte pentru cadouri", lei: 1200, tone: "aside" },
  { id: "spend", label: "Disponibil pentru cheltuieli", lei: 1980, tone: "spend" },
];

export const week = {
  spent: 194,
  daysSoFar: 4,
  guidePerDay: 54,
  scaleMax: 90,
  days: [
    { d: "L", name: "luni", lei: 62 },
    { d: "Ma", name: "marți", lei: 48 },
    { d: "Mi", name: "miercuri", lei: 54 },
    { d: "J", name: "joi", lei: 30, today: true },
    { d: "V", name: "vineri" },
    { d: "S", name: "sâmbătă" },
    { d: "D", name: "duminică" },
  ],
};

export const lastMessage = {
  icon: "cup",
  meta: "Azi, 08:12 · Cafenele",
  title: "A treia cafea din această săptămână",
  text: "Până luni, cafeaua o faci acasă. Față de o săptămână obișnuită, economisești aproximativ 50 lei.",
};

export const insight = {
  figure: "28%",
  text: "din bugetul perioadei l-ai cheltuit în primele 4 zile după salariu. În octombrie, procentul a fost de 41%.",
};

// Budgets are listed by group (see budgetGroups); Daria has one group, so no budget names one.
export const budgetGroups = [{ title: "Pe categorii", src: "agreed", note: "stabilite de tine" }];

// kind: "count" (number of payments), "amount" (lei), "paid" (a fixed cost already paid),
// "pause" or "protected" (no limit, client's choice).
export const budgets = [
  { id: "cafenele", name: "Cafenele", icon: "cup", kind: "count", used: 3, max: 3, note: "3 din 3 săptămâna aceasta · următoarea, de luni", onHome: true },
  { id: "cadouri", name: "Cadouri", icon: "gift", kind: "amount", spent: 380, limit: 1200, note: "3 din 10 ocazii, din banii puși deoparte", onHome: true },
  { id: "iesiri", name: "Restaurante", icon: "utensils", kind: "amount", spent: 120, limit: 200, warn: true, note: "60% din buget, în primele 8 zile ale perioadei", onHome: true },
  { id: "haine", name: "Haine", icon: "shirt", kind: "pause", note: "Pauză până în ianuarie, cum am stabilit" },
  { id: "livrari", name: "Livrări de mâncare", icon: "bag", kind: "protected", spent: 150, note: "Fără limită, cum ai cerut" },
];

export const unbudgeted = {
  total: 314,
  items: [
    { name: "Alimente", icon: "cart", lei: 154, note: "Plus tichetele de masă" },
    { name: "Taxi", icon: "car", lei: 40 },
    { name: "Fără categorie", icon: "help", lei: 120, note: "O plată de clarificat" },
  ],
};

export const question = {
  amount: 120,
  merchant: "ONLINE*ABC SRL",
  date: "6 noiembrie",
  options: ["Cumpărături online", "Cadou", "Altceva"],
  txId: "t14",
};

export const agenda = [
  { day: "14", month: "nov.", title: "2 zile de naștere", note: "200 lei din bugetul de cadouri" },
  { day: "30", month: "nov.", title: "Sf. Andrei", note: "Doar urări, cum ai stabilit" },
  { day: "5", month: "dec.", title: "Salariu", note: "1.200 lei deoparte pentru Crăciun" },
];

export const goal = {
  name: "Laptop",
  icon: "target",
  note: "Din economii, fără rate",
  saved: 0,
  amount: 2000,
  due: { label: "Obiectiv atins pe", date: "5 martie 2027", note: "prima depunere pe 5 ianuarie" },
  plan: [
    { month: "nov.", add: 0, total: 0 },
    { month: "dec.", add: 0, total: 0 },
    { month: "ian.", add: 700, total: 700 },
    { month: "feb.", add: 700, total: 1400 },
    { month: "mar.", add: 600, total: 2000 },
  ],
  reason: "Noiembrie și decembrie au cadouri și Crăciunul, așa că începem din ianuarie.",
  fundingLabel: "estimat, ian.–mar.",
  funding: [
    { name: "Fără abonamentul FitZone", lei: 220 },
    { name: "Cafenele: 3 pe săptămână", lei: 210 },
    { name: "Mai puține cadouri în ian.–mar.", lei: 200 },
    { name: "Mai puține restaurante și haine", lei: 130 },
  ],
  storage: "fixpay",
};

export const pots = [
  { name: "Cadouri, noiembrie", icon: "gift", lei: 820, note: "Rămași din 1.200 lei, pentru 7 ocazii" },
  { name: "Crăciun", icon: "wallet", lei: 1200, note: "Se pun deoparte pe 5 decembrie, după salariu" },
];

export const nextGoals = [];

// A topic not discussed yet, offered as an empty state on Obiective.
export const reserve = {
  title: "Fond pentru urgențe",
  text: "Nu am vorbit încă despre asta. Un fond pentru urgențe te ajută când apare o cheltuială neprevăzută.",
  action: "Hai să vorbim",
  href: "#/chat",
};

// type: "divider", "coach", "me", "proposal" or "service" (a card from `services`, by id).
export const chat = [
  { type: "divider", text: "28 octombrie" },
  {
    type: "coach",
    text: "Văd o plată de aproximativ 30 lei aproape în fiecare dimineață la Boabe & Co, între 8:00 și 9:30. În ultimele 3 luni: 4–5 pe săptămână, aproximativ 600 lei pe lună. Ce cumperi de obicei?",
  },
  { type: "me", text: "Cafea și covrig în drum spre birou." },
  { type: "coach", text: "Mulțumesc. Cât de des ți-ar plăcea s-o iei, ca să te bucuri de ea fără să te încurce la final de lună?" },
  { type: "me", text: "De 3 ori pe săptămână." },
  {
    type: "proposal",
    title: "Buget nou: Cafenele",
    lines: ["Cel mult 3 pe săptămână, la orice cafenea.", "Îți scriu la a treia.", "Economisești aproximativ 210 lei pe lună."],
    done: "Aprobat pe 28 octombrie",
  },
  { type: "coach", text: "Încă ceva: plătești 220 lei pe lună la FitZone, dar aplicația sălii n-a mai fost deschisă din aprilie. Mai mergi?" },
  { type: "me", text: "Nu. Vreau să renunț." },
  {
    type: "coach",
    text: "Atunci pașii sunt:",
    steps: [
      "Ceri anularea la sală. Contractul poate avea o perioadă de preaviz.",
      "După confirmare, blochezi plata din „Administrează plățile recurente”. Blocarea singură nu anulează contractul.",
    ],
    after: "O intrare costă 40 lei, deci abonamentul merită doar dacă mergi de cel puțin 6 ori pe lună.",
  },
  { type: "service", id: "recurring-payments" },
  {
    type: "proposal",
    title: "Memento: cererea la FitZone",
    lines: ["Îți amintesc vineri, la 10:00, să trimiți cererea de anulare."],
    actions: ["Da, amintește-mi", "Nu acum"],
  },
  { type: "divider", text: "Azi" },
  { type: "me", text: "Mai pot lua o cafea azi după-amiază?" },
  {
    type: "coach",
    text: "Ai ajuns la 3 din 3 săptămâna aceasta. Decizia e a ta: a patra cafea ar ieși din cei aproximativ 54 lei pe zi pe care îi mai ai până pe 4 decembrie.",
  },
];

// src: "obs" (observat), "said" (spus), "agreed" (stabilit), "est" (estimat).
export const profile = {
  statements: [
    { icon: "card", name: "Cont curent RON", note: "nov. 2025 – oct. 2026, importat din aplicație · se actualizează lunar", status: "Importat" },
    { icon: "file", name: "Extrase atașate", note: "2 fișiere: nov. 2024 – oct. 2025 și o altă bancă", status: "Procesate" },
  ],
  about: [
    { label: "Prenume", value: "Daria", src: "obs" },
    { label: "Vârstă", value: "25–34 ani", src: "obs" },
    { label: "Gospodărie", value: "1 persoană", src: "said" },
    { label: "Venit", value: "Salariu, pe 5 ale lunii", src: "obs" },
    { label: "Istoric analizat", value: "24 de luni, nov. 2024 – oct. 2026", src: "obs" },
  ],
  money: [
    { label: "Salariu net", value: "circa 6.200 lei", src: "obs" },
    { label: "Tichete de masă", value: "circa 800 lei pe lună", src: "said" },
    { label: "Cheltuieli fixe", value: "3.020 lei pe lună", src: "obs" },
    { label: "Perioada de buget", value: "Din 5 până în 4 ale lunii următoare, după data salariului", src: "obs" },
    { label: "Buget săptămânal în noiembrie", value: "circa 460 lei", src: "est" },
  ],
  income: 6200,
  spending: [
    { name: "Chirie", lei: 2400 },
    { name: "Alimente", lei: 650, note: "plus tichetele" },
    { name: "Cafenele", lei: 600 },
    { name: "Utilități", lei: 460 },
    { name: "Livrări de mâncare", lei: 450 },
    { name: "Restaurante", lei: 350 },
    { name: "Cadouri", lei: 300 },
    { name: "Haine", lei: 280 },
    { name: "Transport", lei: 230 },
    { name: "Altele", lei: 180 },
  ],
  observed: [
    { text: "Sub 100 lei în cont între 27 și 5 ale lunii, în 5 din ultimele 6 luni", src: "obs" },
    { text: "55% din cheltuieli în primele 10 zile după salariu", src: "obs" },
    { text: "Boabe & Co, circa 30 lei, 4–5 dimineți pe săptămână", quote: "cafea și covrig în drum spre birou", src: "said" },
  ],
  subscriptions: [
    { name: "FitZone Gym", lei: 220, note: "Aplicația sălii nedeschisă din aprilie · 1.320 lei plătiți de atunci", status: "Anulezi la sală, apoi blochezi plata" },
    { name: "StreamFlix", lei: 55 },
    { name: "MuzicaPlus", lei: 25 },
  ],
  talk: [
    { label: "Ton", value: "Direct, cu puțin umor" },
    { label: "Notificări", value: "Cel mult una pe zi" },
    { label: "Fără notificări", value: "22:00 – 08:00" },
    { label: "Rezumat săptămânal", value: "Duminică, la 19:00" },
  ],
  permissions: [
    { id: "tx", label: "Extrase de cont", hint: "Contul curent și 2 extrase atașate · 24 de luni", on: true },
    { id: "live", label: "Plăți cu cardul, în timp real", hint: "Pentru mesajele despre bugete", on: true },
    { id: "screen", label: "Screen Time", hint: "Doar aplicația FitZone", on: true },
    { id: "calendar", label: "Google Calendar", hint: "Doar zilele de naștere și evenimentele marcate", on: true },
    { id: "contacts", label: "Contacte", hint: "Doar prenume, procesate pe telefon", on: true },
    { id: "health", label: "Health", hint: "Nu e folosit", on: false },
  ],
  unknown: ["Fond pentru urgențe", "Bonus de sărbători", "Datorii la prieteni sau familie"],
};

// Service cards (components/services.jsx): facts from data/bank.js plus why each one appears for Daria.
// state: "active", "proposed", "later" or "howto" (a feature she already has).
export const services = {
  on: true,
  hint: "Cel mult una pe săptămână, doar pentru nevoi pe care le-ai spus sau confirmat",
  items: [
    {
      ...bankServices.fixpay,
      id: "fixpay",
      state: "active",
      status: "Activ",
      helps:
        "Pe 5, după salariu, banii pentru cadouri pleacă singuri în contul de economii, iar din ianuarie și cei pentru laptop: 700 lei pe 5 ianuarie și pe 5 februarie, apoi 600 lei pe 5 martie. Vezi de la început cât îți rămâne de cheltuit.",
      why: "Pe 28 octombrie ai spus că vrei să pui bani deoparte la început de lună.",
      without: "Fără FixPay, muți tu banii pe 5, din aplicație.",
    },
    {
      ...bankServices.recurringPayments,
      id: "recurring-payments",
      state: "howto",
      status: "După anulare",
      helps: "După ce ceri anularea la FitZone, blochezi plata de 220 lei pe lună, ca să nu mai fie retrasă de pe card.",
      whyLabel: "De ce îți arăt asta",
      why: "Pe 28 octombrie ai spus că nu mai mergi la sală și vrei să renunți la abonament.",
      without: "Cererea de anulare la sală rămâne necesară: contractul poate avea o perioadă de preaviz.",
      actions: ["Arată-mi pașii"],
    },
    {
      ...bankServices.savingbox,
      id: "savingbox",
      state: "later",
      status: "Mai târziu",
      helps:
        "Te-ar ajuta să economisești fără să te gândești, dar acum ar lua bani la fiecare plată, exact când îți lipsesc la final de lună. Ți-l propun după 3 luni în care ajungi la salariu cu bani în cont.",
      whyLabel: "De ce mai târziu",
      why: "În 5 din ultimele 6 luni ai avut sub 100 lei în cont între 27 și 5 ale lunii.",
      without: "Până atunci, FixPay pune deoparte sumele stabilite, pe 5, după salariu.",
    },
  ],
};
