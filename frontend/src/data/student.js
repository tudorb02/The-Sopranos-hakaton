// Fictional demo data for Matei, a student without a stable income (see design/coach-students.md).
// Same shapes as demo.js, tracking.js and activation.js, so the coach screens work unchanged.
// State shown: Thursday 12 November 2026, day 12 of the budget period 1–30 November.
// Money for November: 361 lei left from October + 1.500 lei received (family 1.200, tutoring 2 × 150).
// Spent 1.071 lei (necessary 697, optional 374) and 150 lei moved to the safety fund, so 640 lei are left.

import { apps as dariaApps, calendar as dariaCalendar, intro, questions as dariaQuestions, statements as dariaStatements } from "./activation.js";
import { bankPages, bankServices } from "./bank.js";
import { filters } from "./tracking.js";

export { filters, intro };

export const today = { label: "Thursday, 12 November" };

export const client = { firstName: "Matei", name: "Matei Popescu", initial: "M", segment: "individual · student", card: "Visa card •••• 5678" };

// No payday: the period ends the day before the next certain income (money from family, on the 1st).
// The scholarship is estimated, so it counts only once it arrives. `pace` appears when, at the current
// pace, the money runs out before the end of the period.
export const cycle = {
  label: "1 – 30 Nov",
  endsOn: "30 November",
  basis: "Money from your family comes in on 1 December.",
  pace: "At your pace so far, about 55 RON a day, your money lasts until 23 November.",
  total: 1861,
  totalNote: "Out of 1,861 RON: 1,500 RON received in November and 361 RON left from October. The scholarship is not included.",
  spendable: 1711,
  spent: 1071,
  left: 640,
  perDay: 34,
  daysLeftLabel: "19 days",
};

export const allocation = [
  { id: "needs", label: "Essentials", lei: 1200, tone: "fixed" },
  { id: "aside", label: "Safety fund", lei: 150, tone: "aside" },
  { id: "spend", label: "Optional", lei: 511, tone: "spend" },
];

// What must still be paid until the end of the period, before any optional spending.
export const essentials = {
  title: "Essentials until 30 November",
  total: 503,
  items: [
    { name: "Dorm and transport", icon: "home", note: "400 RON, paid on 2 November", status: "Paid" },
    { name: "Groceries", icon: "cart", note: "About 21 RON a day", lei: 403 },
    { name: "Studies", icon: "book", note: "Books and printing", lei: 75 },
    { name: "Phone and internet", icon: "phone", note: "On 20 November", lei: 25 },
  ],
  rest: { label: "Left for optional spending", lei: 137 },
  pending: "The scholarship is not included: about 700 RON, around 15 November. I'll add it to the budget once it reaches your account.",
};

export const week = {
  spent: 183,
  daysSoFar: 4,
  guidePerDay: 34,
  scaleMax: 120,
  days: [
    { d: "M", name: "Monday", lei: 26 },
    { d: "Tu", name: "Tuesday", lei: 107 },
    { d: "W", name: "Wednesday", lei: 42 },
    { d: "Th", name: "Thursday", lei: 8, today: true },
    { d: "F", name: "Friday" },
    { d: "Sa", name: "Saturday" },
    { d: "Su", name: "Sunday" },
  ],
};

export const lastMessage = {
  icon: "wallet",
  meta: "Yesterday, 19:32 · Safety fund",
  title: "You set aside 15 RON",
  text: "10% of the 150 RON from tutoring, as agreed. The safety fund now has 650 of 1,200 RON.",
};

export const insight = {
  figure: "6 days",
  text: "That's how many days you were short, on average, before the 1st in the months without a scholarship, July to September. In October, with the scholarship, you ended the month with 361 RON in your account.",
};

export const budgetGroups = [
  { id: "necesare", title: "Essentials", src: "agreed", note: "set by you" },
  { id: "optionale", title: "Optional", note: "137 RON left" },
];

