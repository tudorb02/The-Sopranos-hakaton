// Raiffeisen services and pages the coach can point to, with facts from raiffeisen.ro. The links were checked
// on 28.10.2026; the date in `source` is the page's own. The personal part of a card (why it appears, how it
// helps this client) lives in the client's data file. Rules: design/coach-services.md.

const SITE = "https://www.raiffeisen.ro/ro";

export const bankPages = {
  savings: `${SITE}/persoane-fizice/produsele-noastre/economii/cont-de-economii.html`,
  zeroSimplu: `${SITE}/persoane-fizice/produsele-noastre/conturi-si-pachete-de-cont-curent/pachetul-de-cont-curent-zero-simplu.html`,
  recurringPayments: `${SITE}/despre-noi/comunicate-de-presa/2026/smart-mobile-control-plati-recurente-si-abonamente.html`,
  emergencyFund: `${SITE}/persoane-fizice/despre-bani-1-la-1/fondul-de-urgenta-protejeaza-te-de-situatii-neasteptate.html`,
  selfSupport: `${SITE}/persoane-fizice/despre-bani-1-la-1/5-sfaturi-financiare-pentru-cei-care-se-intretin-singuri.html`,
  moneyStrike: `${SITE}/despre-noi/comunicate-de-presa/2025/money-strike-harta-fps-educatie-financiara-pentru-tineri.html`,
  startInvestitii: `${SITE}/despre-noi/comunicate-de-presa/2026/start-in-investitii-program-digital-raiffeisen-bank-disponibil-din-mobile-app.html`,
  // F1 in the GreenStruct README: the public announcement of the InvestEU sustainability guarantee (2023).
  eifSustainability: "https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth",
};

export const bankServices = {
  fixpay: {
    icon: "repeat",
    kind: "Scheduled transfer",
    name: "FixPay → Super Acces Plus",
    description: "FixPay automatically moves an amount from your current account to the Super Acces Plus savings account, on the date you choose.",
    terms: [
      { label: "FixPay cost", value: "0 RON in the ZERO Simplu package" },
      { label: "Interest rate", value: "2.00% a year, variable; 10% tax on interest" },
      { label: "Withdrawals", value: "Any time" },
    ],
    link: { href: bankPages.savings, label: "Super Acces Plus and FixPay on raiffeisen.ro" },
    source: "raiffeisen.ro: fees (01.09.2026) and savings account (30.06.2026)",
  },
  savings: {
    icon: "wallet",
    kind: "Savings account",
    name: "Super Acces Plus",
    description: "RON savings account with a variable interest rate; you can withdraw your money any time.",
    terms: [
      { label: "Interest rate", value: "2.00% a year, variable" },
      { label: "Tax", value: "10% of the interest" },
      { label: "Withdrawals", value: "Any time" },
    ],
    link: { href: bankPages.savings, label: "The savings account on raiffeisen.ro" },
    source: "raiffeisen.ro: savings account (30.06.2026)",
  },
  savingbox: {
    icon: "card",
    kind: "Saving with card payments",
    name: "Pay and save",
    description: "With every debit card payment, 1%, 3%, 5% or 10% of the amount moves automatically to a dedicated savings account.",
    terms: [
      { label: "Cost", value: "0 RON management fee" },
      { label: "Interest rate", value: "10.00% a year on the first 5,000 RON, variable" },
      { label: "Condition", value: "The account is funded only from card payments" },
    ],
    link: { href: bankPages.savings, label: "“Pay and save” on raiffeisen.ro" },
    source: "raiffeisen.ro: savings account (30.06.2026)",
  },
  zeroSimplu: {
    icon: "card",
    kind: "Current account package",
    name: "ZERO Simplu",
    description: "The RON current account package, with a debit card, Smart Mobile and instant payments.",
    terms: [
      { label: "Monthly cost", value: "0 RON from age 18 to 24, no conditions" },
      { label: "FixPay", value: "0 RON in the package" },
    ],
    link: { href: bankPages.zeroSimplu, label: "The ZERO Simplu package on raiffeisen.ro" },
    source: "raiffeisen.ro: ZERO Simplu package (16.10.2026)",
  },
  recurringPayments: {
    icon: "lock",
    kind: "Smart Mobile feature",
    name: "Manage recurring payments",
    description: "In Smart Mobile you see the recurring payments made with your Visa card and can block them.",
    terms: [
      { label: "Where", value: "Smart Mobile, under the Visa card" },
      { label: "Note", value: "Blocking the payment does not cancel the contract" },
    ],
    link: { href: bankPages.recurringPayments, label: "The feature announcement on raiffeisen.ro" },
    source: "Raiffeisen Bank press release (25.05.2026)",
  },
  // For businesses: F1 of the GreenStruct README, the guarantee behind the green credit. The 70% coverage is the
  // README's example and stays to confirm with Raiffeisen (README §13).
  eifSustainability: {
    icon: "shield",
    kind: "Guarantee for SME green loans",
    name: "EIF InvestEU sustainability guarantee",
    description: "The European Investment Fund (EIF) guarantees part of the green investment loans Raiffeisen grants to SMEs.",
    terms: [
      { label: "For", value: "Green or sustainable investments, with documented eligibility" },
      { label: "Guarantee", value: "70% of the credit, in this indicative offer" },
      { label: "Benefits", value: "According to the EIF: lower interest rate, less collateral, smaller down payment, longer term" },
    ],
    link: { href: bankPages.eifSustainability, label: "The EIF announcement of the guarantee" },
    source: "eif.org: the guarantee for SMEs in Romania (2023)",
  },
};
