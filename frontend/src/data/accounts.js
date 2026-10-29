// Demo accounts for the simulated sign-in. No credentials are asked for or stored.
// Each personal account opens the same Coach with its own data (#/intra/<id>, see data/personas.js);
// the business one, a vegetable farm, opens the green credit for investments (design/pj-greenstruct.md).

export const login = {
  title: "Welcome back",
  lead: "Choose the account to enter the demo with.",
  note: "Hackathon prototype with fictional data, not affiliated with Raiffeisen Bank. No sign-in details are asked for; in the real app you sign in with a PIN or biometrics.",
};

export const accounts = {
  pf: [
    { id: "pf", profile: "Employee", name: "Daria Ionescu", initial: "D", detail: "RON current account · RO12 RZBR •••• 1234", href: "#/intra/pf" },
    { id: "student", profile: "Student", name: "Matei Popescu", initial: "M", detail: "RON current account · RO45 RZBR •••• 5678", href: "#/intra/student" },
  ],
  pj: [{ id: "pj", profile: "Vegetable farm", name: "Legume Bărăgan SRL", initial: "L", detail: "RON current account · CUI 4•••••3", href: "#/firma" }],
};

export const business = {
  // the company signed in with the business account: its data comes from the backend (fictional demo farm)
  cui: "45871203",
  subtitle: "Legume Bărăgan SRL · legal entity",
  products: [
    { icon: "card", name: "Business accounts" },
    { icon: "transfer", name: "POS and online payments" },
    { icon: "bank", name: "Financing" },
    { icon: "file", name: "Invoicing and partners" },
    { icon: "shield", name: "Business insurance" },
  ],
  note: "The financial Coach for individuals is available in your personal account.",
};
