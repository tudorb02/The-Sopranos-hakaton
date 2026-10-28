// Demo accounts for the simulated sign-in. No credentials are asked for or stored.
// Each personal account opens the same Coach with its own data (#/intra/<id>, see data/personas.js);
// the business one, a vegetable farm, opens the green credit for investments (design/pj-greenstruct.md).

export const login = {
  title: "Bine ai revenit",
  lead: "Alege contul cu care intri în demo.",
  note: "Prototip de hackathon cu date fictive, neafiliat Raiffeisen Bank. Nu se cer date de autentificare; în aplicația reală intri cu PIN sau biometrie.",
};

export const accounts = {
  pf: [
    { id: "pf", profile: "Salariat", name: "Daria Ionescu", initial: "D", detail: "Cont curent RON · RO12 RZBR •••• 1234", href: "#/intra/pf" },
    { id: "student", profile: "Student", name: "Matei Popescu", initial: "M", detail: "Cont curent RON · RO45 RZBR •••• 5678", href: "#/intra/student" },
  ],
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
