// Fictional demo data for Daria, an employee paid on the 5th. The person, merchants and amounts are invented.
// The screens read everything from here, so this file can later be replaced by API calls.
// State shown: Thursday 12 November 2026, day 8 of the pay cycle 5 Nov – 4 Dec.

import { bankServices } from "./bank.js";

export const today = { label: "Thursday, 12 November" };

export const client = { firstName: "Daria", name: "Daria Ionescu", initial: "D", segment: "individual", card: "Visa card •••• 1234" };

// The budget period follows the client's profile: the day before the salary for an employee
// (Daria: paid on the 5th), the day before the pension for a pensioner, or a date the client
// picks when income is irregular. The screens only show `endsOn` and `basis`.
export const cycle = {
  label: "5 Nov – 4 Dec",
  endsOn: "4 December",
  basis: "Your salary comes in on 5 December.",
  total: 6200,
  totalNote: "From the 6,200 RON salary received on 5 November.",
  fixed: 3020,
  setAside: 1200,
  spendable: 1980,
  spent: 739,
  left: 1241,
  perDay: 54,
  daysLeftLabel: "23 days",
};

export const allocation = [
  { id: "fixed", label: "Fixed costs", lei: 3020, tone: "fixed" },
  { id: "aside", label: "Set aside for gifts", lei: 1200, tone: "aside" },
  { id: "spend", label: "Available to spend", lei: 1980, tone: "spend" },
];

export const week = {
  spent: 194,
  daysSoFar: 4,
  guidePerDay: 54,
  scaleMax: 90,
  days: [
    { d: "M", name: "Monday", lei: 62 },
    { d: "Tu", name: "Tuesday", lei: 48 },
    { d: "W", name: "Wednesday", lei: 54 },
    { d: "Th", name: "Thursday", lei: 30, today: true },
    { d: "F", name: "Friday" },
    { d: "Sa", name: "Saturday" },
    { d: "Su", name: "Sunday" },
  ],
};

export const lastMessage = {
  icon: "cup",
  meta: "Today, 08:12 · Cafés",
  title: "Your third coffee this week",
  text: "Until Monday, make your coffee at home. Compared with a usual week, you save about 50 RON.",
};

export const insight = {
  figure: "28%",
  text: "of the period's budget went in the first 4 days after payday. In October, it was 41%.",
};

// Budgets are listed by group (see budgetGroups); Daria has one group, so no budget names one.
export const budgetGroups = [{ title: "By category", src: "agreed", note: "set by you" }];

// kind: "count" (number of payments), "amount" (lei), "paid" (a fixed cost already paid),
// "pause" or "protected" (no limit, client's choice).
export const budgets = [
  { id: "cafenele", name: "Cafés", icon: "cup", kind: "count", used: 3, max: 3, note: "3 of 3 this week · next week starts Monday", onHome: true },
  { id: "cadouri", name: "Gifts", icon: "gift", kind: "amount", spent: 380, limit: 1200, note: "3 of 10 occasions, from the money set aside", onHome: true },
  { id: "iesiri", name: "Restaurants", icon: "utensils", kind: "amount", spent: 120, limit: 200, warn: true, note: "60% of the budget, in the first 8 days of the period", onHome: true },
  { id: "haine", name: "Clothes", icon: "shirt", kind: "pause", note: "Paused until January, as agreed" },
  { id: "livrari", name: "Food delivery", icon: "bag", kind: "protected", spent: 150, note: "No limit, as you asked" },
];

export const unbudgeted = {
  total: 314,
  items: [
    { name: "Groceries", icon: "cart", lei: 154, note: "Plus meal vouchers" },
    { name: "Taxi", icon: "car", lei: 40 },
    { name: "Uncategorised", icon: "help", lei: 120, note: "One payment to clarify" },
  ],
};

export const question = {
  amount: 120,
  merchant: "ONLINE*ABC SRL",
  date: "6 November",
  options: ["Online shopping", "Gift", "Something else"],
  txId: "t14",
};

export const agenda = [
  { day: "14", month: "Nov", title: "2 birthdays", note: "200 RON from the gift budget" },
  { day: "30", month: "Nov", title: "St Andrew's Day", note: "Just wishes, as you decided" },
  { day: "5", month: "Dec", title: "Salary", note: "1,200 RON set aside for Christmas" },
];

