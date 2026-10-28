// Optional activation of the Coach, started from Produse: one entry per hash route (#/activare/...).
// back: the "Înapoi" link; step: position in the progress bar; footer: the actions at the bottom.

import { questions } from "../../data/activation.js";
import { Analysis } from "./Analysis.jsx";
import { Apps } from "./Apps.jsx";
import { Calendar, CalendarConnected } from "./Calendar.jsx";
import { Question } from "./Question.jsx";
import { Done, Intro } from "./Start.jsx";
import { Statements } from "./Statements.jsx";

export const ACTIVATION_STEPS = ["Extrase", "Calendar", "Aplicații", "Întrebări", "Analiză"];

const questionRoutes = Object.fromEntries(
  questions.map((question, i) => {
    const next = i + 1 < questions.length ? `#/activare/intrebari/${i + 2}` : "#/activare/analiza";
    return [
      `activare/intrebari/${i + 1}`,
      {
        Screen: Question,
        props: { index: i },
        back: i === 0 ? "#/activare/aplicatii" : `#/activare/intrebari/${i}`,
        step: 4,
        note: `Întrebarea ${i + 1} din ${questions.length}`,
        footer: { next, nextLabel: "Continuă", skip: next, skipLabel: "Sari peste întrebare" },
      },
    ];
  }),
);

export const ACTIVATION = {
  activare: {
    Screen: Intro,
    footer: { next: "#/activare/extrase", nextLabel: "Activează", skip: "#/produse", skipLabel: "Nu acum" },
  },
  "activare/extrase": {
    Screen: Statements,
    back: "#/activare",
    step: 1,
    footer: { next: "#/activare/calendar", nextLabel: "Continuă" },
  },
  "activare/calendar": {
    Screen: Calendar,
    back: "#/activare/extrase",
    step: 2,
    footer: { skip: "#/activare/aplicatii", skipLabel: "Sari peste" },
  },
  "activare/calendar/conectat": {
    Screen: CalendarConnected,
    back: "#/activare/calendar",
    step: 2,
    footer: { next: "#/activare/aplicatii", nextLabel: "Continuă" },
  },
  "activare/aplicatii": {
    Screen: Apps,
    back: "#/activare/calendar/conectat",
    step: 3,
    footer: { next: "#/activare/intrebari/1", nextLabel: "Permite accesul", skip: "#/activare/intrebari/1", skipLabel: "Sari peste" },
  },
  ...questionRoutes,
  "activare/analiza": {
    Screen: Analysis,
    back: `#/activare/intrebari/${questions.length}`,
    step: 5,
    footer: { next: "#/activare/gata", nextLabel: "Vezi ce am găsit" },
  },
  "activare/gata": {
    Screen: Done,
    back: "#/activare/analiza",
    step: ACTIVATION_STEPS.length + 1,
    footer: { next: "#/rezumat", nextLabel: "Mergi la coach", skip: "#/chat", skipLabel: "Deschide discuția" },
  },
};
