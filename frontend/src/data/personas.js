// The two personal demo clients. Both expose the same data shapes, so every coach screen works for either;
// the screens read the active one through usePersona() (src/persona.js).

import * as dariaActivation from "./activation.js";
import * as daria from "./demo.js";
import * as dariaTracking from "./tracking.js";
import * as matei from "./student.js";

const PAGES = ["rezumat", "cheltuieli", "bugete", "obiective", "profil"];

export const personas = {
  pf: { ...dariaActivation, ...dariaTracking, ...daria, pages: PAGES },
  student: { ...matei, pages: ["rezumat", "cheltuieli", "bugete", "obiective", "idei", "profil"] },
};
