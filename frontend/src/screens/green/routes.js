// The green-credit flow of one area: one entry per hash route (#/verde/<area>/...), like the coach activation.
// back: the "Înapoi" link; step: position in the progress bar; footer: the actions at the bottom.

import { Analysis, Company, Documents, Dossier, Intro, Investment, Location, Offer, Questions } from "./Steps.jsx";

export const GREEN_STEPS = ["Firma", "Investiția", "Locul", "Documente", "Întrebări", "Analiza", "Oferta"];

export function greenRoutes(sector) {
  const base = `#/verde/${sector}`;
  const key = (step) => (step ? `verde/${sector}/${step}` : `verde/${sector}`);
  return {
    [key()]: {
      Screen: Intro,
      back: "#/verde",
      footer: { next: `${base}/firma`, nextLabel: "Începe", skip: "#/firma", skipLabel: "Nu acum" },
    },
    [key("firma")]: { Screen: Company, back: base, step: 1, footer: { next: `${base}/investitie`, nextLabel: "Confirm datele" } },
    [key("investitie")]: { Screen: Investment, back: `${base}/firma`, step: 2, footer: { next: `${base}/unde`, nextLabel: "Continuă" } },
    [key("unde")]: { Screen: Location, back: `${base}/investitie`, step: 3, footer: { next: `${base}/documente`, nextLabel: "Continuă" } },
    [key("documente")]: { Screen: Documents, back: `${base}/unde`, step: 4, footer: { next: `${base}/intrebari`, nextLabel: "Continuă" } },
    [key("intrebari")]: { Screen: Questions, back: `${base}/documente`, step: 5, footer: { next: `${base}/analiza`, nextLabel: "Trimite la analiză" } },
    [key("analiza")]: { Screen: Analysis, back: `${base}/intrebari`, step: 6, footer: { next: `${base}/oferta`, nextLabel: "Vezi oferta" } },
    [key("oferta")]: {
      Screen: Offer,
      back: `${base}/analiza`,
      step: 7,
      footer: { next: `${base}/dosar`, nextLabel: "Trimite cererea la bancă", skip: "#/firma", skipLabel: "Salvez și revin mai târziu" },
    },
    [key("dosar")]: { Screen: Dossier, back: "#/firma", title: "Dosarul tău", footer: { next: "#/firma", nextLabel: "Înapoi la Produse" } },
  };
}
