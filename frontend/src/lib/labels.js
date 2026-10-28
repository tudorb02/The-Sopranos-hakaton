// Romanian wording for the enums of the contract. Static copy only: figures never come from here, they come from
// RunView.calcs. The `sme` maps are plain farmer language; the `officer` maps may use the bank's vocabulary.

export const MODULE_ORDER = ["irigatii", "energie", "utilaje", "zootehnie", "post_recolta", "ecologic"];

// One line per module for the cards that need an icon of the existing set.
export const MODULE_ICONS = { irigatii: "drop", energie: "sun", utilaje: "tractor", zootehnie: "flame", post_recolta: "snow", ecologic: "leaf" };

// The fictional demo farms (data/demo/farms): CUI, name and the category each one is meant for.
export const DEMO_FARMS = [
  { cui: "45871203", name: "Legume Bărăgan Demo SRL", moduleId: "irigatii" },
  { cui: "41726035", name: "Avicola Dealul Verde SRL", moduleId: "energie" },
  { cui: "38264019", name: "Agro Câmpia Bărăganului SRL", moduleId: "utilaje" },
  { cui: "47209135", name: "Ferma de Lapte Valea Demo SRL", moduleId: "zootehnie" },
  { cui: "38751946", name: "Livezile Argeș Demo SRL", moduleId: "post_recolta" },
  { cui: "41629307", name: "Ferma Bio Mureș Demo SRL", moduleId: "ecologic" },
];

// What makes an investment green, in farmer words, per indicator. {v} = the threshold value from the module config.
export const CRITERION_COPY = {
  WATER_SAVING_PCT: "O investiție în irigații e verde dacă economisește cel puțin {v}% din apa folosită acum.",
  FUEL_SAVING_PCT: "O investiție în utilaje e verde dacă reduce motorina folosită cu cel puțin {v}%.",
  ENERGY_SAVING_PCT: "O investiție e verde dacă reduce energia folosită cu cel puțin {v}%.",
  EMISSION_REDUCTION_PCT: "O investiție la fermă e verde dacă reduce emisiile cu cel puțin {v}%.",
  RENEWABLE_GENERATION: "Energia produsă din surse regenerabile e verde prin natura ei; verificăm doar locul montajului și echipamentele.",
  CERTIFIED_AREA_HA: "Terenul certificat ecologic sau în conversie este verde; verificăm certificarea și planul de conversie.",
  FERTILIZER_SAVING_PCT: "O investiție e verde dacă reduce îngrășămintele folosite cu cel puțin {v}%.",
};

export const MONTHS_RO = { JAN: "ian", FEB: "feb", MAR: "mar", APR: "apr", MAY: "mai", JUN: "iun", JUL: "iul", AUG: "aug", SEP: "sep", OCT: "oct", NOV: "nov", DEC: "dec" };
export const MONTH_LIST = Object.keys(MONTHS_RO);

export const RISK_RO = { LOW: "mic", MEDIUM: "mediu", HIGH: "mare" };

export const SME_STATUS_RO = {
  SME: "Firma ta este IMM, deci poate primi creditul verde.",
  NOT_SME: "Datele din registre arată că firma nu se încadrează ca IMM. Creditul verde se acordă doar IMM-urilor.",
  UNKNOWN: "Nu am găsit bilanțul firmei, deci nu putem confirma statutul de IMM. Poți continua, banca verifică la final.",
};

export const SOURCE_RO = {
  ANAF: "ANAF",
  APIA: "APIA",
  ANSVSA: "ANSVSA",
  OPEN_BANKING: "Open Banking",
  COPERNICUS: "harta de secetă",
  NATURA_2000: "harta Natura 2000",
  NITRATES: "harta zonelor cu nitrați",
};

// Source mode badges: the SME sees a calm word, the officer the technical one.
export const MODE_SME = { LIVE: "date reale", MOCK: "date de test", CACHE: "date salvate" };
export const MODE_OFFICER = { LIVE: "LIVE", MOCK: "MOCK", CACHE: "CACHE", GOLDEN: "GOLDEN", HYBRID: "HYBRID", REPLAY: "REPLAY" };

