// English wording for the enums of the contract. Static copy only: figures never come from here, they come from
// RunView.calcs. The `sme` maps are plain farmer language; the `officer` maps may use the bank's vocabulary.

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

export const MONTHS_RO = { JAN: "Jan", FEB: "Feb", MAR: "Mar", APR: "Apr", MAY: "May", JUN: "Jun", JUL: "Jul", AUG: "Aug", SEP: "Sep", OCT: "Oct", NOV: "Nov", DEC: "Dec" };
export const MONTH_LIST = Object.keys(MONTHS_RO);

export const RISK_RO = { LOW: "low", MEDIUM: "medium", HIGH: "high" };

export const SME_STATUS_RO = {
  SME: "Your company is an SME, so it can get the green credit.",
  NOT_SME: "The registry data shows the company does not qualify as an SME. The green credit is granted to SMEs only.",
  UNKNOWN: "We could not find the company's balance sheet, so we cannot confirm its SME status. You can continue; the bank checks at the end.",
};

export const SOURCE_RO = {
  ANAF: "ANAF",
  APIA: "APIA",
  ANSVSA: "ANSVSA",
  OPEN_BANKING: "Open Banking",
  COPERNICUS: "drought map",
  NATURA_2000: "Natura 2000 map",
  NITRATES: "nitrate zones map",
};

// Source mode badges for the officer.
export const MODE_OFFICER = { LIVE: "LIVE", MOCK: "MOCK", CACHE: "CACHE", GOLDEN: "GOLDEN", HYBRID: "HYBRID", REPLAY: "REPLAY" };

export const STATE_RO = {
  CREAT: "Dossier created",
  DATE_FIRMA: "Company data loaded",
  AGENT_1: "Technical analysis",
  AGENT_2: "Credit structuring",
  AGENT_3: "Green report",
  GATA: "Ready, not sent",
  TRIMIS: "Sent to the bank",
  APROBAT: "Approved",
  MONITORIZARE: "Under monitoring",
  ESUAT: "Failed",
};

export const AGENTS_OFFICER = {
  TECHNICAL_AUDITOR: "Agent 1 · Technical auditor",
  FUNDING_OPTIMIZER: "Agent 2 · Credit structuring",
  GREEN_UNDERWRITER: "Agent 3 · Green underwriter",
};

// Plain lines for the tool calls, as the SME sees them. Anything not listed shows a neutral line, so internal names
// (funds, pricing, DSCR) never reach the SME even if the event text mentions them.
export const TOOL_LINES_SME = {
  get_module_rules: "Loading the rules of your category",
  extract_document: null, // the event message names the file ("Reading the document oferta.pdf")
  compute_baseline: "Working out where you stand today",
  compute_indicator: "Checking whether the requested investment reaches the green threshold",
  search_upgrades: "Looking for the cheapest change that takes the investment over the threshold",
  simulate_upgrade_package: "Trying the change found, with the same calculations",
  check_dnsh_inputs: "Checking that the investment does not harm the environment",
  list_financing_lines: "Seeing which credits fit",
  check_program_eligibility: "Checking which conditions you meet",
  build_funding_stack: "Building the offers",
  determine_green_tier: "Setting the green level",
  price_loan: "Working out the interest rate for each credit",
  build_scenario: "Working out the instalments",
  check_affordability: "Checking that the instalments fit your income",
  compute_dscr: "Checking that the instalments fit your income",
  compare_scenarios: "Comparing the classic credit with the green one",
  get_labeling_rules: "Checking which part of the investment is green",
  get_dnsh_criteria: "Checking the environmental conditions",
  select_fund: "Preparing the dossier for the bank",
  check_fund_requirements: "Preparing the dossier for the bank",
  calculate_impact: "Working out how much you save per year",
  get_bond_category: "Preparing the dossier for the bank",
};
export const NEUTRAL_TOOL_LINE = "Working on your dossier";

// Words that must not reach the SME zone (README §13: the SME does not see the funds).
export const SME_HIDDEN = /\bF[1-6]\b|\bEIF\b|\bFEI\b|InvestEU|DSCR|\bbonds?\b|\bguarantees?\b|\bfunds?\b|\bEBRD\b|\bBERD\b|\bIFC\b|Open Banking consent/i;

