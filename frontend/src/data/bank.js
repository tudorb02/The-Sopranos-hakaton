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
  eifCompetitivitate: `${SITE}/imm/produse-si-servicii/finantare/competitivitate-eif.html`,
};

export const bankServices = {
  fixpay: {
    icon: "repeat",
    kind: "Transfer programat",
    name: "FixPay → Super Acces Plus",
    description: "FixPay mută automat, la data aleasă de tine, o sumă din contul curent în contul de economii Super Acces Plus.",
    terms: [
      { label: "Cost FixPay", value: "0 lei în pachetul ZERO Simplu" },
      { label: "Dobândă", value: "2,00% pe an, variabilă; impozit pe dobândă 10%" },
      { label: "Retrageri", value: "Oricând" },
    ],
    link: { href: bankPages.savings, label: "Super Acces Plus și FixPay pe raiffeisen.ro" },
    source: "raiffeisen.ro: tarife (01.09.2026) și cont de economii (30.06.2026)",
  },
  savings: {
    icon: "wallet",
    kind: "Cont de economii",
    name: "Super Acces Plus",
    description: "Cont de economii în lei, cu dobândă variabilă, din care poți retrage banii oricând.",
    terms: [
      { label: "Dobândă", value: "2,00% pe an, variabilă" },
      { label: "Impozit", value: "10% din dobândă" },
      { label: "Retrageri", value: "Oricând" },
    ],
    link: { href: bankPages.savings, label: "Contul de economii pe raiffeisen.ro" },
    source: "raiffeisen.ro: cont de economii (30.06.2026)",
  },
  savingbox: {
    icon: "card",
    kind: "Economisire la plata cu cardul",
    name: "Plătești și economisești",
    description: "La fiecare plată cu cardul de debit, 1%, 3%, 5% sau 10% din sumă se mută automat într-un cont de economii dedicat.",
    terms: [
      { label: "Cost", value: "0 lei administrare" },
      { label: "Dobândă", value: "10,00% pe an pentru primii 5.000 lei, variabilă" },
      { label: "Condiție", value: "Contul se alimentează doar din plățile cu cardul" },
    ],
    link: { href: bankPages.savings, label: "„Plătești și economisești” pe raiffeisen.ro" },
    source: "raiffeisen.ro: cont de economii (30.06.2026)",
  },
  zeroSimplu: {
    icon: "card",
    kind: "Pachet de cont curent",
    name: "ZERO Simplu",
    description: "Pachetul de cont curent în lei, cu card de debit, Smart Mobile și plăți instant.",
    terms: [
      { label: "Cost lunar", value: "0 lei între 18 și 24 de ani, fără condiții" },
      { label: "FixPay", value: "0 lei în pachet" },
    ],
    link: { href: bankPages.zeroSimplu, label: "Pachetul ZERO Simplu pe raiffeisen.ro" },
    source: "raiffeisen.ro: pachetul ZERO Simplu (16.10.2026)",
  },
  recurringPayments: {
    icon: "lock",
    kind: "Funcție din Smart Mobile",
    name: "Administrează plățile recurente",
    description: "În Smart Mobile vezi plățile recurente făcute cu cardul Visa și le poți bloca.",
    terms: [
      { label: "Unde", value: "Smart Mobile, la cardul Visa" },
      { label: "Atenție", value: "Blocarea plății nu anulează contractul" },
    ],
    link: { href: bankPages.recurringPayments, label: "Anunțul funcției pe raiffeisen.ro" },
    source: "comunicat Raiffeisen Bank (25.05.2026)",
  },
  // For businesses: the guarantee behind the green credit in the GreenStruct demo (design/pj-greenstruct.md §8).
  eifCompetitivitate: {
    icon: "shield",
    kind: "Garanție pentru credite IMM",
    name: "EIF Competitivitate (InvestEU)",
    description: "Fondul European de Investiții garantează o parte din creditul pentru investiții al firmei.",
    terms: [
      { label: "Garanție", value: "70% din credit; 50% în București și Ilfov" },
      { label: "Valoare", value: "Până la 1,7 mil. EUR" },
      { label: "Durată", value: "Până la 120 de luni" },
      { label: "Avans", value: "Cel puțin 15%" },
    ],
    link: { href: bankPages.eifCompetitivitate, label: "EIF Competitivitate pe raiffeisen.ro" },
    source: "raiffeisen.ro: Competitivitate EIF (27.04.2026)",
  },
};