export const STATE_RO = {
  CREAT: "Dosar creat",
  DATE_FIRMA: "Date firmă preluate",
  AGENT_1: "Analiza tehnică",
  AGENT_2: "Structurarea creditului",
  AGENT_3: "Raportul verde",
  GATA: "Gata, netrimis",
  TRIMIS: "Trimis la bancă",
  APROBAT: "Aprobat",
  MONITORIZARE: "În monitorizare",
  ESUAT: "Eșuat",
};

// The three agents with farmer-friendly names (the SME never sees "underwriter" or "optimizator").
export const AGENTS_SME = [
  { id: "TECHNICAL_AUDITOR", name: "Verific investiția", note: "Citesc documentele și calculez cât economisești" },
  { id: "FUNDING_OPTIMIZER", name: "Compar creditele", note: "Pun alături creditul clasic și creditul verde" },
  { id: "GREEN_UNDERWRITER", name: "Pregătesc dosarul pentru bancă", note: "Strâng dovezile și condițiile" },
];
export const AGENTS_OFFICER = {
  TECHNICAL_AUDITOR: "Agent 1 · Auditor tehnic",
  FUNDING_OPTIMIZER: "Agent 2 · Structurare credit",
  GREEN_UNDERWRITER: "Agent 3 · Underwriter verde",
};

// Plain lines for the tool calls, as the SME sees them. Anything not listed shows a neutral line, so internal names
// (funds, pricing, DSCR) never reach the SME even if the event text mentions them.
export const TOOL_LINES_SME = {
  get_module_rules: "Încarc regulile categoriei tale",
  extract_document: null, // the event message names the file ("Citesc documentul oferta.pdf")
  compute_baseline: "Calculez situația de acum",
  compute_indicator: "Verific dacă investiția cerută atinge pragul verde",
  search_upgrades: "Caut cea mai ieftină schimbare care duce investiția peste prag",
  simulate_upgrade_package: "Încerc schimbarea găsită, cu aceleași calcule",
  check_dnsh_inputs: "Verific dacă investiția nu strică mediul",
  list_financing_lines: "Văd ce credite se potrivesc",
  check_program_eligibility: "Verific ce condiții îndeplinești",
  build_funding_stack: "Construiesc ofertele",
  determine_green_tier: "Stabilesc nivelul verde",
  price_loan: "Calculez dobânda pentru fiecare credit",
  build_scenario: "Calculez ratele",
  check_affordability: "Verific dacă ratele încap în încasările tale",
  compute_dscr: "Verific dacă ratele încap în încasările tale",
  compare_scenarios: "Compar creditul clasic cu cel verde",
  get_labeling_rules: "Verific ce parte din investiție e verde",
  get_dnsh_criteria: "Verific condițiile de mediu",
  select_fund: "Pregătesc dosarul pentru bancă",
  check_fund_requirements: "Pregătesc dosarul pentru bancă",
  calculate_impact: "Calculez cât economisești pe an",
  get_bond_category: "Pregătesc dosarul pentru bancă",
};
export const NEUTRAL_TOOL_LINE = "Lucrez la dosarul tău";

// Words that must not reach the SME zone (README §13: the SME does not see the funds).
export const SME_HIDDEN = /\bF[1-6]\b|\bFEI\b|InvestEU|DSCR|obliga[țt]iun|BERD|\bIFC\b|garan[țt]ia FEI/i;

export const TIER_SME = {
  VERDE_PLUS: { name: "Verde Plus", text: "Investiția ta depășește mult pragul verde, deci primești cea mai mare reducere de dobândă." },
  VERDE: { name: "Verde", text: "Investiția ta atinge pragul verde și primești reducerea de dobândă standard." },
  VERDE_CU_UPGRADE: { name: "Verde cu schimbări", text: "Investiția cerută era sub prag. Cu schimbările propuse devine verde și primești reducerea standard." },
  CLASIC: { name: "Clasic", text: "Investiția nu atinge pragul verde, deci acum e posibil doar creditul clasic. Vezi ce poți schimba ca să devină verde." },
};

export const TIER_OFFICER = { VERDE_PLUS: "Verde Plus", VERDE: "Verde", VERDE_CU_UPGRADE: "Verde cu upgrade", CLASIC: "Clasic" };