export const TIER_SME = {
  VERDE_PLUS: { name: "Green Plus", text: "Your investment goes well beyond the green threshold, so you get the biggest interest rate discount." },
  VERDE: { name: "Green", text: "Your investment reaches the green threshold and you get the standard interest rate discount." },
  VERDE_CU_UPGRADE: { name: "Green with changes", text: "The requested investment was below the threshold. With the proposed changes it becomes green and you get the standard discount." },
  CLASIC: { name: "Classic", text: "The investment does not reach the green threshold, so for now only the classic credit is possible. See what you can change to make it green." },
};

export const TIER_OFFICER = { VERDE_PLUS: "Green Plus", VERDE: "Green", VERDE_CU_UPGRADE: "Green with upgrade", CLASIC: "Classic" };

export const DECISION_RO = {
  ELIGIBLE_GREEN: "Eligible green",
  ELIGIBLE_WITH_CONDITIONS: "Eligible, with conditions",
  NOT_ELIGIBLE: "Not eligible",
};

export const CONDITION_TIMING_RO = {
  BEFORE_SIGNING: "before signing",
  BEFORE_FIRST_DISBURSEMENT: "before the first drawdown",
  BEFORE_FINAL_DISBURSEMENT: "before the final drawdown",
  AFTER_INSTALLATION: "after installation",
};

export const KPI_FREQUENCY_RO = { ONCE: "once", QUARTERLY: "quarterly", SEMIANNUAL: "half-yearly", ANNUAL: "annually" };
export const KPI_FIRST_DUE_RO = { AT_DISBURSEMENT: "at drawdown", AFTER_INSTALLATION: "after installation", MONTH_6: "at 6 months", MONTH_12: "at 12 months", MONTH_24: "at 24 months" };
export const KPI_SOURCE_RO = {
  SMART_METER: "smart meter",
  WATER_METER: "water meter",
  INVOICES: "invoices",
  OPEN_BANKING: "Open Banking",
  SATELLITE: "satellite",
  COMMISSIONING_REPORT: "commissioning report",
  GEOTAGGED_PHOTOS: "geotagged photos",
  APIA: "APIA",
  TELEMATICS: "telematics",
};

export const DNSH_OBJECTIVE_RO = {
  CLIMATE_MITIGATION: "Climate change mitigation",
  CLIMATE_ADAPTATION: "Climate change adaptation",
  WATER_MARINE_RESOURCES: "Water and marine resources",
  CIRCULAR_ECONOMY: "Circular economy",
  POLLUTION_PREVENTION: "Pollution prevention",
  BIODIVERSITY: "Biodiversity",
};
export const DNSH_STATUS_RO = { PASS: "Passes", PASS_WITH_CONDITIONS: "Passes with conditions", FAIL: "Fails", MISSING_DATA: "Missing data" };

export const REQUIREMENT_RO = {
  SME_STATUS: "The company is an SME",
  ELIGIBLE_CATEGORY: "Eligible investment category",
  TECHNICAL_THRESHOLD: "Technical threshold met, with evidence",
  DNSH: "Does no significant harm to the environment (DNSH)",
  IMPACT_QUANTIFIED: "Impact quantified",
  CLIENT_BENEFIT: "Benefit passed on to the client",
  PERIODIC_REPORTING: "Periodic reporting",
};
export const REQUIREMENT_STATUS_RO = { MET: "Met", TO_CONFIRM: "To be confirmed", NOT_MET: "Not met" };
export const FUND_STATUS_RO = { AVAILABLE: "Available", TO_CONFIRM: "To be confirmed", NOT_AVAILABLE: "Not available" };
export const FUND_ROLE_RO = { PRIMARY: "Proposed fund", ALTERNATIVE: "Alternative" };

// Names of the funds (README §3.1; the figures and terms live in config/funds.json). The report carries only the code.
export const FUND_NAMES = {
  F1: "EIF InvestEU sustainability guarantee",
  F2: "Raiffeisen green and sustainable bonds",
  F3: "BIO credit",
  F4: "Irrigation financing with the EIF",
  F5: "APIA subsidy pre-financing",
  F6: "AFIR / PNS grants",
};

