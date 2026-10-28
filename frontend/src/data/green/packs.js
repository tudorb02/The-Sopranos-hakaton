// One pack per available area of the green-credit platform (design/pj-greenstruct.md §1): its static copy.
// A new area adds a folder next to agro/ and a line here. Everything dynamic comes from the API.

import * as agroModules from "./agro/modules.js";

export const greenPacks = {
  agro: { ...agroModules },
};
