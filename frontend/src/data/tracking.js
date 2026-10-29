// Fictional transactions of the current pay cycle (5–12 November 2026), consistent with demo.js:
// variable spending 739 RON = Groceries 154 + Cafés 155 + Food delivery 150 + Restaurants 120 + Taxi 40 + Uncategorised 120.
// Rent, subscriptions, the money set aside and the salary are listed but not counted as variable spending.

// tone: "cat-1"…"cat-5" are the validated chart colours (fixed per category, never by rank);
// "cat-none" is the neutral grey for uncategorised; "cat-fixed" and "cat-income" stay out of the chart.
export const categories = {
  alimente: { label: "Groceries", icon: "cart", tone: "cat-1" },
  cafenele: { label: "Cafés", icon: "cup", tone: "cat-2" },
  livrari: { label: "Food delivery", icon: "bag", tone: "cat-3" },
  iesiri: { label: "Restaurants", icon: "utensils", tone: "cat-4" },
  taxi: { label: "Taxi", icon: "car", tone: "cat-5" },
  nesortat: { label: "Uncategorised", icon: "help", tone: "cat-none" },
  cumparaturi: { label: "Shopping", icon: "shirt", tone: "cat-fixed" },
  cadouri: { label: "Gifts", icon: "gift", tone: "cat-fixed" },
  abonamente: { label: "Subscriptions", icon: "repeat", tone: "cat-fixed" },
  locuinta: { label: "Housing", icon: "home", tone: "cat-fixed" },
  transport: { label: "Transport", icon: "bus", tone: "cat-fixed" },
  studii: { label: "Studies", icon: "book", tone: "cat-fixed" },
  telefon: { label: "Phone and internet", icon: "phone", tone: "cat-fixed" },
  economii: { label: "Savings", icon: "wallet", tone: "cat-fixed" },
  venit: { label: "Income", icon: "arrow", tone: "cat-income" },
};

// The categories a payment can be moved to, in the picker.
export const pickerCategories = ["alimente", "cafenele", "livrari", "iesiri", "taxi", "cumparaturi", "cadouri", "abonamente", "locuinta"];

export const spending = {
  period: "5 – 12 November",
  title: "Variable spending since 5 November",
  total: 739,
  fixed: 2455,
  fixedNote: "rent and subscriptions",
  compare: "210 RON less than the same period in October",
  parts: [
    { id: "alimente", lei: 154 },
    { id: "cafenele", lei: 155 },
    { id: "livrari", lei: 150 },
    { id: "iesiri", lei: 120 },
    { id: "taxi", lei: 40 },
    { id: "nesortat", lei: 120 },
  ],
};

export const filters = [{ label: "All", selected: true }, { label: "Spending" }, { label: "Income" }, { label: "Uncategorised · 1" }, { label: "Recurring" }];

export const review = { id: "t14", title: "1 payment to check", text: "ONLINE*ABC SRL · 120 RON · Fri, 6 Nov" };

