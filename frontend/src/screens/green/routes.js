// The green-credit flow of one area: one entry per hash route (#/verde/<area>/...), like the coach activation.
// The steps follow the GreenStruct README §7. back: the "Înapoi" link; step: position in the progress bar;
// footer: the actions at the bottom.

import { Analysis, Category, Changes, Company, Documents, Dossier, Intro, Location, Offers, Questions, Request } from "./Steps.jsx";

export const GREEN_STEPS = ["Firma", "Categoria", "Locul", "Documente", "Întrebări", "Analiza", "Ofertele", "Ce schimbi", "Cererea"];

export function greenRoutes(sector) {
  const base = `#/verde/${sector}`;
  const key = (step) => (step ? `verde/${sector}/${step}` : `verde/${sector}`);
  return {
    [key()]: {
      Screen: Intro,
      back: "#/verde",
      footer: { next: `${base}/firma`, nextLabel: "Începe", skip: "#/firma", skipLabel: "Nu acum" },
    },
    [key("firma")]: { Screen: Company, back: base, step: 1, footer: { next: `${base}/categorie`, nextLabel: "Confirm datele" } },
    [key("categorie")]: { Screen: Category, back: `${base}/firma`, step: 2, footer: { next: `${base}/unde`, nextLabel: "Continuă" } },
    [key("unde")]: { Screen: Location, back: `${base}/categorie`, step: 3, footer: { next: `${base}/documente`, nextLabel: "Continuă" } },
    [key("documente")]: { Screen: Documents, back: `${base}/unde`, step: 4, footer: { next: `${base}/intrebari`, nextLabel: "Continuă" } },
    [key("intrebari")]: { Screen: Questions, back: `${base}/documente`, step: 5, footer: { next: `${base}/analiza`, nextLabel: "Trimite la analiză" } },
    [key("analiza")]: { Screen: Analysis, back: `${base}/intrebari`, step: 6, footer: { next: `${base}/oferte`, nextLabel: "Vezi ofertele" } },
    [key("oferte")]: { Screen: Offers, back: `${base}/analiza`, step: 7, footer: { next: `${base}/schimbari`, nextLabel: "Vezi ce să schimbi" } },
    [key("schimbari")]: { Screen: Changes, back: `${base}/oferte`, step: 8, footer: { next: `${base}/cerere`, nextLabel: "Pregătește cererea" } },
    [key("cerere")]: {
      Screen: Request,
      back: `${base}/schimbari`,
      step: 9,
      footer: { next: `${base}/dosar`, nextLabel: "Trimite cererea la bancă", skip: "#/firma", skipLabel: "Salvez și revin mai târziu" },
    },
    [key("dosar")]: { Screen: Dossier, back: "#/firma", title: "Dosarul tău", footer: { next: "#/firma", nextLabel: "Înapoi la Produse" } },
  };
}
