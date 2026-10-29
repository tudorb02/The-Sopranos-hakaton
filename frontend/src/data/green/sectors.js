// The areas of the green-credit platform for businesses (design/pj-greenstruct.md §1–2).
// Only agriculture is available. The others show as coming soon, with no action, so the client sees
// that agriculture is the first area of the platform, not the only one.

// The client-facing voice of the three agents is one voice that helps prepare the credit application.
export const greenEntry = {
  title: "Sustainable credit",
  subtitle: "Starting with agriculture",
  badge: "New",
  text: "Prepare your credit application right in the app: which documents you need, how the investment becomes eligible for the green credit and which clauses to ask for. The bank only gives the final approval.",
};

// status: "available" (opens the area's flow) or "soon".
export const sectors = [
  {
    id: "agro",
    name: "Agriculture",
    icon: "leaf",
    status: "available",
    text: "6 types of investment: irrigation, energy, machinery, livestock, post-harvest, organic",
    href: "#/verde/agro",
  },
  { id: "alimentar", name: "Food industry", icon: "factory", status: "soon", text: "Efficient refrigeration, heat recovery, water reuse" },
  { id: "silvicultura", name: "Forestry", icon: "tree", status: "soon", text: "Afforestation and efficient forestry machinery" },
  { id: "pescuit", name: "Fisheries and aquaculture", icon: "fish", status: "soon", text: "Water recirculation and solar energy at fish farms" },
];

export const sectorsIntro = {
  title: "Which area is the investment in?",
  lead: "We start with agriculture. The other areas come to the same platform, with the same steps and the same analysis.",
  more: "More areas are coming: energy, buildings and transport, for any company.",
};
