// The coach's notice on advice and data. The wording is a proposal for the bank's legal team to validate.
// "criptate" must hold in the real implementation: encryption in transit and at rest.

export const legal = {
  eyebrow: "Informare",
  title: "Recomandările și datele tale",
  items: [
    { icon: "compass", text: "Recomandările sunt personalizate pe baza datelor tale. Au caracter informativ, iar deciziile îți aparțin." },
    { icon: "chat", text: "Coach-ul este un asistent bazat pe inteligență artificială și poate greși. Nu oferă consultanță financiară sau de investiții." },
    { icon: "lock", text: "Toate informațiile tale sunt criptate, atât la transmitere, cât și la stocare." },
    { icon: "shield", text: "Nu efectuăm nicio operațiune fără acordul tău. Datele tale nu sunt folosite pentru evaluarea creditelor sau în scop de marketing și le poți șterge oricând." },
  ],
  strip: "Date criptate · Deciziile îți aparțin",
  // Who can see what. A proposal for the legal team: every line must hold in the real implementation
  // (EU-only processing, a model that does not learn from client data, an access log).
  summary: "Datele tale le vezi doar tu și coach-ul. Un consultant le vede doar dacă i le arăți tu, iar altor firme nu le dăm niciodată.",
  access: {
    title: "Cine îți vede datele",
    items: [
      { icon: "lock", who: "Tu", text: "Vezi în Profil tot ce știe coach-ul despre tine și poți corecta sau șterge orice rând." },
      { icon: "compass", who: "Coach-ul", text: "Citește extrasele și răspunsurile tale doar ca să-ți calculeze bugetele și recomandările. Modelul AI nu învață din datele tale." },
      { icon: "chat", who: "Un consultant Raiffeisen", text: "Vede profilul din coach doar dacă i-l arăți tu, într-o discuție în Chat 1:1, și doar cât durează discuția." },
      { icon: "shield", who: "Alte firme", text: "Nimeni. Nu vindem și nu dăm datele tale altor firme, nici pentru reclame, nici pentru evaluarea creditelor." },
    ],
  },
  never: {
    title: "Ce nu facem niciodată",
    items: [
      "Nu îți cerem parola, PIN-ul sau codurile primite prin SMS",
      "Nu facem plăți și nu mutăm bani fără aprobarea ta în aplicație",
      "Nu citim titlurile din calendar sau ce faci în alte aplicații",
      "Nu trimitem datele tale în afara Uniunii Europene",
    ],
  },
  log: {
    title: "Ultimele accesări",
    items: [
      { who: "Coach-ul", what: "A citit plățile de ieri, pentru rezumatul de azi", when: "Azi, 07:00" },
      { who: "Tu", what: "Ai deschis Profilul", when: "Ieri, 21:14" },
      { who: "Coach-ul", what: "A citit calendarul pentru săptămâna viitoare", when: "10 nov., 07:00" },
    ],
    note: "Niciun angajat al băncii nu a deschis profilul tău din coach.",
  },
  dataTitle: "Ce date folosește coach-ul",
  data: [
    { name: "Extrase de cont", note: "Contul curent și extrasele atașate de tine" },
    { name: "Răspunsurile tale", note: "Din întrebările de început și din discuții" },
    { name: "Calendar", note: "Opțional: doar zilele de naștere și evenimentele marcate" },
    { name: "Screen Time", note: "Opțional: doar dacă ai deschis aplicațiile alese" },
  ],
  erase: "Din Profil → Dezactivează coach-ul. Extrasele importate și răspunsurile tale se șterg, iar contul și cardurile nu sunt afectate.",
  contact: "Ai o întrebare? Scrie-ne din Chat 1:1 în aplicație sau sună la *2000.",
};