export const goal = {
  name: "Laptop",
  icon: "target",
  note: "From savings, no instalments",
  saved: 0,
  amount: 2000,
  due: { label: "Goal reached on", date: "5 March 2027", note: "first deposit on 5 January" },
  plan: [
    { month: "Nov", add: 0, total: 0 },
    { month: "Dec", add: 0, total: 0 },
    { month: "Jan", add: 700, total: 700 },
    { month: "Feb", add: 700, total: 1400 },
    { month: "Mar", add: 600, total: 2000 },
  ],
  reason: "November and December have gifts and Christmas, so we start in January.",
  fundingLabel: "estimated, Jan–Mar",
  funding: [
    { name: "No FitZone subscription", lei: 220 },
    { name: "Cafés: 3 a week", lei: 210 },
    { name: "Fewer gifts in Jan–Mar", lei: 200 },
    { name: "Fewer restaurants and clothes", lei: 130 },
  ],
  storage: "fixpay",
};

export const pots = [
  { name: "Gifts, November", icon: "gift", lei: 820, note: "Left of 1,200 RON, for 7 occasions" },
  { name: "Christmas", icon: "wallet", lei: 1200, note: "Set aside on 5 December, after payday" },
];

export const nextGoals = [];

// A topic not discussed yet, offered as an empty state on Obiective.
export const reserve = {
  title: "Emergency fund",
  text: "We haven't talked about this yet. An emergency fund helps when an unexpected cost comes up.",
  action: "Let's talk",
  href: "#/chat",
};

// type: "divider", "coach", "me", "proposal" or "service" (a card from `services`, by id).
export const chat = [
  { type: "divider", text: "28 October" },
  {
    type: "coach",
    text: "I see a payment of about 30 RON almost every morning at Boabe & Co, between 8:00 and 9:30. Over the last 3 months: 4–5 a week, about 600 RON a month. What do you usually buy?",
  },
  { type: "me", text: "Coffee and a pretzel on the way to the office." },
  { type: "coach", text: "Thanks. How often would you like to get it, so you enjoy it without it hurting you at the end of the month?" },
  { type: "me", text: "3 times a week." },
  {
    type: "proposal",
    title: "New budget: Cafés",
    lines: ["At most 3 a week, at any café.", "I'll write to you at the third one.", "You save about 210 RON a month."],
    done: "Approved on 28 October",
  },
  { type: "coach", text: "One more thing: you pay 220 RON a month to FitZone, but the gym's app hasn't been opened since April. Do you still go?" },
  { type: "me", text: "No. I want to cancel." },
  {
    type: "coach",
    text: "Then the steps are:",
    steps: [
      "Ask the gym to cancel. The contract may have a notice period.",
      "Once confirmed, block the payment in “Manage recurring payments”. Blocking alone does not cancel the contract.",
    ],
    after: "A single visit costs 40 RON, so the subscription is only worth it if you go at least 6 times a month.",
  },
  { type: "service", id: "recurring-payments" },
  {
    type: "proposal",
    title: "Reminder: the FitZone request",
    lines: ["I'll remind you on Friday at 10:00 to send the cancellation request."],
    actions: ["Yes, remind me", "Not now"],
  },
  { type: "divider", text: "Today" },
  { type: "me", text: "Can I have another coffee this afternoon?" },
  {
    type: "coach",
    text: "You're at 3 of 3 this week. It's your call: a fourth coffee would come out of the roughly 54 RON a day you have left until 4 December.",
  },
];