export const budgets = [
  { id: "camin", group: "necesare", name: "Dorm", icon: "home", kind: "paid", spent: 350, note: "Paid on 2 November" },
  { id: "transport", group: "necesare", name: "Transport", icon: "bus", kind: "paid", spent: 50, note: "Student pass, paid on 2 November" },
  { id: "alimente", group: "necesare", name: "Groceries", icon: "cart", kind: "amount", spent: 297, limit: 700, note: "About 21 RON a day until 30 November" },
  { id: "studii", group: "necesare", name: "Studies", icon: "book", kind: "amount", spent: 0, limit: 75, note: "Books and printing" },
  { id: "telefon", group: "necesare", name: "Phone and internet", icon: "phone", kind: "amount", spent: 0, limit: 25, note: "Paid on 20 November" },
  { id: "iesiri", group: "optionale", name: "Restaurants", icon: "utensils", kind: "amount", spent: 120, limit: 120, warn: true, note: "Monthly limit reached", onHome: true },
  { id: "livrari", group: "optionale", name: "Food delivery", icon: "bag", kind: "amount", spent: 86, limit: 120, note: "2 orders this month", onHome: true },
  { id: "cafenele", group: "optionale", name: "Cafés", icon: "cup", kind: "amount", spent: 40, limit: 60, note: "5 coffees this month", onHome: true },
  { id: "taxi", group: "optionale", name: "Taxi", icon: "car", kind: "amount", spent: 40, limit: 60, note: "Only late at night, as agreed" },
];

export const unbudgeted = {
  total: 88,
  items: [
    { name: "Subscriptions", icon: "repeat", lei: 60, note: "LinguaPlus and MuzicaPlus Student" },
    { name: "Uncategorised", icon: "help", lei: 28, note: "One payment to clarify" },
  ],
};

export const question = {
  amount: 28,
  merchant: "PLAYNET*STORE",
  date: "7 November",
  options: ["A game", "A subscription", "Something else"],
  txId: "m13",
};

export const agenda = [
  { day: "15", month: "Nov", title: "Scholarship, about 700 RON", note: "Estimated: I'll add it to the budget when it arrives" },
  { day: "20", month: "Nov", title: "Phone", note: "25 RON, from essentials" },
  { day: "1", month: "Dec", title: "Money from family", note: "1,200 RON · 120 RON to the safety fund" },
];

// The plan counts only certain money: 10% of the family money and of the smallest tutoring month.
export const goal = {
  name: "Safety fund",
  icon: "shield",
  note: "One month of essential spending",
  saved: 650,
  amount: 1200,
  due: { label: "Goal reached in", date: "March 2027", note: "10% of every income" },
  plan: [
    { month: "Oct", add: 500, total: 500 },
    { month: "Nov", add: 165, total: 665 },
    { month: "Dec", add: 135, total: 800 },
    { month: "Jan", add: 135, total: 935 },
    { month: "Feb", add: 135, total: 1070 },
    { month: "Mar", add: 130, total: 1200 },
  ],
  reason: "We started from the 500 RON left from your summer job. I plan only with certain money, from family and tutoring. If the scholarship comes in, the date moves closer.",
  fundingLabel: "estimated, per month",
  funding: [
    { name: "10% of the money from family", lei: 120 },
    { name: "10% of tutoring, at least", lei: 15 },
  ],
  storage: "savings",
  suggestion: "savingbox",
};

export const pots = [];

export const nextGoals = [
  {
    name: "UX design course",
    icon: "book",
    amount: 900,
    when: "Starts in March 2027",
    text: "With the current plan, you start saving for the course after the safety fund. With this week's idea, the money is ready in February.",
    action: "See the idea",
    href: "#/idei",
  },
];

export const reserve = null;

