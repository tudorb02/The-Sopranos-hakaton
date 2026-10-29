// Fictional content for the Coach entry in Produse and its optional activation (28 October 2026,
// before the 5 November payday). Selected answers show what Daria chose; nothing is saved.

export const entry = {
  title: "Financial Coach",
  badge: "New",
  subtitle: "Optional feature",
  text: "It analyses your account statements and helps you with category budgets and goals. You turn it on only if you want, and you can turn it off any time.",
};

// The existing sections of Produse, shown only as context for where the coach lives.
export const products = [
  { icon: "card", name: "Current accounts" },
  { icon: "wallet", name: "Savings and deposits" },
  { icon: "card", name: "Cards" },
  { icon: "bank", name: "Loans" },
  { icon: "shield", name: "Insurance" },
];

export const intro = {
  title: "Turn on the financial Coach",
  lead: "I help you see where your money goes, set category budgets and save for what you want.",
  duration: "Takes about 3 minutes",
  does: [
    "I read the account statements you give me and show you the patterns",
    "I only ask about what I can't see in your transactions",
    "I write to you when you get close to a limit you set",
  ],
};

export const statements = {
  lead: "The Coach works with your account statements. The more months they cover, the better it sees the patterns: ideally 12–24.",
  account: { name: "RON current account", iban: "RO12 RZBR •••• 1234" },
  periods: ["Last 12 months (Nov 2025 – Oct 2026)", "Last 6 months", "Last 3 months"],
  imported: { title: "12 monthly statements imported", meta: "Nov 2025 – Oct 2026 · 978 payments · updated monthly" },
  attachHint: "From previous years or from another bank.",
  formats: "PDF, XLS or CSV · up to 10 MB",
  files: [
    { name: "extras_nov2024-oct2025.pdf", meta: "12 months · 968 payments", state: "done" },
    { name: "extras_alta_banca_2026.csv", meta: "Processing…", state: "reading", progress: 60 },
  ],
  howTo: [
    "Open your bank's app or internet banking",
    "Go to the account and look for “Account statement”",
    "Choose the longest period, in PDF or XLS format",
    "Save the file and attach it here",
  ],
  privacy:
    "Files are encrypted, never made public and seen only by the Coach. From statements I read the date, amount, merchant and description; transfers to people appear only as “transfer to a person”. You can delete a statement any time.",
};

export const calendar = {
  options: [
    { id: "google", icon: "calendar", title: "Google Calendar", note: "I only read birthdays and the events you mark.", action: "Connect", href: "#/activare/calendar/conectat" },
    { id: "phone", icon: "phone", title: "Phone calendar", note: "Data stays on the phone. The Coach only learns how many events there are and when.", action: "Allow" },
  ],
  reads: ["Event type and date", "Birthdays from your Google contacts"],
  doesNotRead: ["Titles, guests or locations", "I never change anything in the calendar"],
  found: [
    { day: "Nov", month: "2026", title: "10 birthdays", note: "From your Google contacts" },
    { day: "Dec", month: "2026", title: "St Nicholas, Christmas, St Stephen", note: "Holidays with gifts" },
    { day: "19", month: "Jun", title: "Wedding", note: "Event you marked, in 2027" },
  ],
  gift: {
    question: "How much do you usually spend on a gift?",
    groups: [
      { label: "For friends", options: ["50 RON", "100 RON", "150 RON", "Other amount"], selected: "100 RON" },
      { label: "For family", options: ["100 RON", "200 RON", "300 RON", "Other amount"], selected: "200 RON" },
    ],
    result: "For the 10 birthdays in November: about 1,200 RON.",
  },
};

export const apps = {
  found: "I found 3 subscriptions in your statements.",
  items: [
    { name: "FitZone Gym", lei: 220, note: "Paid monthly since January", on: true },
    { name: "StreamFlix", lei: 55, note: "Paid monthly", on: false },
    { name: "MuzicaPlus", lei: 25, note: "Paid monthly", on: false },
  ],
  learns: ["Only whether you opened the app on a given day"],
  doesNotLearn: ["How long you spend in the app or what you do there", "Apps other than the ones you chose"],
  platform: "On iPhone I use Screen Time, and on Android access to usage data. Your phone asks for your consent at the next step.",
};