// Each day lists its payments newest first; `total` is that day's spending without savings and income.
export const days = [
  {
    label: "Today",
    date: "Thu, 12 Nov",
    total: 85,
    items: [
      { id: "t1", time: "08:12", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Coffee and pretzel", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["office"], note: "Morning coffee on the way to the office", status: "Pending", history: "Last 3 months: 58 payments, 1,740 RON" },
      { id: "t2", time: "06:00", merchant: "StreamFlix", raw: "STREAMFLIX.COM SUBSCRIPTION", name: "StreamFlix", category: "abonamente", lei: -55, recurring: true, status: "Completed" },
    ],
  },
  {
    label: "Yesterday",
    date: "Wed, 11 Nov",
    total: 54,
    items: [
      { id: "t3", time: "22:10", merchant: "TaxiGo", raw: "TAXIGO RIDE BUCURESTI", name: "TaxiGo", category: "taxi", lei: -15, status: "Completed" },
      { id: "t4", time: "18:40", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -39, status: "Completed" },
    ],
  },
  {
    label: "Tuesday",
    date: "10 Nov",
    total: 48,
    items: [
      { id: "t5", time: "19:20", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -18, status: "Completed" },
      { id: "t6", time: "08:05", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Coffee and pretzel", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["office"], status: "Completed", history: "Last 3 months: 58 payments, 1,740 RON" },
    ],
  },
  {
    label: "Monday",
    date: "9 Nov",
    total: 62,
    items: [
      { id: "t7", time: "18:55", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -32, status: "Completed" },
      { id: "t8", time: "08:20", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Coffee and pretzel", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["office"], status: "Completed", history: "Last 3 months: 58 payments, 1,740 RON" },
    ],
  },
  {
    label: "Sunday",
    date: "8 Nov",
    total: 75,
    items: [
      { id: "t9", time: "20:30", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 88412", name: "Sunday pizza", category: "livrari", lei: -75, renamed: true, status: "Completed" },
    ],
  },
  {
    label: "Saturday",
    date: "7 Nov",
    total: 150,
    items: [
      { id: "t10", time: "23:50", merchant: "TaxiGo", raw: "TAXIGO RIDE BUCURESTI", name: "TaxiGo", category: "taxi", lei: -25, status: "Completed" },
      { id: "t11", time: "21:15", merchant: "Bistro Central", raw: "BISTRO CENTRAL SRL BUCURESTI", name: "Dinner with friends", category: "iesiri", lei: -120, renamed: true, tags: ["friends"], status: "Completed" },
      { id: "t12", time: "11:40", merchant: "Cafea Expres", raw: "CAFEAEXPRES SRL BUCURESTI RO", name: "Espresso", category: "cafenele", lei: -5, renamed: true, rule: true, note: "An espresso at the kiosk next to the metro", status: "Completed", history: "Last 3 months: 6 payments, 30 RON" },
    ],
  },
  {
    label: "Friday",
    date: "6 Nov",
    total: 2625,
    items: [
      { id: "t13", time: "20:45", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 87990", name: "LivrareRapidă", category: "livrari", lei: -75, status: "Completed" },
      { id: "t14", time: "13:05", merchant: "ONLINE*ABC SRL", raw: "ONLINE*ABC SRL WWW.ABC.RO", name: "", category: "nesortat", lei: -120, needsReview: true, suggestion: "cumparaturi", status: "Completed" },
      { id: "t15", time: "09:00", merchant: "Transfer to a person", raw: "TRANSFER SMART MOBILE · CHIRIE NOIEMBRIE", name: "Rent", category: "locuinta", lei: -2400, recurring: true, renamed: true, status: "Completed" },
      { id: "t16", time: "08:10", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Coffee and pretzel", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["office"], status: "Completed", history: "Last 3 months: 58 payments, 1,740 RON" },
    ],
  },
  {
    label: "Thursday",
    date: "5 Nov",
    total: 95,
    items: [
      { id: "t17", time: "18:30", merchant: "Market Express", raw: "MARKET EXPRESS 0142 BUCURESTI", name: "Market Express", category: "alimente", lei: -65, status: "Completed" },
      { id: "t18", time: "10:30", merchant: "FixPay → Super Acces Plus", raw: "FIXPAY ECONOMII CADOURI", name: "Set aside for gifts", category: "economii", lei: -1200, recurring: true, renamed: true, status: "Completed" },
      { id: "t19", time: "08:15", merchant: "Boabe & Co", raw: "BOABE&CO CAFENEA BUCURESTI RO", name: "Coffee and pretzel", category: "cafenele", lei: -30, renamed: true, rule: true, tags: ["office"], status: "Completed", history: "Last 3 months: 58 payments, 1,740 RON" },
      { id: "t20", time: "07:02", merchant: "Nord Media SRL", raw: "SALARIU NOIEMBRIE NORD MEDIA SRL", name: "Salary", category: "venit", lei: 6200, recurring: true, renamed: true, status: "Completed" },
    ],
  },
];

export const tagSuggestions = ["office", "weekend", "friends", "family"];

// What the coach adds under the category picker, per category.
export const categoryNotes = {
  cafenele: "Counts towards the Cafés budget: at most 3 a week.",
  nesortat: "I don't recognise the merchant. It looks like an online purchase: pick the category so the payment goes into the right budget.",
  locuinta: "Fixed cost: not added to variable spending.",
  abonamente: "Fixed cost: not added to variable spending.",
  economii: "Savings: not added to spending.",
  venit: "Income: not added to spending.",
};
