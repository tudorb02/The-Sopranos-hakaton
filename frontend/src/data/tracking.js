// Fictional transactions of the current pay cycle (5–12 November 2026), consistent with demo.js:
// variable spending 739 lei = Alimente 154 + Cafenele 155 + Livrări de mâncare 150 + Restaurante 120 + Taxi 40 + Fără categorie 120.
// Rent, subscriptions, the money set aside and the salary are listed but not counted as variable spending.

// tone: "cat-1"…"cat-5" are the validated chart colours (fixed per category, never by rank);
// "cat-none" is the neutral grey for uncategorised; "cat-fixed" and "cat-income" stay out of the chart.
export const categories = {
  alimente: { label: "Alimente", icon: "cart", tone: "cat-1" },
  cafenele: { label: "Cafenele", icon: "cup", tone: "cat-2" },
  livrari: { label: "Livrări de mâncare", icon: "bag", tone: "cat-3" },
  iesiri: { label: "Restaurante", icon: "utensils", tone: "cat-4" },
  taxi: { label: "Taxi", icon: "car", tone: "cat-5" },
  nesortat: { label: "Fără categorie", icon: "help", tone: "cat-none" },
  cumparaturi: { label: "Cumpărături", icon: "shirt", tone: "cat-fixed" },
  cadouri: { label: "Cadouri", icon: "gift", tone: "cat-fixed" },
  abonamente: { label: "Abonamente", icon: "repeat", tone: "cat-fixed" },
  locuinta: { label: "Locuință", icon: "home", tone: "cat-fixed" },
  economii: { label: "Economii", icon: "wallet", tone: "cat-fixed" },
  venit: { label: "Venit", icon: "arrow", tone: "cat-income" },
};

// The categories a payment can be moved to, in the picker.
export const pickerCategories = ["alimente", "cafenele", "livrari", "iesiri", "taxi", "cumparaturi", "cadouri", "abonamente", "locuinta"];

export const spending = {
  period: "5 – 12 noiembrie",
  total: 739,
  fixed: 2455,
  compare: "Cu 210 lei mai puțin față de aceeași perioadă din octombrie",
  parts: [
    { id: "alimente", lei: 154 },
    { id: "cafenele", lei: 155 },
    { id: "livrari", lei: 150 },
    { id: "iesiri", lei: 120 },
    { id: "taxi", lei: 40 },
    { id: "nesortat", lei: 120 },
  ],
};

export const filters = [{ label: "Toate", selected: true }, { label: "Cheltuieli" }, { label: "Încasări" }, { label: "Fără categorie · 1" }, { label: "Recurente" }];

export const review = { id: "t14", title: "1 plată de verificat", text: "ONLINE*ABC SRL · 120 lei · vineri, 6 nov." };