// Development ideas (design/coach-students.md §6): at most one new idea a week, each from a stated goal or interest.
export const ideas = {
  title: "Ideas for you",
  lead: "I start from what you told me: you want a full safety fund and the UX design course in March. You get at most one new idea a week.",
  featured: {
    icon: "wallet",
    eyebrow: "Idea of the week · Income",
    title: "2 more hours of tutoring a week",
    text: "At 50 RON an hour, you earn about 400 RON more a month.",
    effects: ["The safety fund is full in December, not March.", "The money for the UX design course is ready in February."],
    why: "On 28 October you said you tutor maths and have Tuesday and Thursday afternoons free.",
    actions: ["Add to plan", "Not interested"],
  },
  groups: [
    {
      title: "Income",
      items: [
        {
          icon: "calendar",
          title: "Your 2027 summer job",
          text: "This summer you earned 2,400 RON, and in October you still had 500. If you spread the amount over the 9 months of classes, you get about 270 RON more each month.",
          status: "I'll come back with a plan in May",
        },
      ],
    },
    {
      title: "Free financial education",
      note: "from Raiffeisen Bank",
      items: [
        {
          icon: "book",
          title: "5 money tips for people who support themselves",
          text: "An article from the bank's “Despre bani 1:1” guide, about budgeting when you get by on your own.",
          link: { href: bankPages.selfSupport, label: "Read on raiffeisen.ro" },
        },
        {
          icon: "shield",
          title: "The emergency fund",
          text: "Why a reserve matters and how to build it step by step. It fits your current goal.",
          link: { href: bankPages.emergencyFund, label: "Read on raiffeisen.ro" },
        },
        {
          icon: "target",
          title: "Money Strike",
          text: "A free game map for financial education. The learning mode has 10 rounds and shows you at the end whether you are a Saver, Impulsive or Balanced.",
          link: { href: bankPages.moneyStrike, label: "About the game on raiffeisen.ro" },
        },
        {
          icon: "lock",
          title: "Start în Investiții",
          text: "5 interactive in-app courses on how investing works. I'll show it to you once your safety fund is full, and I don't recommend funds.",
          link: { href: bankPages.startInvestitii, label: "About the programme on raiffeisen.ro" },
          status: "After the safety fund",
        },
      ],
    },
    {
      title: "Opportunities",
      items: [
        {
          icon: "calendar",
          title: "Scholarship for the second semester",
          text: "The application deadline is 20 February, from your calendar. I'll remind you a week before.",
          status: "Reminder on 13 February",
        },
      ],
    },
  ],
  rules: "Ideas are indicative and you can hide them any time. I don't promise income and I never suggest betting, crypto or get-rich-quick schemes.",
};

// type: "divider", "coach", "me", "proposal" or "service" (a card from `services`, by id).
export const chat = [
  { type: "divider", text: "28 October" },
  {
    type: "coach",
    text: "In July, August and September, your money ran out 5–8 days before the 1st. In October, with the scholarship, you still had 380 RON in your account 3 days before the 1st. Does the scholarship come every month of classes for sure?",
  },
  { type: "me", text: "Only if my average is above 9. It's not certain." },
  { type: "coach", text: "Then I'll make the plan without it and add it only once it comes in. The money from family and tutoring covers the essentials, about 1,200 RON a month." },
  {
    type: "proposal",
    title: "New rule: 10% aside",
    lines: ["For every income over 100 RON, I'll suggest moving 10% to the safety fund.", "The money moves only after you confirm.", "Target: 1,200 RON, i.e. one month of essentials."],
    done: "Approved on 28 October",
  },
  { type: "me", text: "Can I also save automatically, in small amounts?" },
  {
    type: "coach",
    text: "Yes. The bank has a service that sets aside a percentage of every card payment. As long as your money doesn't last until the 1st, I suggest 1%.",
  },
  { type: "service", id: "savingbox" },
  { type: "divider", text: "Today" },
  { type: "me", text: "Can I still order food tonight?" },
  {
    type: "coach",
    text: "You have 34 RON of 120 left for Food delivery. A usual order, about 40 RON, goes slightly over the limit. It's your call.",
  },
];