export const BOND_CATEGORY_RO = {
  AGRICULTURE_FORESTRY: "Agriculture and forestry",
  RENEWABLE_ENERGY: "Renewable energy",
  ENERGY_EFFICIENCY: "Energy efficiency",
  CLEAN_TRANSPORTATION: "Clean transportation",
  POLLUTION_PREVENTION_CONTROL: "Pollution prevention and control",
  NONE: "No category",
};

export const LABEL_RO = { TAXONOMY_ALIGNED: "EU Taxonomy aligned", MARKET_GREEN: "Market green (LMA)", TRANSITION: "Transition", NONE: "No label" };
export const SEVERITY_RO = { LOW: "low", MEDIUM: "medium", HIGH: "high" };

export const RATE_COMPONENT_RO = {
  FUNDING_COST: "Funding cost",
  RISK_COST: "Risk cost",
  CAPITAL_COST: "Cost of capital",
  OPERATIONAL_COST: "Operating cost",
  TARGET_PROFIT: "Target profit",
  PROGRAM_SUBSIDY: "Subsidy / reduced programme fee",
  TIER_ADJUSTMENT: "Green tier adjustment",
};

export const COLLATERAL_OFFICER = { MORTGAGE: "Mortgage", GUARANTEE_INVESTEU_FEI: "EIF InvestEU guarantee" };

export const DRIVER_RO = {
  GRANT: "Grant",
  INVESTMENT_DELTA: "Additional investment",
  INTEREST: "Interest",
  OPERATING_SAVINGS: "Operating savings",
  COLLATERAL_COSTS: "Mortgage cost",
  BRIDGE_COST: "Bridge cost",
};

export const DOC_TYPE_RO = {
  OFFER: "Offer / pro forma",
  TECHNICAL_SHEET: "Technical data sheet",
  CURRENT_EQUIPMENT: "Current equipment",
  WATER_PERMIT_ANAR: "Water management permit",
  WATER_CONSUMPTION: "Water consumption",
  ENERGY_INVOICES: "Energy invoices",
  FUEL_INVOICES: "Diesel invoices",
  FERTILIZER_INVOICES: "Fertiliser invoices",
  BUSINESS_PLAN: "Business plan",
  ENVIRONMENTAL_PERMIT: "Environmental permit",
  CERTIFICATION_CONTRACT: "Certification contract / certificate",
  FINAL_INVOICE: "Final invoice",
  COMMISSIONING_REPORT: "Commissioning report",
  GEOTAGGED_PHOTOS: "Geotagged photos",
  AFIR_APPLICATION: "AFIR application",
  AFIR_FINANCING_CONTRACT: "AFIR financing contract",
  GUARANTEE_APPROVAL: "Guarantee approval",
  CROP_INSURANCE: "Crop insurance",
  SCRAPPING_CERTIFICATE: "Scrapping certificate",
  WATER_METER_CERTIFICATE: "Water meter certificate",
  OTHER: "Other document",
};

export const UNIT_RO = { KG_N_PER_HA: "kg N/ha", T_PER_HA: "t/ha", HA: "ha", HOURS: "hours", EUR: "EUR", M: "m" };

export const RECOMMENDATION_TYPE_RO = {
  KEEP_INITIAL: "The requested investment stays as it is",
  UPGRADE_TO_PASS: "Requested investment + upgrade, to pass the threshold",
  UPGRADE_BEYOND_REQUEST: "Requested investment + upgrade beyond the threshold",
  NO_FEASIBLE_UPGRADE: "No feasible upgrade",
};

export const SCHEDULE_TYPE_RO = { EQUAL_MONTHLY: "Equal monthly instalments", SEASONAL: "Instalments following the income calendar" };
export const AFFORDABILITY_RO = { PASS: "Passes", PASS_WITH_WARNING: "Passes, with a warning", FAIL: "Fails" };

export const periodMonth = (period) => Object.values(MONTHS_RO)[Number(period.split("-")[1]) - 1];
