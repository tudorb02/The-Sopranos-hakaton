// The demo client whose data the coach shows: Daria (salary) or Matei (student, no stable income).
// The sign-in sets it through #/intra/pf or #/intra/student. On the web it is kept for the browser tab only;
// on the phone, until the app is closed.

import { createContext, useContext } from "react";

import { personas } from "./data/personas.js";

const STORAGE_KEY = "coach-persona";

export const PersonaContext = createContext(personas.pf);

export function usePersona() {
  return useContext(PersonaContext);
}

export function storedPersonaId() {
  try {
    const id = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    return id in personas ? id : "pf";
  } catch {
    return "pf";
  }
}

export function storePersonaId(id) {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be blocked (private mode): the choice then lasts until the page reloads.
  }
}
