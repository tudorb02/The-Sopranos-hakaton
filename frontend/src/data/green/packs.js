// One pack per available area of the green-credit platform (design/pj-greenstruct.md §1): its configuration
// and its demo dossier, in the same shapes. A new area adds a folder next to agro/ and a line here.

import * as agroModules from "./agro/modules.js";
import * as agroScenario from "./agro/scenario.js";

export const greenPacks = {
  agro: { ...agroModules, ...agroScenario },
};
