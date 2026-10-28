// The static copy of the agricultural flow (design/pj-greenstruct.md §1): the welcome screen. The categories, documents,
// questions, thresholds and every figure come from the backend (GET /api/modules, GET /api/runs/{id}).

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