// The six questions of the first conversation (see design/coach-profile.md, Q1–Q5b).
export const questions = [
  {
    id: "probleme",
    title: "What trips you up most often when it comes to money?",
    hint: "You can choose several.",
    options: [
      { label: "I run out of money before payday", selected: true },
      { label: "I don't know where the money goes", selected: true },
      { label: "I can't manage to save" },
      { label: "I pay for subscriptions I don't use" },
      { label: "Something else" },
    ],
    fields: [{ label: "Say it in your own words", type: "textarea", value: "I spend money very fast and can't tell where it goes." }],
  },
  {
    id: "obiective",
    title: "What would you like to save for in the coming months?",
    hint: "You can choose several.",
    options: [
      { label: "A purchase", selected: true },
      { label: "A holiday" },
      { label: "An emergency fund" },
      { label: "Nothing in particular right now" },
    ],
    fields: [
      { label: "What exactly?", value: "Laptop" },
      { label: "How much does it cost?", value: "2000", suffix: "RON", numeric: true },
      { label: "By when?", type: "select", value: "As soon as possible", options: ["As soon as possible", "In 3 months", "In 6 months", "By the end of the year"] },
    ],
  },
  {
    id: "bani-in-afara",
    title: "Do you have money that doesn't go through this account?",
    hint: "For example meal vouchers, cash or an account at another bank. This way I calculate correctly how much you have left.",
    options: [
      { label: "Meal vouchers", selected: true },
      { label: "Cash" },
      { label: "Account at another bank" },
      { label: "No" },
    ],
    fields: [{ label: "Meal vouchers per month", value: "800", suffix: "RON", numeric: true }],
  },
  {
    id: "gospodarie",
    title: "Do you share household costs with anyone?",
    options: [
      { label: "No, just me", selected: true },
      { label: "Yes, with my partner" },
      { label: "Yes, with flatmates" },
      { label: "I live with my family" },
    ],
  },
  {
    id: "notificari",
    title: "How often should I write to you, and when should I not disturb you?",
    options: [
      { label: "Only when it's important" },
      { label: "At most once a day", selected: true },
      { label: "Only the weekly summary" },
    ],
    fields: [
      { label: "No notifications from", value: "22:00" },
      { label: "until", value: "08:00" },
      { label: "Weekly summary", type: "select", value: "Sunday, at 19:00", options: ["Sunday, at 19:00", "Monday, at 08:00", "Friday, at 18:00", "No summary"] },
    ],
  },
  {
    id: "servicii",
    title: "Should I also tell you when a Raiffeisen service could help?",
    hint: "I always tell you why and what it costs. You can change this any time in Profile.",
    options: [{ label: "Yes, at most once a week", selected: true }, { label: "No, just tips" }],
  },
];

export const analysis = {
  title: "Analysing the last 24 months",
  lead: "12 months imported from the current account and 12 from the attached statement. Takes about a minute.",
  items: [
    { label: "Income and payday", state: "done", note: "Salary on the 5th, in 24 of 24 months" },
    { label: "Recurring payments and subscriptions", state: "done", note: "9 recurring payments, 3 of them subscriptions" },
    { label: "Categories for 1,946 payments", state: "running", note: "1,362 of 1,946", progress: 70 },
    { label: "Habits and high-spending months", state: "waiting", note: "Next" },
  ],
  note: "You can close the app. I'll write to you when it's ready.",
};

export const findings = {
  lead: "From 24 months of statements, your calendar and your answers.",
  items: [
    { text: "Between the 27th and the 5th you have under 100 RON in your account, in 5 of the last 6 months.", src: "obs" },
    { text: "Almost every morning you pay about 30 RON at Boabe & Co: about 600 RON a month.", note: "I'll ask you about it in our chat.", src: "obs" },
    { text: "FitZone Gym: 220 RON a month, and the gym's app hasn't been opened since April.", src: "obs" },
    { text: "You have 10 birthdays in November.", src: "obs", label: "from the calendar" },
  ],
  firstStep: {
    icon: "gift",
    title: "The first step I suggest",
    text: "On 5 November, after payday, set aside the 1,200 RON for gifts. That way you see from the start how much you have left for the rest of the month.",
    action: "See the proposal",
    href: "#/chat",
  },
};
