// Demo accounts for the simulated sign-in. No credentials are asked for or stored.
// The personal account opens the Coach; the business one shows that its features differ (coming later).

export const login = {
  title: "Bine ai revenit",
  lead: "Alege contul cu care intri în demo.",
  note: "Prototip: nu se cer date de autentificare. În aplicația reală, intri cu PIN sau biometrie.",
};

export const accounts = {
  pf: {
    type: "Persoană fizică",
    name: "Daria Ionescu",
    initial: "D",
    detail: "Cont curent RON · RO12 RZBR •••• 1234",
    href: "#/produse",
  },
  pj: {
    type: "Persoană juridică",
    name: "ALFA SERV SRL",
    initial: "A",
    detail: "Cont firmă RON · CUI 4•••••7",
    href: "#/firma",
  },
};

export const business = {
  subtitle: "ALFA SERV SRL · persoană juridică",
  coach: {
    title: "Coach pentru firme",
    badge: "În curând",
    text: "Lucrăm la el: încasări și plăți din extrasele firmei, facturi și termene, pregătirea unei finanțări.",
  },
  products: [
    { icon: "card", name: "Conturi firmă" },
    { icon: "transfer", name: "Încasări POS și online" },
    { icon: "bank", name: "Finanțare" },
    { icon: "file", name: "Facturare și parteneri" },
    { icon: "shield", name: "Asigurări pentru firmă" },
  ],
  note: "Coach-ul financiar pentru persoane fizice e disponibil în contul personal.",
};