// Each day lists its payments newest first; `total` is that day's spending without savings and income.
export const days = [
  {
    label: "Azi",
    date: "joi, 12 nov.",
    total: 85,
    items: [
      { id: "t1", time: "08:12", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Cafea și covrig", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["birou"], note: "Cafeaua de dimineață, în drum spre birou", status: "În așteptare", history: "Ultimele 3 luni: 58 de plăți, 1.740 lei" },
      { id: "t2", time: "06:00", merchant: "StreamFlix", raw: "STREAMFLIX.COM SUBSCRIPTION", name: "StreamFlix", category: "abonamente", lei: -55, recurring: true, status: "Finalizată" },
    ],
  },
  {
    label: "Ieri",
    date: "miercuri, 11 nov.",
    total: 54,
    items: [
      { id: "t3", time: "22:10", merchant: "TaxiGo", raw: "TAXIGO RIDE BUCURESTI", name: "TaxiGo", category: "taxi", lei: -15, status: "Finalizată" },
      { id: "t4", time: "18:40", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -39, status: "Finalizată" },
    ],
  },
  {
    label: "Marți",
    date: "10 nov.",
    total: 48,
    items: [
      { id: "t5", time: "19:20", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -18, status: "Finalizată" },
      { id: "t6", time: "08:05", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Cafea și covrig", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["birou"], status: "Finalizată", history: "Ultimele 3 luni: 58 de plăți, 1.740 lei" },
    ],
  },
  {
    label: "Luni",
    date: "9 nov.",
    total: 62,
    items: [
      { id: "t7", time: "18:55", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -32, status: "Finalizată" },
      { id: "t8", time: "08:20", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Cafea și covrig", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["birou"], status: "Finalizată", history: "Ultimele 3 luni: 58 de plăți, 1.740 lei" },
    ],
  },
  {
    label: "Duminică",
    date: "8 nov.",
    total: 75,
    items: [
      { id: "t9", time: "20:30", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 88412", name: "Pizza de duminică", category: "livrari", lei: -75, renamed: true, status: "Finalizată" },
    ],
  },
  {
    label: "Sâmbătă",
    date: "7 nov.",
    total: 150,
    items: [
      { id: "t10", time: "23:50", merchant: "TaxiGo", raw: "TAXIGO RIDE BUCURESTI", name: "TaxiGo", category: "taxi", lei: -25, status: "Finalizată" },
      { id: "t11", time: "21:15", merchant: "Bistro Central", raw: "BISTRO CENTRAL SRL BUCURESTI", name: "Cină cu prietenii", category: "iesiri", lei: -120, renamed: true, tags: ["prieteni"], status: "Finalizată" },
      { id: "t12", time: "11:40", merchant: "Cafea Expres", raw: "CAFEAEXPRES SRL BUCURESTI RO", name: "Espresso", category: "cafenele", lei: -5, renamed: true, rule: true, note: "Un espresso la chioșcul de lângă metrou", status: "Finalizată", history: "Ultimele 3 luni: 6 plăți, 30 lei" },
    ],
  },
  {
    label: "Vineri",
    date: "6 nov.",
    total: 2625,
    items: [
      { id: "t13", time: "20:45", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 87990", name: "LivrareRapidă", category: "livrari", lei: -75, status: "Finalizată" },
      { id: "t14", time: "13:05", merchant: "ONLINE*ABC SRL", raw: "ONLINE*ABC SRL WWW.ABC.RO", name: "", category: "nesortat", lei: -120, needsReview: true, suggestion: "cumparaturi", status: "Finalizată" },
      { id: "t15", time: "09:00", merchant: "Transfer către o persoană", raw: "TRANSFER SMART MOBILE · CHIRIE NOIEMBRIE", name: "Chirie", category: "locuinta", lei: -2400, recurring: true, renamed: true, status: "Finalizată" },
      { id: "t16", time: "08:10", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Cafea și covrig", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["birou"], status: "Finalizată", history: "Ultimele 3 luni: 58 de plăți, 1.740 lei" },
    ],
  },
  {
    label: "Joi",
    date: "5 nov.",
    total: 95,
    items: [
      { id: "t17", time: "18:30", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -65, status: "Finalizată" },
      { id: "t18", time: "10:30", merchant: "FixPay → Super Acces Plus", raw: "FIXPAY ECONOMII CADOURI", name: "Deoparte pentru cadouri", category: "economii", lei: -1200, recurring: true, renamed: true, status: "Finalizată" },
      { id: "t19", time: "08:15", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Cafea și covrig", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["birou"], status: "Finalizată", history: "Ultimele 3 luni: 58 de plăți, 1.740 lei" },
      { id: "t20", time: "07:02", merchant: "Nord Media SRL", raw: "SALARIU NOIEMBRIE NORD MEDIA SRL", name: "Salariu", category: "venit", lei: 6200, recurring: true, renamed: true, status: "Finalizată" },
    ],
  },
];

export const tagSuggestions = ["birou", "weekend", "prieteni", "familie"];

// What the coach adds under the category picker, per category.
export const categoryNotes = {
  cafenele: "Intră la bugetul Cafenele: cel mult 3 pe săptămână.",
  nesortat: "Nu recunosc comerciantul. Pare o cumpărătură online: alege categoria, ca plata să fie inclusă în bugetul potrivit.",
  locuinta: "Cheltuială fixă: nu se adună la cheltuielile variabile.",
  abonamente: "Cheltuială fixă: nu se adună la cheltuielile variabile.",
  economii: "Economii: nu se adună la cheltuieli.",
  venit: "Încasare: nu se adună la cheltuieli.",
};
