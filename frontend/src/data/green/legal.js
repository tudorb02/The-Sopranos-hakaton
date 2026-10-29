// The notice of the green-credit flow, same shape as data/legal.js. The wording is a proposal for the bank's
// legal team; "encrypted" must hold in the real implementation, in transit and at rest.

export const greenLegal = {
  eyebrow: "Notice",
  title: "The analysis and the company data",
  items: [
    { icon: "compass", text: "You prepare the dossier in the app, with the help of AI agents. The bank only gives the final approval." },
    { icon: "chat", text: "The bank calculates the figures with fixed rules. The AI reads the documents and writes the explanations, but does no calculations." },
    { icon: "lock", text: "The company data and documents are encrypted, both in transit and at rest, and are used only for this dossier." },
    { icon: "shield", text: "Anything missing from the dossier becomes a condition precedent to drawdown, not a reason for rejection." },
  ],
  strip: "Encrypted data · The bank gives the final approval",
  // Who can see the dossier. A proposal for the legal team: every line must hold in the real implementation.
  access: {
    title: "Who sees the dossier",
    items: [
      { icon: "lock", title: "You", text: "You see the whole dossier and every figure in it, with its source." },
      { icon: "bank", title: "The bank", text: "Receives the prepared dossier only after you press “Send the application to the bank”, for the final approval. Until then, only you see it." },
      { icon: "shield", title: "European Investment Fund", text: "If you choose the green credit with a guarantee, it receives only the data needed for the guarantee: the company, the credit and the investment." },
    ],
  },
  never: {
    title: "What we never do",
    items: [
      "We do not send the company data to ANAF or APIA: we only read it, with your consent",
      "We do not use the dossier for advertising or for other products",
      "We never ask for passwords, PINs or codes received by SMS",
      "We do not send the data outside the European Union",
    ],
  },
  log: {
    title: "Recent access",
    items: [
      { who: "The bank", what: "Received the dossier, for the final approval", when: "12 Nov, 11:02" },
      { who: "You", what: "Uploaded the documents", when: "12 Nov, 10:15" },
    ],
  },
  security: {
    title: "How we protect the company data",
    items: [
      { icon: "lock", title: "Encrypted everywhere", text: "The company documents and data are encrypted in transit and at rest. Without the bank's encryption keys, a copied file cannot be read." },
      { icon: "shield", title: "Only from the company account", text: "The dossier opens only in the app, for the company's users, after sign-in." },
      { icon: "compass", title: "The agents get only what they need", text: "The offer, the technical data sheets and the farm figures, with no personal data of the shareholders. The data stays in the EU." },
    ],
  },
  privacy: {
    title: "The dossier stays private",
    items: [
      "The dossier does not become public. Only the ANAF data was public before",
      "We do not give the dossier to other companies, to the suppliers in the offer or to other banks",
      "Reports for green bond investors show only totals per category, without the company name",
    ],
  },
  incident: {
    title: "If something happens",
    items: [
      { icon: "bell", title: "A security incident", text: "If there is ever an incident affecting the company data, we tell you directly and notify the authorities, as the law requires." },
      { icon: "help", title: "A suspicion", text: "Check the recent access above and write to us in Chat 1:1 or call *2000." },
    ],
  },
  // The short version, shown at the step where the company gives its consents.
  promise: {
    title: "The dossier stays private",
    items: ["Encrypted, in transit and at rest", "It does not become public and does not reach other companies", "The bank receives it only when you send it, for approval"],
    link: "Who sees the dossier and how we protect it",
  },
  dataTitle: "What data we use",
  data: [
    { name: "ANAF and ONRC", note: "Public data: name, CAEN code, employees, turnover, balance sheet" },
    { name: "APIA", note: "With your consent: the parcels, 3 years of crops and the subsidies" },
    { name: "ANSVSA", note: "With your consent, only if you keep animals" },
    { name: "Open Banking", note: "With your consent: income and payments over 12–24 months" },
    { name: "Uploaded documents", note: "The offer, the technical data sheets, the permits and the invoices" },
  ],
  erase: "From Your dossier → Withdraw the application. Your uploaded documents and answers are deleted. Public data about the company stays public.",
  contact: "Have a question? Write to us in Chat 1:1 in the app or call *2000.",
};
