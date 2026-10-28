// Demo accounts for the simulated sign-in. No credentials are asked for or stored.
// Each personal account opens the same Coach with its own data (#/intra/<id>, see data/personas.js);
// the business one shows that its features differ (coming later).

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
  pj: [{ id: "pj", profile: "Persoană juridică", name: "ALFA SERV SRL", initial: "A", detail: "Cont curent RON · CUI 4•••••7", href: "#/firma" }],
};

export const business = {
  subtitle: "ALFA SERV SRL · persoană juridică",
  coach: {
    title: "Coach pentru firme",
    badge: "În curând",
    text: "Lucrăm la el: încasări și plăți din extrasele firmei, facturi și termene, pregătirea unei finanțări.",
  },
  products: [
    { icon: "card", name: "Conturi pentru firme" },
    { icon: "transfer", name: "Încasări POS și online" },
    { icon: "bank", name: "Finanțare" },
    { icon: "file", name: "Facturare și parteneri" },
    { icon: "shield", name: "Asigurări pentru firmă" },
  ],
  note: "Coach-ul financiar pentru persoane fizice e disponibil în contul personal.",
};