export const DECISION_RO = {
  ELIGIBLE_GREEN: "Eligibil verde",
  ELIGIBLE_WITH_CONDITIONS: "Eligibil, cu condiții",
  NOT_ELIGIBLE: "Neeligibil",
};

export const CONDITION_TIMING_RO = {
  BEFORE_SIGNING: "înainte de semnare",
  BEFORE_FIRST_DISBURSEMENT: "înainte de prima tragere",
  BEFORE_FINAL_DISBURSEMENT: "înainte de tragerea finală",
  AFTER_INSTALLATION: "după instalare",
};

export const KPI_FREQUENCY_RO = { ONCE: "o dată", QUARTERLY: "trimestrial", SEMIANNUAL: "semestrial", ANNUAL: "anual" };
export const KPI_FIRST_DUE_RO = { AT_DISBURSEMENT: "la tragere", AFTER_INSTALLATION: "după instalare", MONTH_6: "la 6 luni", MONTH_12: "la 12 luni", MONTH_24: "la 24 de luni" };
export const KPI_SOURCE_RO = {
  SMART_METER: "contor inteligent",
  WATER_METER: "contor de apă",
  INVOICES: "facturi",
  OPEN_BANKING: "Open Banking",
  SATELLITE: "satelit",
  COMMISSIONING_REPORT: "proces-verbal de punere în funcțiune",
  GEOTAGGED_PHOTOS: "poze geolocalizate",
  APIA: "APIA",
  TELEMATICS: "telematică",
};

export const DNSH_OBJECTIVE_RO = {
  CLIMATE_MITIGATION: "Reducerea schimbărilor climatice",
  CLIMATE_ADAPTATION: "Adaptarea la schimbările climatice",
  WATER_MARINE_RESOURCES: "Apa și resursele marine",
  CIRCULAR_ECONOMY: "Economia circulară",
  POLLUTION_PREVENTION: "Prevenirea poluării",
  BIODIVERSITY: "Biodiversitatea",
};
export const DNSH_STATUS_RO = { PASS: "Trece", PASS_WITH_CONDITIONS: "Trece cu condiții", FAIL: "Nu trece", MISSING_DATA: "Date lipsă" };

export const REQUIREMENT_RO = {
  SME_STATUS: "Firma e IMM",
  ELIGIBLE_CATEGORY: "Categorie de investiție eligibilă",
  TECHNICAL_THRESHOLD: "Pragul tehnic atins, cu dovezi",
  DNSH: "Nu face rău semnificativ mediului (DNSH)",
  IMPACT_QUANTIFIED: "Impact cuantificat",
  CLIENT_BENEFIT: "Beneficiul ajunge la client",
  PERIODIC_REPORTING: "Raportare periodică",
};
export const REQUIREMENT_STATUS_RO = { MET: "Îndeplinită", TO_CONFIRM: "De confirmat", NOT_MET: "Neîndeplinită" };
export const FUND_STATUS_RO = { AVAILABLE: "Disponibil", TO_CONFIRM: "De confirmat", NOT_AVAILABLE: "Indisponibil" };
export const FUND_ROLE_RO = { PRIMARY: "Fond propus", ALTERNATIVE: "Alternativă" };

// Names of the funds (README §3.1; the figures and terms live in config/funds.json). The report carries only the code.
export const FUND_NAMES = {
  F1: "Garanția FEI InvestEU de sustenabilitate",
  F2: "Obligațiunile verzi și sustenabile Raiffeisen",
  F3: "Credit BIO",
  F4: "Finanțare pentru irigații cu FEI",
  F5: "Prefinanțarea subvențiilor APIA",
  F6: "Granturi AFIR / PNS",
};

export const BOND_CATEGORY_RO = {
  AGRICULTURE_FORESTRY: "Agriculture and forestry",
  RENEWABLE_ENERGY: "Renewable energy",
  ENERGY_EFFICIENCY: "Energy efficiency",
  CLEAN_TRANSPORTATION: "Clean transportation",
  POLLUTION_PREVENTION_CONTROL: "Pollution prevention and control",
  NONE: "Nicio categorie",
};

export const LABEL_RO = { TAXONOMY_ALIGNED: "Aliniat taxonomiei UE", MARKET_GREEN: "Verde de piață (LMA)", TRANSITION: "Tranziție", NONE: "Fără etichetă" };
export const SEVERITY_RO = { LOW: "mică", MEDIUM: "medie", HIGH: "mare" };