// src: "obs" (observat), "said" (spus), "agreed" (stabilit), "est" (estimat).
export const profile = {
  statements: [{ icon: "card", name: "RON current account", note: "Nov 2025 – Oct 2026, imported from the app · updated monthly", status: "Imported" }],
  about: [
    { label: "First name", value: "Matei", src: "obs" },
    { label: "Age", value: "18–24 years", src: "obs" },
    { label: "Occupation", value: "Student, 2nd year", src: "said" },
    { label: "Housing", value: "Student dorm", src: "obs" },
    { label: "History analysed", value: "12 months, Nov 2025 – Oct 2026", src: "obs" },
  ],
  money: [
    { label: "Money from family", value: "1,200 RON, on the 1st of the month", src: "obs" },
    { label: "Scholarship", value: "about 700 RON in months with classes, only with an average above 9", src: "said" },
    { label: "Tutoring", value: "150–450 RON a month", src: "said" },
    { label: "Monthly minimum", value: "1,200 RON: dorm, groceries, transport, phone, studies", src: "est" },
    { label: "Budget period", value: "From the 1st to the end of the month, following the money from family", src: "agreed" },
    { label: "Saving rule", value: "10% of every income over 100 RON", src: "agreed" },
  ],
  income: 1500,
  spending: [
    { name: "Groceries", lei: 720 },
    { name: "Dorm", lei: 350 },
    { name: "Food delivery", lei: 210 },
    { name: "Restaurants", lei: 190 },
    { name: "Cafés", lei: 90 },
    { name: "Taxi", lei: 70 },
    { name: "Subscriptions", lei: 60 },
    { name: "Studies", lei: 60 },
    { name: "Transport", lei: 50 },
    { name: "Phone and internet", lei: 25 },
  ],
  observed: [
    { text: "In July, August and September, without a scholarship, the money ran out 5–8 days before the 1st", src: "obs" },
    { text: "The scholarship came in March–June and in October, around the 15th of the month", src: "obs" },
    { text: "Tutoring: 2–3 payments a month, from the same people", quote: "I tutor maths", src: "said" },
  ],
  subscriptions: [
    { name: "LinguaPlus", lei: 45, note: "App opened twice in October · 135 RON paid since September", status: "You keep it until the January exam" },
    { name: "MuzicaPlus Student", lei: 15 },
  ],
  talk: [
    { label: "Tone", value: "Friendly, no lecturing" },
    { label: "Notifications", value: "At most one a day" },
    { label: "No notifications", value: "23:00 – 09:00" },
    { label: "Weekly summary", value: "Sunday, at 20:00" },
  ],
  permissions: [
    { id: "tx", label: "Account statements", hint: "Current account · 12 months", on: true },
    { id: "live", label: "Card payments, in real time", hint: "For messages about budgets", on: true },
    { id: "screen", label: "Screen Time", hint: "Only the LinguaPlus app", on: true },
    { id: "calendar", label: "Google Calendar", hint: "Only birthdays and the deadlines you mark", on: true },
    { id: "contacts", label: "Contacts", hint: "Not used", on: false },
    { id: "health", label: "Health", hint: "Not used", on: false },
  ],
  unknown: ["What next year costs", "Summer plans", "Debts to friends"],
};

