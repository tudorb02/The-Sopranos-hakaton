// Optional activation of the Coach, started from Produse: one entry per hash route (#/activare/...).
// back: the "Back" link; step: position in the progress bar; footer: the actions at the bottom.
// The question routes follow the active client's questions (see data/personas.js).

import { Analysis } from "./Analysis.jsx";
import { Apps } from "./Apps.jsx";
import { Calendar, CalendarConnected } from "./Calendar.jsx";
import { Question } from "./Question.jsx";
import { Done, Intro } from "./Start.jsx";
import { Statements } from "./Statements.jsx";

export const ACTIVATION_STEPS = ["Statements", "Calendar", "Apps", "Questions", "Analysis"];

export function activationRoutes(questions) {
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
          note: `Question ${i + 1} of ${questions.length}`,
          footer: { next, nextLabel: "Continue", skip: next, skipLabel: "Skip question" },
        },
      ];
    }),
  );

  return {
    activare: {
      Screen: Intro,
      footer: { next: "#/activare/extrase", nextLabel: "Activate", skip: "#/produse", skipLabel: "Not now" },
    },
    "activare/extrase": {
      Screen: Statements,
      back: "#/activare",
      step: 1,
      footer: { next: "#/activare/calendar", nextLabel: "Continue" },
    },
    "activare/calendar": {
      Screen: Calendar,
      back: "#/activare/extrase",
      step: 2,
      footer: { skip: "#/activare/aplicatii", skipLabel: "Skip" },
    },
    "activare/calendar/conectat": {
      Screen: CalendarConnected,
      back: "#/activare/calendar",
      step: 2,
      footer: { next: "#/activare/aplicatii", nextLabel: "Continue" },
    },
    "activare/aplicatii": {
      Screen: Apps,
      back: "#/activare/calendar/conectat",
      step: 3,
      footer: { next: "#/activare/intrebari/1", nextLabel: "Allow access", skip: "#/activare/intrebari/1", skipLabel: "Skip" },
    },
    ...questionRoutes,
    "activare/analiza": {
      Screen: Analysis,
      back: `#/activare/intrebari/${questions.length}`,
      step: 5,
      footer: { next: "#/activare/gata", nextLabel: "See what I found" },
    },
    "activare/gata": {
      Screen: Done,
      back: "#/activare/analiza",
      step: ACTIVATION_STEPS.length + 1,
      footer: { next: "#/rezumat", nextLabel: "Go to the coach", skip: "#/chat", skipLabel: "Open the chat" },
    },
  };
}
