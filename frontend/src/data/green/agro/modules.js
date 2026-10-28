// The agricultural pack (design/pj-greenstruct.md §1): its modules, the documents it asks for and the
// farm questionnaire. Mirrors config/sectors/agro/ in the team plan; the thresholds are proposals to confirm
// with the Raiffeisen mentors (README §3).

export const sectorName = "Agricultură";

export const intro = {
  title: "Credit verde pentru fermă",
  lead: "Verificăm dacă investiția ta poate primi un credit verde. Un credit verde poate avea dobândă mai mică, garanție FEI în loc de ipotecă și rate după recoltă. Dacă investiția nu se încadrează, îți arătăm ce s-ar putea schimba.",
  duration: "Circa 10 minute, cu documentele la îndemână",
  steps: [
    "Confirmi datele firmei, luate din ANAF și APIA",
    "Alegi investiția și parcelele",
    "Încarci oferta și câteva documente",
    "Răspunzi la 10 întrebări despre fermă",
    "Primești comparația dintre creditul standard și cel verde",
  ],
  bring: ["Oferta sau factura proformă, cu fișa tehnică", "Ce înlocuiești acum: fișa tehnică, o poză cu eticheta sau o descriere", "Pentru irigații: autorizația de gospodărire a apelor și consumul actual"],
};

// Documents asked for any investment, in every area.
export const generalDocuments = [
  { id: "oferta", name: "Oferta sau factura proformă, cu fișa tehnică" },
  { id: "actual", name: "Ce înlocuiești acum" },
  { id: "loc", name: "Parcelele investiției" },
];

// criterion: what makes the investment green, in plain words for the farmer.
export const modules = [
  {
    id: "irigatii",
    name: "Irigații",
    icon: "drop",
    example: "Picurare, aspersie cu senzori",
    criterion: "O investiție în irigații e verde dacă economisește cel puțin 25% din apa folosită acum.",
    documents: [
      { id: "anar", name: "Autorizația de gospodărire a apelor (ANAR)" },
      { id: "consum", name: "Consumul actual de apă sau energia de pompare" },
    ],
  },
  {
    id: "energie",
    name: "Energie la fermă",
    icon: "sun",
    example: "Panouri solare, pompe solare, agrivoltaic",
    criterion: "Energia din surse regenerabile e verde prin natura investiției.",
    documents: [{ id: "facturi-energie", name: "Facturile de energie pe 12 luni" }, { id: "suprafata", name: "Suprafața disponibilă" }],
  },
  {
    id: "utilaje",
    name: "Utilaje și precizie",
    icon: "tractor",
    example: "Tractoare eficiente, GPS, dozare variabilă",
    criterion: "O investiție în utilaje e verde dacă reduce cu cel puțin 20% motorina sau îngrășămintele pe hectar.",
    documents: [{ id: "facturi-motorina", name: "Facturile de motorină și de îngrășăminte pe 12 luni" }, { id: "hectare", name: "Hectarele lucrate" }],
  },
  {
    id: "biogaz",
    name: "Zootehnie și biogaz",
    icon: "flame",
    example: "Digestor, stocarea gunoiului de grajd",
    criterion: "O investiție în zootehnie e verde dacă reduce emisiile și valorifică deșeurile.",
    documents: [{ id: "stocare", name: "Sistemul actual de stocare a gunoiului de grajd" }, { id: "mediu", name: "Autorizația de mediu" }],
  },
  {
    id: "postrecolta",
    name: "Post-recoltă",
    icon: "snow",
    example: "Depozite frigorifice, uscătoare, sere",
    criterion: "O investiție post-recoltă e verde dacă economisește cel puțin 20% din energie.",
    documents: [{ id: "facturi-energie", name: "Facturile de energie pe 12 luni" }, { id: "capacitate", name: "Capacitatea de stocare" }],
  },
  {
    id: "ecologic",
    name: "Ecologic și regenerativ",
    icon: "leaf",
    example: "Conversie bio, culturi de acoperire",
    criterion: "Investiția e verde dacă ferma are sau obține certificare ecologică UE.",
    documents: [{ id: "certificare", name: "Contractul cu organismul de certificare sau certificatul" }, { id: "conversie", name: "Planul de conversie" }],
  },
];

const MONTHS = ["Ian.", "Feb.", "Mar.", "Apr.", "Mai", "Iun.", "Iul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

// The farm questionnaire (README §7). type: "choice" (default), "text" or "textarea".
export const questionGroups = [
  {
    title: "Culturi și sol",
    items: [
      { id: "culturi", label: "Culturile principale și producția medie pe ultimii 3 ani", type: "textarea" },
      { id: "azot", label: "Câte îngrășăminte cu azot folosești?", type: "text", suffix: "kg/ha", numeric: true },
      { id: "sol", label: "Cum lucrezi solul?", options: ["Arătură", "Lucrări minime", "Fără arătură (no-till)"] },
      { id: "rotatie", label: "Folosești culturi de acoperire sau rotație?", options: ["Rotație", "Culturi de acoperire", "Niciuna"] },
    ],
  },
  {
    title: "Apă",
    items: [{ id: "irigare", label: "Irigi acum? Cu ce sistem?", options: ["Da, prin aspersie", "Da, prin brazde", "Da, prin picurare", "Nu"] }],
  },
  {
    title: "Riscuri și certificări",
    items: [
      { id: "asigurare", label: "Ai asigurare pentru culturi?", options: ["Da", "Nu"] },
      { id: "certificari", label: "Ai certificări?", options: ["Ecologic", "GlobalGAP", "Niciuna"] },
    ],
  },
  {
    title: "Vânzări",
    items: [
      { id: "contracte", label: "Ai contracte de vânzare cu procesatori sau retaileri?", options: ["Da", "Nu"] },
      { id: "incasari", label: "În ce luni încasezi cel mai mult?", options: MONTHS },
    ],
  },
  {
    title: "Deșeuri",
    items: [
      {
        id: "deseuri",
        label: "Ce faci cu utilajul vechi și cu deșeurile (ambalaje, folie)?",
        options: ["Vând utilajul", "Casez utilajul", "Predau ambalajele și folia unui colector autorizat", "Altceva"],
      },
    ],
  },
];