// src: "obs" (observat), "said" (spus), "agreed" (stabilit), "est" (estimat).
export const profile = {
  statements: [
    { icon: "card", name: "RON current account", note: "Nov 2025 – Oct 2026, imported from the app · updated monthly", status: "Imported" },
    { icon: "file", name: "Attached statements", note: "2 files: Nov 2024 – Oct 2025 and another bank", status: "Processed" },
  ],
  about: [
    { label: "First name", value: "Daria", src: "obs" },
    { label: "Age", value: "25–34 years", src: "obs" },
    { label: "Household", value: "1 person", src: "said" },
    { label: "Income", value: "Salary, on the 5th of the month", src: "obs" },
    { label: "History analysed", value: "24 months, Nov 2024 – Oct 2026", src: "obs" },
  ],
  money: [
    { label: "Net salary", value: "about 6,200 RON", src: "obs" },
    { label: "Meal vouchers", value: "about 800 RON a month", src: "said" },
    { label: "Fixed costs", value: "3,020 RON a month", src: "obs" },
    { label: "Budget period", value: "From the 5th to the 4th of the next month, following payday", src: "obs" },
    { label: "Weekly budget in November", value: "about 460 RON", src: "est" },
  ],
  income: 6200,
  spending: [
    { name: "Rent", lei: 2400 },
    { name: "Groceries", lei: 650, note: "plus vouchers" },
    { name: "Cafés", lei: 600 },
    { name: "Utilities", lei: 460 },
    { name: "Food delivery", lei: 450 },
    { name: "Restaurants", lei: 350 },
    { name: "Gifts", lei: 300 },
    { name: "Clothes", lei: 280 },
    { name: "Transport", lei: 230 },
    { name: "Other", lei: 180 },
  ],
  observed: [
    { text: "Under 100 RON in the account between the 27th and the 5th, in 5 of the last 6 months", src: "obs" },
    { text: "55% of spending in the first 10 days after payday", src: "obs" },
    { text: "Boabe & Co, about 30 RON, 4–5 mornings a week", quote: "coffee and a pretzel on the way to the office", src: "said" },
  ],
  subscriptions: [
    { name: "FitZone Gym", lei: 220, note: "Gym app not opened since April · 1,320 RON paid since then", status: "Cancel at the gym, then block the payment" },
    { name: "StreamFlix", lei: 55 },
    { name: "MuzicaPlus", lei: 25 },
  ],
  talk: [
    { label: "Tone", value: "Direct, with a little humour" },
    { label: "Notifications", value: "At most one a day" },
    { label: "No notifications", value: "22:00 – 08:00" },
    { label: "Weekly summary", value: "Sunday, at 19:00" },
  ],
  permissions: [
    { id: "tx", label: "Account statements", hint: "Current account and 2 attached statements · 24 months", on: true },
    { id: "live", label: "Card payments, in real time", hint: "For messages about budgets", on: true },
    { id: "screen", label: "Screen Time", hint: "Only the FitZone app", on: true },
    { id: "calendar", label: "Google Calendar", hint: "Only birthdays and marked events", on: true },
    { id: "contacts", label: "Contacts", hint: "First names only, processed on the phone", on: true },
    { id: "health", label: "Health", hint: "Not used", on: false },
  ],
  unknown: ["Emergency fund", "Holiday bonus", "Debts to friends or family"],
};

// Service cards (components/services.jsx): facts from data/bank.js plus why each one appears for Daria.
// state: "active", "proposed", "later" or "howto" (a feature she already has).
export const services = {
  on: true,
  hint: "At most one a week, only for needs you have mentioned or confirmed",
  items: [
    {
      ...bankServices.fixpay,
      id: "fixpay",
      state: "active",
      status: "Active",
      helps:
        "On the 5th, after payday, the gift money moves to your savings account by itself, and from January the laptop money too: 700 RON on 5 January and 5 February, then 600 RON on 5 March. You see from the start how much you have left to spend.",
      why: "On 28 October you said you want to set money aside at the start of the month.",
      without: "Without FixPay, you move the money yourself on the 5th, in the app.",
    },
    {
      ...bankServices.recurringPayments,
      id: "recurring-payments",
      state: "howto",
      status: "After cancelling",
      helps: "Once you've asked FitZone to cancel, block the 220 RON monthly payment so it is no longer taken from your card.",
      whyLabel: "Why I'm showing you this",
      why: "On 28 October you said you no longer go to the gym and want to cancel the subscription.",
      without: "You still need to send the cancellation request to the gym: the contract may have a notice period.",
      actions: ["Show me the steps"],
    },
    {
      ...bankServices.savingbox,
      id: "savingbox",
      state: "later",
      status: "Later",
      helps:
        "It would help you save without thinking, but right now it would take money from every payment, exactly when you're short at the end of the month. I'll suggest it after 3 months in which you reach payday with money in the account.",
      whyLabel: "Why later",
      why: "In 5 of the last 6 months you had under 100 RON in your account between the 27th and the 5th.",
      without: "Until then, FixPay sets aside the agreed amounts on the 5th, after payday.",
    },
  ],
};
