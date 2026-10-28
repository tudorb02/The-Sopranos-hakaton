// Business demo account and shared sign-in copy. Personal accounts now come from the Node API.
// No credentials are asked for or stored. The farm keeps its local green-credit flow.

export const login = {
  title: "Bine ai revenit",
  lead: "Alege contul cu care intri în demo.",
  note: "Prototip de hackathon cu date fictive, neafiliat Raiffeisen Bank. Nu se cer date de autentificare; în aplicația reală intri cu PIN sau biometrie.",
};

export const accounts = {
  pj: [{ id: "pj", profile: "Fermă de legume", name: "Legume Bărăgan SRL", initial: "L", detail: "Cont curent RON · CUI 4•••••7", href: "#/firma" }],
};

export const business = {
  subtitle: "Legume Bărăgan SRL · persoană juridică",
  products: [
    { icon: "card", name: "Conturi pentru firme" },
    { icon: "transfer", name: "Încasări POS și online" },
    { icon: "bank", name: "Finanțare" },
    { icon: "file", name: "Facturare și parteneri" },
    { icon: "shield", name: "Asigurări pentru firmă" },
  ],
  note: "Coach-ul financiar pentru persoane fizice e disponibil în contul personal.",
};