export const RATE_COMPONENT_RO = {
  FUNDING_COST: "Cost de finanțare",
  RISK_COST: "Cost de risc",
  CAPITAL_COST: "Cost de capital",
  OPERATIONAL_COST: "Cost operațional",
  TARGET_PROFIT: "Profit țintă",
  PROGRAM_SUBSIDY: "Subvenție / comision redus pe program",
  TIER_ADJUSTMENT: "Ajustare pe nivelul verde",
};

export const COLLATERAL_OFFICER = { MORTGAGE: "Ipotecă", GUARANTEE_INVESTEU_FEI: "Garanție FEI InvestEU" };

export const DRIVER_RO = {
  GRANT: "Grant",
  INVESTMENT_DELTA: "Investiția suplimentară",
  INTEREST: "Dobânzi",
  OPERATING_SAVINGS: "Economii de exploatare",
  COLLATERAL_COSTS: "Costul ipotecii",
  BRIDGE_COST: "Cost de punte",
};

export const DOC_TYPE_RO = {
  OFFER: "Oferta / proforma",
  TECHNICAL_SHEET: "Fișa tehnică",
  CURRENT_EQUIPMENT: "Echipamentul actual",
  WATER_PERMIT_ANAR: "Autorizația de gospodărire a apelor",
  WATER_CONSUMPTION: "Consumul de apă",
  ENERGY_INVOICES: "Facturi de energie",
  FUEL_INVOICES: "Facturi de motorină",
  FERTILIZER_INVOICES: "Facturi de îngrășăminte",
  BUSINESS_PLAN: "Plan de afaceri",
  ENVIRONMENTAL_PERMIT: "Autorizație de mediu",
  CERTIFICATION_CONTRACT: "Contract / certificat de certificare",
  FINAL_INVOICE: "Factura finală",
  COMMISSIONING_REPORT: "Proces-verbal de punere în funcțiune",
  GEOTAGGED_PHOTOS: "Poze geolocalizate",
  AFIR_APPLICATION: "Cerere AFIR",
  AFIR_FINANCING_CONTRACT: "Contract de finanțare AFIR",
  GUARANTEE_APPROVAL: "Aprobarea garanției",
  CROP_INSURANCE: "Asigurarea culturilor",
  SCRAPPING_CERTIFICATE: "Certificat de casare",
  WATER_METER_CERTIFICATE: "Certificat contor de apă",
  OTHER: "Alt document",
};

export const EXTRACTION_FIELD_RO = {};

export const UNIT_RO = { KG_N_PER_HA: "kg N/ha", T_PER_HA: "t/ha", HA: "ha", HOURS: "ore", EUR: "EUR", M: "m" };

export const RECOMMENDATION_TYPE_RO = {
  KEEP_INITIAL: "Investiția cerută rămâne așa cum e",
  UPGRADE_TO_PASS: "Investiția cerută + upgrade, ca să treacă pragul",
  UPGRADE_BEYOND_REQUEST: "Investiția cerută + upgrade peste prag",
  NO_FEASIBLE_UPGRADE: "Nu există upgrade fezabil",
};

export const SCHEDULE_TYPE_RO = { EQUAL_MONTHLY: "Rate lunare egale", SEASONAL: "Rate după calendarul încasărilor" };
export const AFFORDABILITY_RO = { PASS: "Trece", PASS_WITH_WARNING: "Trece, cu avertisment", FAIL: "Nu trece" };

export const SOURCE_BADGE = { LIVE: "LIVE", CACHE: "CACHE", GOLDEN: "GOLDEN", RETRY: "RETRY", FALLBACK: "FALLBACK" };

export const ERROR_HINTS = {
  NETWORK: "Verifică dacă backend-ul rulează pe portul 8080.",
};

// "2027-02" -> "feb 2027"
export function periodLabel(period) {
  const [year, month] = period.split("-");
  const name = Object.values(MONTHS_RO)[Number(month) - 1];
  return `${name} ${year}`;
}
export const periodMonth = (period) => Object.values(MONTHS_RO)[Number(period.split("-")[1]) - 1];