// Service cards (components/services.jsx): facts from data/bank.js plus why each one appears for Matei.
// No credit for this profile: no overdraft, credit card or instalments (design/coach-students.md §7).
export const services = {
  on: true,
  hint: "At most one a week, only for needs you have mentioned or confirmed. No loans.",
  items: [
    {
      ...bankServices.savingbox,
      id: "savingbox",
      state: "proposed",
      status: "Proposal",
      helps:
        "At 1%, out of about 1,500 RON paid by card each month, you automatically set aside about 15 RON a month. Until 30 November that's about 6 RON, so you won't feel the difference.",
      why: "On 28 October you asked how you could save automatically, in small amounts. I suggest 1% as long as your money doesn't last until the 1st.",
      without: "Without the service, your 10% rule on every income stays, and you confirm it each time.",
      actions: ["Set it up in the app", "Not now", "Don't suggest it again"],
    },
    {
      ...bankServices.savings,
      id: "savings",
      state: "active",
      status: "Active",
      helps: "This is where the safety fund lives: 650 of 1,200 RON. The money is kept apart from your spending money, but it's at hand if an emergency comes up.",
      why: "On 28 October you said you want a fund for unexpected situations.",
      without: "Without a savings account, the fund would sit in the current account, mixed with your spending money.",
    },
    {
      ...bankServices.zeroSimplu,
      id: "zero-simplu",
      state: "active",
      status: "Your package",
      helps: "From age 18 to 24 you pay nothing monthly for the account and card, with no conditions. The money from family and tutoring stays whole for you.",
      whyLabel: "Why I'm showing you this",
      why: "You already have it. I'm showing what it includes, so you don't pay for something you get for free.",
    },
  ],
};

// ---------- spending tracker (shapes as in tracking.js) ----------

export const pickerCategories = ["alimente", "cafenele", "livrari", "iesiri", "taxi", "cumparaturi", "abonamente", "studii", "transport", "telefon", "locuinta"];

export const spending = {
  period: "1 – 12 November",
  title: "Variable spending since 1 November",
  total: 611,
  fixed: 460,
  fixedNote: "dorm, transport and subscriptions",
  compare: "85 RON more than the same period in October",
  parts: [
    { id: "alimente", lei: 297 },
    { id: "cafenele", lei: 40 },
    { id: "livrari", lei: 86 },
    { id: "iesiri", lei: 120 },
    { id: "taxi", lei: 40 },
    { id: "nesortat", lei: 28 },
  ],
};

export const review = { id: "m13", title: "1 payment to check", text: "PLAYNET*STORE · 28 RON · Sat, 7 Nov" };

const CANTINA = { merchant: "Cantina Studențească", raw: "CANTINA STUDENTEASCA 2 CLUJ-NAPOCA", name: "Lunch at the canteen", category: "alimente", lei: -18, renamed: true, rule: true, status: "Completed", history: "Last 3 months: 41 payments, 738 RON" };
const COFFEE = { merchant: "Cafeteria Campus", raw: "CAFETERIA CAMPUS SRL CLUJ-NAPOCA", name: "Coffee", category: "cafenele", lei: -8, renamed: true, rule: true, tags: ["uni"], status: "Completed", history: "Last 3 months: 24 payments, 192 RON" };
const MARKET = { merchant: "Market Express", raw: "MARKET EXPRESS 0217 CLUJ-NAPOCA", name: "Market Express", category: "alimente", status: "Completed" };
const FUND = { merchant: "To Super Acces Plus", raw: "TRANSFER CONT PROPRIU · FOND SIGURANTA", name: "Safety fund", category: "economii", renamed: true, status: "Completed" };
const TUTORING = { merchant: "Transfer from a person", raw: "TRANSFER PRIMIT · MEDITATII", name: "Tutoring", category: "venit", lei: 150, renamed: true, status: "Completed" };

