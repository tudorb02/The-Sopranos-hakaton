// The areas of the green-credit platform for businesses (design/pj-greenstruct.md §1–2).
// Only agriculture is available. The others show as coming soon, with no action, so the client sees
// that agriculture is the first area of the platform, not the only one.

// The client-facing voice of the three agents is one consultant that helps prepare the credit application.
export const greenEntry = {
  title: "Consultant pentru credit verde",
  subtitle: "Începem cu agricultura",
  badge: "Nou",
  text: "Un consultant AI te ajută să pregătești cererea de credit pentru investiția ta: ce documente îți trebuie, cum devine investiția eligibilă pentru creditul verde și ce clauze să ceri, ca dosarul să aibă cele mai bune șanse și cele mai bune condiții.",
};

// status: "available" (opens the area's flow) or "soon".
export const sectors = [
  {
    id: "agro",
    name: "Agricultură",
    icon: "leaf",
    status: "available",
    text: "6 tipuri de investiții: irigații, energie, utilaje, zootehnie, post-recoltă, ecologic",
    href: "#/verde/agro",
  },
  { id: "alimentar", name: "Industria alimentară", icon: "factory", status: "soon", text: "Refrigerare eficientă, recuperarea căldurii, reutilizarea apei" },
  { id: "silvicultura", name: "Silvicultură", icon: "tree", status: "soon", text: "Împăduriri și utilaje forestiere eficiente" },
  { id: "pescuit", name: "Pescuit și acvacultură", icon: "fish", status: "soon", text: "Recircularea apei și energie solară la fermele piscicole" },
];

export const sectorsIntro = {
  title: "În ce domeniu e investiția?",
  lead: "Începem cu agricultura. Celelalte domenii vin pe aceeași platformă, cu aceiași pași și aceeași analiză.",
  more: "Urmează și alte domenii: energie, clădiri și transport, pentru orice firmă.",
};
