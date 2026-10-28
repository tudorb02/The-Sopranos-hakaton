// The coach's notice on advice and data. The wording is a proposal for the bank's legal team to validate.
// "criptate" must hold in the real implementation: encryption in transit and at rest.

export const legal = {
  eyebrow: "Informare",
  title: "Sfaturile și datele tale",
  items: [
    { icon: "compass", text: "Sfaturile sunt create doar pentru tine, din datele tale. Sunt orientative, iar deciziile îți aparțin." },
    { icon: "chat", text: "Coach-ul este un asistent bazat pe inteligență artificială și poate greși. Nu oferă consultanță financiară sau de investiții." },
    { icon: "lock", text: "Toate informațiile tale sunt criptate, la transmitere și la stocare." },
    { icon: "shield", text: "Nu facem nicio operațiune fără acordul tău. Datele nu se folosesc pentru credit sau reclame și le poți șterge oricând." },
  ],
  strip: "Date criptate · Deciziile îți aparțin",
  data: [
    { name: "Extrase de cont", note: "Contul curent și extrasele atașate de tine" },
    { name: "Răspunsurile tale", note: "Din întrebările de început și din discuții" },
    { name: "Calendar", note: "Opțional: doar zilele de naștere și evenimentele marcate" },
    { name: "Screen Time", note: "Opțional: doar dacă ai deschis aplicațiile alese" },
  ],
  erase: "Din Profil → Dezactivează coach-ul. Extrasele importate și răspunsurile tale se șterg, iar contul și cardurile nu sunt afectate.",
  contact: "Ai o întrebare? Scrie-ne din Chat 1:1 în aplicație sau sună la *2000.",
};