// Each day lists its payments newest first; `total` is that day's spending without savings and income.
export const days = [
  {
    label: "Today",
    date: "Thu, 12 Nov",
    total: 8,
    items: [{ ...COFFEE, id: "m1", time: "08:45", note: "Before the 9 o'clock class", status: "Pending" }],
  },
  {
    label: "Yesterday",
    date: "Wed, 11 Nov",
    total: 42,
    items: [
      { id: "m2", time: "22:40", merchant: "TaxiGo", raw: "TAXIGO RIDE CLUJ-NAPOCA", name: "TaxiGo", category: "taxi", lei: -16, status: "Completed" },
      { ...FUND, id: "m3", time: "19:32", lei: -15 },
      { ...TUTORING, id: "m4", time: "19:30" },
      { ...CANTINA, id: "m5", time: "13:00" },
      { ...COFFEE, id: "m6", time: "08:40" },
    ],
  },
  {
    label: "Tuesday",
    date: "10 Nov",
    total: 107,
    items: [
      { id: "m7", time: "21:30", merchant: "Pizzeria Napoca", raw: "PIZZERIA NAPOCA SRL CLUJ-NAPOCA", name: "Pizza with classmates", category: "iesiri", lei: -52, renamed: true, tags: ["friends"], status: "Completed" },
      { ...MARKET, id: "m8", time: "19:15", lei: -37 },
      { ...CANTINA, id: "m9", time: "13:00" },
    ],
  },
  {
    label: "Monday",
    date: "9 Nov",
    total: 26,
    items: [
      { ...CANTINA, id: "m10", time: "13:05" },
      { ...COFFEE, id: "m11", time: "08:30" },
    ],
  },
  {
    label: "Sunday",
    date: "8 Nov",
    total: 41,
    items: [{ id: "m12", time: "20:40", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 90544", name: "LivrareRapidă", category: "livrari", lei: -41, status: "Completed" }],
  },
  {
    label: "Saturday",
    date: "7 Nov",
    total: 80,
    items: [
      { id: "m13", time: "16:20", merchant: "PLAYNET*STORE", raw: "PLAYNET*STORE 7781 ONLINE", name: "", category: "nesortat", lei: -28, needsReview: true, suggestion: "cumparaturi", status: "Completed" },
      { ...MARKET, id: "m14", time: "12:00", lei: -52 },
    ],
  },
  {
    label: "Friday",
    date: "6 Nov",
    total: 110,
    items: [
      { id: "m15", time: "23:50", merchant: "TaxiGo", raw: "TAXIGO RIDE CLUJ-NAPOCA", name: "TaxiGo", category: "taxi", lei: -24, status: "Completed" },
      { id: "m16", time: "22:00", merchant: "Studio Pub", raw: "STUDIO PUB SRL CLUJ-NAPOCA", name: "Night out with friends", category: "iesiri", lei: -68, renamed: true, tags: ["friends"], status: "Completed" },
      { ...CANTINA, id: "m17", time: "13:00" },
    ],
  },
  {
    label: "Thursday",
    date: "5 Nov",
    total: 26,
    items: [
      { ...CANTINA, id: "m18", time: "13:00" },
      { ...COFFEE, id: "m19", time: "08:35" },
    ],
  },
  {
    label: "Wednesday",
    date: "4 Nov",
    total: 63,
    items: [
      { id: "m20", time: "21:10", merchant: "LivrareRapidă", raw: "LIVRARERAPIDA*COMANDA 89917", name: "LivrareRapidă", category: "livrari", lei: -45, status: "Completed" },
      { ...FUND, id: "m21", time: "19:02", lei: -15 },
      { ...TUTORING, id: "m22", time: "19:00" },
      { ...CANTINA, id: "m23", time: "13:00" },
    ],
  },
  {
    label: "Tuesday",
    date: "3 Nov",
    total: 86,
    items: [
      { ...CANTINA, id: "m24", time: "13:05" },
      { ...COFFEE, id: "m25", time: "08:40" },
      { id: "m26", time: "06:00", merchant: "LinguaPlus", raw: "LINGUAPLUS.COM SUBSCRIPTION", name: "LinguaPlus", category: "abonamente", lei: -45, recurring: true, status: "Completed" },
      { id: "m27", time: "06:00", merchant: "MuzicaPlus", raw: "MUZICAPLUS STUDENT", name: "MuzicaPlus Student", category: "abonamente", lei: -15, recurring: true, status: "Completed" },
    ],
  },
  {
    label: "Monday",
    date: "2 Nov",
    total: 418,
    items: [
      { ...CANTINA, id: "m28", time: "13:10" },
      { id: "m29", time: "09:20", merchant: "TransUrban", raw: "TRANSURBAN ABONAMENT STUDENT", name: "Transport pass", category: "transport", lei: -50, recurring: true, renamed: true, status: "Completed" },
      { id: "m30", time: "09:00", merchant: "Student dorm", raw: "CAMIN STUDENTESC C4 · TAXA NOIEMBRIE", name: "Dorm", category: "locuinta", lei: -350, recurring: true, renamed: true, status: "Completed" },
    ],
  },
  {
    label: "Sunday",
    date: "1 Nov",
    total: 64,
    items: [
      { ...MARKET, id: "m31", time: "18:30", lei: -64 },
      { ...FUND, id: "m32", time: "10:05", lei: -120 },
      { id: "m33", time: "10:02", merchant: "Transfer from a person", raw: "TRANSFER PRIMIT · BANI NOIEMBRIE", name: "Money from family", category: "venit", lei: 1200, recurring: true, renamed: true, status: "Completed" },
    ],
  },
];

export const tagSuggestions = ["uni", "friends", "weekend", "dorm"];

// What the coach adds under the category picker, per category.
export const categoryNotes = {
  alimente: "Essential: part of the monthly minimum, before optional spending.",
  cafenele: "Optional: counts towards the Cafés budget, 60 RON a month.",
  nesortat: "I don't recognise the merchant. It looks like an online payment: pick the category so the payment goes into the right budget.",
  locuinta: "Essential: the dorm, paid once a month.",
  transport: "Essential: the student pass.",
  abonamente: "Optional: paid monthly.",
  economii: "Savings: not added to spending.",
  venit: "Income: not added to spending.",
};

// ---------- activation (shapes as in activation.js) ----------

export const statements = {
  ...dariaStatements,
  account: { name: "RON current account", iban: "RO45 RZBR •••• 5678" },
  imported: { title: "12 monthly statements imported", meta: "Nov 2025 – Oct 2026 · 1,104 payments · updated monthly" },
  files: [],
};

export const calendar = {
  ...dariaCalendar,
  found: [
    { day: "Dec", month: "2026", title: "3 birthdays", note: "From your Google contacts" },
    { day: "18", month: "Jan", title: "Winter exam session", note: "Event you marked" },
    { day: "20", month: "Feb", title: "Scholarship application deadline", note: "Event you marked" },
  ],
  gift: {
    question: "How much do you usually spend on a gift?",
    groups: [
      { label: "For friends", options: ["30 RON", "50 RON", "100 RON", "Other amount"], selected: "50 RON" },
      { label: "For family", options: ["50 RON", "100 RON", "150 RON", "Other amount"], selected: "50 RON" },
    ],
    result: "For the 3 birthdays in December: about 150 RON.",
  },
};

export const apps = {
  ...dariaApps,
  found: "I found 2 subscriptions in your statements.",
  items: [
    { name: "LinguaPlus", lei: 45, note: "Paid monthly since September", on: true },
    { name: "MuzicaPlus Student", lei: 15, note: "Paid monthly", on: false },
  ],
};

// The six questions of the first conversation for a student (design/coach-students.md §8).
export const questions = [
  {
    id: "venituri",
    title: "Where does your money come from?",
    hint: "You can choose several. This way I know which money you can count on.",
    options: [
      { label: "Money from family", selected: true },
      { label: "Scholarship", selected: true },
      { label: "Tutoring or projects", selected: true },
      { label: "Part-time job" },
      { label: "Summer job", selected: true },
      { label: "Something else" },
    ],
    fields: [
      { label: "Money from family per month", value: "1200", suffix: "RON", numeric: true },
      { label: "Is the scholarship certain?", type: "select", value: "No, it depends on my grades", options: ["Yes", "No, it depends on my grades", "I don't get a scholarship"] },
      { label: "Tutoring per month, roughly", value: "300", suffix: "RON", numeric: true },
      { label: "Left from the summer job", value: "500", suffix: "RON", numeric: true },
    ],
  },
  {
    id: "necesare",
    title: "Which costs must be covered every month?",
    hint: "From these I calculate the monthly minimum. The rest is optional spending.",
    options: [
      { label: "Dorm or rent", selected: true },
      { label: "Groceries", selected: true },
      { label: "Transport", selected: true },
      { label: "Phone and internet", selected: true },
      { label: "Fees and study materials", selected: true },
      { label: "Health" },
    ],
    fields: [{ label: "Dorm per month", value: "350", suffix: "RON", numeric: true }],
  },
  {
    id: "obiective",
    title: "What would you like to save for?",
    hint: "You can choose several.",
    options: [
      { label: "A safety fund", selected: true },
      { label: "A course", selected: true },
      { label: "Equipment for uni" },
      { label: "Erasmus or a trip" },
      { label: "Nothing in particular right now" },
    ],
    fields: [
      { label: "Which course?", value: "UX design" },
      { label: "How much does it cost?", value: "900", suffix: "RON", numeric: true },
      { label: "When does it start?", type: "select", value: "March 2027", options: ["January 2027", "March 2027", "October 2027", "I don't know yet"] },
    ],
  },
  {
    id: "idei",
    title: "Are you interested in ideas to grow?",
    hint: "At most one a week. You can turn them off any time in Profile.",
    options: [
      { label: "Extra income", selected: true },
      { label: "Courses and financial education", selected: true },
      { label: "Scholarships and opportunities", selected: true },
      { label: "Not now" },
    ],
    fields: [{ label: "What could you do for pay?", type: "textarea", value: "Maths tutoring, on Tuesday and Thursday afternoons." }],
  },
  {
    id: "notificari",
    title: "How often should I write to you, and when should I not disturb you?",
    options: [{ label: "Only when it's important" }, { label: "At most once a day", selected: true }, { label: "Only the weekly summary" }],
    fields: [
      { label: "No notifications from", value: "23:00" },
      { label: "until", value: "09:00" },
      { label: "Weekly summary", type: "select", value: "Sunday, at 20:00", options: ["Sunday, at 20:00", "Monday, at 08:00", "Friday, at 18:00", "No summary"] },
    ],
  },
  dariaQuestions.find((question) => question.id === "servicii"),
];

export const analysis = {
  title: "Analysing the last 12 months",
  lead: "12 months imported from the current account. Takes about a minute.",
  items: [
    { label: "Income and how certain it is", state: "done", note: "Money from family on the 1st, in 12 of 12 months" },
    { label: "Recurring payments and subscriptions", state: "done", note: "4 recurring payments, 2 of them subscriptions" },
    { label: "Categories for 1,104 payments", state: "running", note: "773 of 1,104", progress: 70 },
    { label: "Essential and optional", state: "waiting", note: "Next" },
  ],
  note: "You can close the app. I'll write to you when it's ready.",
};

export const findings = {
  lead: "From 12 months of statements, your calendar and your answers.",
  items: [
    { text: "In July, August and September, without a scholarship, your money ran out 5–8 days before the 1st.", src: "obs" },
    { text: "Your essentials cost about 1,200 RON a month, as much as you get from your family.", src: "est" },
    { text: "LinguaPlus: 45 RON a month, and the app was opened twice in October.", note: "I'll ask you about it in our chat.", src: "obs" },
    { text: "Your scholarship application deadline is 20 February.", src: "obs", label: "from the calendar" },
  ],
  firstStep: {
    icon: "wallet",
    title: "The first step I suggest",
    text: "For every income over 100 RON, put 10% into the safety fund. On 1 November, out of the 1,200 RON from your family, that's 120 RON.",
    action: "See the proposal",
    href: "#/chat",
  },
};
