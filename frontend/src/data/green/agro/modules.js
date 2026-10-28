// The agricultural pack (design/pj-greenstruct.md §1), aligned with the GreenStruct README (branch B2B_Agro,
// 28.10.2026, §5–§7): the 6 categories, what each one asks for and its green threshold. Mirrors the backend's
// categories/ config; the thresholds are proposals to confirm with the Raiffeisen mentors (README §13).

export const sectorName = "Agricultură";

// The client-facing voice of the three agents is one consultant that helps prepare the credit application.
export const intro = {
  title: "Pregătim împreună cererea de credit",
  lead: "Pregătești tot dosarul în aplicație, cu un consultant. Îți arată, pe lângă creditul clasic, un credit verde cu dobândă mai mică, ce să schimbi ca investiția să devină verde și ce clauze să ceri. Banca mai dă doar aprobarea finală.",
  duration: "Circa 10 minute, cu documentele la îndemână",
  steps: [
    "Confirmi datele firmei, luate din ANAF, APIA și din conturi",
    "Alegi categoria investiției și parcelele",
    "Încarci doar documentele esențiale ale categoriei",
    "Răspunzi la câteva întrebări, completate unde se poate",
    "Compari creditul clasic cu cel verde și vezi ce să schimbi",
    "Consultantul îți verifică cererea înainte s-o trimiți",
  ],
  does: [
    "Îți spune ce lipsește din dosar și ce îi crește șansele de aprobare",
    "Caută cea mai ieftină schimbare care face investiția verde",
    "Potrivește ratele cu lunile în care încasezi",
    "Îți arată clauzele pe care le poți cere în contract",
  ],
  doesNot: [
    "Nu ascunde și nu înfrumusețează date: dosarul trebuie să fie corect",
    "Nu promite aprobarea: aprobarea finală o dă banca",
    "Nu face calculele: cifrele le calculează banca, după formule fixe",
  ],
  bring: ["Oferta sau factura proformă, cu fișa tehnică", "Pentru irigații: autorizația de gospodărire a apelor (ANAR)"],
};

// Asked for any investment (README §5.2).
export const generalDocuments = [
  { id: "oferta", name: "Oferta sau factura proformă, cu fișa tehnică", required: true },
  { id: "loc", name: "Parcelele investiției", required: true },
];

export const commonQuestions = [
  {
    id: "echipament-vechi",
    label: "Ce faci cu echipamentul vechi?",
    options: ["Îl predau la reciclare autorizată", "Îl vând", "Îl păstrez"],
  },
];

// criterion: what makes the investment green, in plain words. required: essential (✅ in the README);
// otherwise optional (⚪), it only makes the estimate more precise.
export const modules = [
  {
    id: "irigatii",
    name: "Irigații",
    icon: "drop",
    example: "Picurare, aspersie cu senzori",
    criterion: "O investiție în irigații e verde dacă economisește cel puțin 25% din apa folosită acum.",
    documents: [
      { id: "anar", name: "Autorizația de gospodărire a apelor (ANAR)", required: true },
      { id: "consum", name: "Consumul real de apă sau facturile de energie pentru pompare", required: false },
    ],
    questions: [
      { id: "sistem-actual", label: "Cum irigi acum?", options: ["Prin brazde", "Prin aspersie", "Nu irig încă"] },
      { id: "sursa-apei", label: "De unde iei apa?", options: ["Puț", "Râu", "Canal", "Rețea"] },
      { id: "pompare", label: "Adâncimea sau înălțimea de pompare", type: "text", suffix: "m", numeric: true },
      { id: "culturi-irigate", label: "Culturile și hectarele irigate", type: "textarea" },
    ],
  },
  {
    id: "energie",
    name: "Energie la fermă",
    icon: "sun",
    example: "Panouri solare, pompe solare, agrivoltaic",
    criterion: "Energia regenerabilă e verde prin natura investiției. Verificăm doar echipamentele și locul montajului.",
    documents: [
      { id: "facturi-energie", name: "Facturile de energie pe ultimele 12 luni", required: true },
      { id: "racordare", name: "Avizul de racordare", required: false },
    ],
    questions: [
      { id: "loc-montaj", label: "Unde montezi panourile?", options: ["Pe acoperiș", "Pe teren neproductiv", "Agrivoltaic, deasupra culturilor"] },
      { id: "suprafata", label: "Suprafața disponibilă", type: "text", suffix: "m²", numeric: true },
      { id: "motorina-pompa", label: "Câtă motorină consumă pe an pompa actuală?", type: "text", suffix: "l/an", numeric: true },
    ],
  },
  {
    id: "utilaje",
    name: "Utilaje și precizie",
    icon: "tractor",
    example: "Tractor, GPS, dozare variabilă, no-till",
    criterion: "Investiția e verde dacă reduce cu cel puțin 20% motorina sau azotul pe hectar, iar motorul nou respectă norma Stage V.",
    documents: [
      { id: "facturi-motorina", name: "Facturile de motorină pe ultimele 12 luni", required: true },
      { id: "facturi-azot", name: "Facturile de îngrășăminte cu azot pe 12 luni, pentru investițiile de precizie", required: true },
    ],
    questions: [
      { id: "utilaj-vechi", label: "Utilajul înlocuit: anul de fabricație și puterea", type: "text" },
      { id: "lucrare-sol", label: "Cum lucrezi solul?", options: ["Arătură", "Lucrări minime", "Fără arătură (no-till)"] },
    ],
  },
  {
    id: "biogaz",
    name: "Zootehnie și biogaz",
    icon: "flame",
    example: "Digestor, stocare acoperită a gunoiului",
    criterion: "Investiția e verde dacă reduce cu cel puțin 50% emisiile din gunoiul de grajd și îl valorifică.",
    documents: [
      { id: "mediu", name: "Autorizația de mediu sau cererea depusă", required: true },
      { id: "facturi-energie", name: "Facturile de energie pe 12 luni", required: false },
    ],
    questions: [
      { id: "stocare", label: "Cum stochezi acum gunoiul de grajd?", options: ["Platformă descoperită", "Platformă acoperită", "Bazin"] },
      { id: "digestat", label: "Ce faci cu digestatul?", options: ["Îl folosesc ca îngrășământ", "Îl vând"] },
    ],
  },
  {
    id: "postrecolta",
    name: "Post-recoltă",
    icon: "snow",
    example: "Depozite frigorifice, uscătoare, sere",
    criterion: "Investiția e verde dacă economisește cel puțin 20% din energie.",
    documents: [
      { id: "facturi-energie", name: "Facturile de energie (curent și gaz) pe ultimele 12 luni", required: true },
      { id: "fisa-veche", name: "Fișa echipamentului vechi", required: false },
    ],
    questions: [
      { id: "produs", label: "Ce depozitezi, usuci sau cultivi și cât?", type: "text" },
      { id: "luni", label: "Câte luni pe an funcționează?", type: "text", suffix: "luni", numeric: true },
    ],
  },
  {
    id: "ecologic",
    name: "Ecologic",
    icon: "leaf",
    example: "Conversie la agricultura ecologică",
    criterion: "Investiția e verde cu certificare ecologică UE sau cu un contract de conversie.",
    documents: [
      { id: "certificare", name: "Contractul cu organismul de certificare sau certificatul", required: true },
      { id: "conversie", name: "Planul de conversie", required: false },
    ],
    questions: [
      { id: "ha-bio", label: "Câte hectare treci la bio și din ce an?", type: "text" },
      { id: "azot-acum", label: "Câte îngrășăminte cu azot folosești acum?", type: "text", suffix: "kg N/ha", numeric: true },
    ],
  },
];
