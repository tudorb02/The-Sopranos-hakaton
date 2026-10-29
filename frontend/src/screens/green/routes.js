// The green-credit flow of one area: one entry per hash route (#/verde/<area>/...), like the coach activation.
// The steps follow the GreenStruct README §7. back: the "Back" link; step: position in the progress bar;
// footer: static actions at the bottom (the welcome screen). `actions: true` = the screen renders its own actions in the
// footer slot (components/live.jsx Actions), because they depend on what the API returned.

import { Analysis } from "./agro/Analysis.jsx";
import { Changes } from "./agro/Changes.jsx";
import { Company } from "./agro/Company.jsx";
import { Documents } from "./agro/Documents.jsx";
import { Dossier } from "./agro/Dossier.jsx";
import { Location } from "./agro/Location.jsx";
import { Offers } from "./agro/Offers.jsx";
import { Questions } from "./agro/Questions.jsx";
import { Request } from "./agro/Request.jsx";
import { Intro } from "./Intro.jsx";

export const GREEN_STEPS = ["Company", "Location", "Documents", "Questions", "Offers", "Changes", "Application"];

export function greenRoutes(sector) {
  const base = `#/verde/${sector}`;
  const key = (step) => (step ? `verde/${sector}/${step}` : `verde/${sector}`);
  return {
    [key()]: {
      Screen: Intro,
      back: "#/verde",
      footer: { next: `${base}/firma`, nextLabel: "Start", skip: "#/firma", skipLabel: "Not now" },
    },
    [key("firma")]: { Screen: Company, back: base, step: 1, actions: true },
    [key("unde")]: { Screen: Location, back: `${base}/firma`, step: 2, actions: true },
    [key("documente")]: { Screen: Documents, back: `${base}/unde`, step: 3, actions: true },
    [key("intrebari")]: { Screen: Questions, back: `${base}/documente`, step: 4, actions: true },
    [key("analiza")]: { Screen: Analysis, back: `${base}/intrebari`, step: 4, actions: true },
    [key("oferte")]: { Screen: Offers, back: `${base}/intrebari`, step: 5, actions: true },
    [key("schimbari")]: { Screen: Changes, back: `${base}/oferte`, step: 6, actions: true },
    [key("cerere")]: { Screen: Request, back: `${base}/schimbari`, step: 7, actions: true },
    [key("dosar")]: { Screen: Dossier, back: "#/firma", title: "Your dossier", footer: { next: "#/firma", nextLabel: "Back to Products" } },
  };
}
