// The static copy of the agricultural flow (design/pj-greenstruct.md §1): the welcome screen. The categories, documents,
// questions, thresholds and every figure come from the backend (GET /api/modules, GET /api/runs/{id}).

export const sectorName = "Agriculture";

// The client-facing voice of the three agents is one voice that helps prepare the credit application.
export const intro = {
  title: "Let's prepare the credit application together",
  lead: "You prepare the whole dossier in the app. Next to the classic credit, it shows you a green credit with a lower interest rate, what to change so the investment becomes green and which clauses to ask for. The bank only gives the final approval.",
  duration: "About 10 minutes, with the documents at hand",
  steps: [
    "You confirm the company data, taken from ANAF, APIA and your accounts",
    "You choose the parcels",
    "You upload the offer: we recognise the investment you want to make, then ask for the other essential documents",
    "You answer a few questions, prefilled where possible",
    "You compare the classic credit with the green one and see what to change",
    "We check your application before you send it",
  ],
  does: [
    "Tells you what is missing from the dossier and what improves its chances of approval",
    "Looks for the cheapest change that makes the investment green",
    "Matches the instalments to the months when you get paid",
    "Shows you the clauses you can ask for in the contract",
  ],
  doesNot: [
    "Does not hide or embellish data: the dossier must be accurate",
    "Does not promise approval: the bank gives the final approval",
    "Does not do the calculations: the bank calculates the figures with fixed formulas",
  ],
  bring: ["The offer or pro forma invoice, with the technical data sheet", "For irrigation: the water management permit (ANAR)"],
};
