// The coach's notice on advice and data. The wording is a proposal for the bank's legal team to validate.
// "criptate" must hold in the real implementation: encryption in transit and at rest.

export const legal = {
  eyebrow: "Notice",
  title: "Your recommendations and data",
  items: [
    { icon: "compass", text: "Recommendations are personalised based on your data. They are for information only, and the decisions are yours." },
    { icon: "chat", text: "The Coach is an AI-based assistant and can make mistakes. It does not provide financial or investment advice." },
    { icon: "lock", text: "All your information is encrypted, both in transit and at rest." },
    { icon: "shield", text: "We never carry out any operation without your consent. Your data is not used for credit assessment or marketing, and you can delete it any time." },
  ],
  strip: "Encrypted, private data · The decisions are yours",
  // Who can see what. A proposal for the legal team: every line must hold in the real implementation
  // (EU-only processing, a model that does not learn from client data, an access log).
  access: {
    title: "Who sees your data",
    items: [
      { icon: "lock", title: "You", text: "In Profile you see everything the Coach knows about you and can correct or delete any line." },
      { icon: "compass", title: "The Coach", text: "Reads your statements and answers only to calculate your budgets and recommendations. The AI model does not learn from your data." },
      { icon: "chat", title: "A Raiffeisen adviser", text: "Sees your Coach profile only if you show it, in a Chat 1:1 conversation, and only while the conversation lasts." },
      { icon: "shield", title: "Other companies", text: "No one. We do not sell or give your data to other companies, neither for ads nor for credit assessment." },
    ],
  },
  never: {
    title: "What we never do",
    items: [
      "We never ask for your password, PIN or SMS codes",
      "We make no payments and move no money without your approval in the app",
      "We do not read calendar titles or what you do in other apps",
      "We do not send your data outside the European Union",
    ],
  },
  log: {
    title: "Recent access",
    items: [
      { who: "The Coach", what: "Read yesterday's payments for today's summary", when: "Today, 07:00" },
      { who: "You", what: "Opened your Profile", when: "Yesterday, 21:14" },
      { who: "The Coach", what: "Read the calendar for next week", when: "10 Nov, 07:00" },
    ],
    note: "No bank employee has opened your Coach profile.",
  },
  security: {
    title: "How we protect your data",
    items: [
      { icon: "lock", title: "Encrypted everywhere", text: "Data is encrypted while travelling between your phone and the bank and while stored. Without the bank's encryption keys, copied data cannot be read." },
      { icon: "shield", title: "Protected like the app", text: "The Coach opens only from the app, after your PIN, fingerprint or Face ID. No extra account or password to remember." },
      { icon: "compass", title: "Your name never reaches the AI model", text: "The model receives transactions with a code instead of your name and IBAN. The data stays in the bank's systems, in the EU." },
      { icon: "card", title: "No card data", text: "The Coach never receives the full card number, the CVV code or passwords." },
    ],
  },
  privacy: {
    title: "Your finances stay private",
    items: [
      "Nothing in the Coach becomes public: there are no public profiles, rankings or comparisons with other clients",
      "We do not publish, sell or show anyone your amounts, payments or goals",
      "On the lock screen, notifications can appear without amounts",
      "You can also hide amounts in the app when someone is next to you",
    ],
  },
  incident: {
    title: "If something happens",
    items: [
      { icon: "phone", title: "You lost your phone", text: "Call *2000 to block access. Your Coach profile is not stored on the phone but in the bank's systems." },
      { icon: "bell", title: "A security incident", text: "If there were ever an incident affecting your data, we would tell you directly and notify the data protection authority (ANSPDCP), as the law requires." },
      { icon: "help", title: "A suspicion", text: "Check the recent access above and write to us in Chat 1:1 or call *2000." },
    ],
  },
  // The short version, shown where people share data (activation). The full notice is one tap away.
  promise: {
    title: "Your data stays private",
    items: ["Encrypted in transit and at rest", "Never made public or sold to anyone", "Only you see it, and you can delete it any time"],
    link: "Who sees your data and how we protect it",
  },
  // Settings in Profil for what other people could see on the screen.
  screenPrivacy: [
    { id: "hide-amounts", label: "Hide amounts on screen", hint: "Amounts show as “••••” until you tap them", on: false },
    { id: "quiet-notifications", label: "No amounts in notifications", hint: "The lock screen shows only “You have a message from the Coach”", on: true },
  ],
  dataTitle: "What data the Coach uses",
  data: [
    { name: "Account statements", note: "Your current account and the statements you attached" },
    { name: "Your answers", note: "From the first questions and from conversations" },
    { name: "Calendar", note: "Optional: only birthdays and marked events" },
    { name: "Screen Time", note: "Optional: only whether you opened the chosen apps" },
  ],
  erase: "From Profile → Turn off the Coach. Imported statements and your answers are deleted; your account and cards are not affected.",
  contact: "Have a question? Write to us in Chat 1:1 in the app or call *2000.",
};
