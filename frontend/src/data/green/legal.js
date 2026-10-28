// The notice of the green-credit flow, same shape as data/legal.js. The wording is a proposal for the bank's
// legal team; "criptate" must hold in the real implementation, in transit and at rest.

export const greenLegal = {
  eyebrow: "Informare",
  title: "Analiza și datele firmei",
  items: [
    { icon: "compass", text: "Analiza e făcută de agenți AI și verificată de un ofițer de credit Raiffeisen. Decizia de credit aparține băncii." },
    { icon: "chat", text: "Cifrele sunt calculate de bancă, după reguli fixe. AI-ul citește documentele și scrie explicațiile, dar nu face calcule." },
    { icon: "lock", text: "Datele și documentele firmei sunt criptate, atât la transmitere, cât și la stocare, și sunt folosite doar pentru acest dosar." },
    { icon: "shield", text: "Ce lipsește din dosar devine o condiție înainte de tragere, nu un motiv de respingere." },
  ],
  strip: "Date criptate · Decizia de credit aparține băncii",
  // Who can see the dossier. A proposal for the legal team: every line must hold in the real implementation.
  summary: "Analiza o vezi doar tu. Ofițerul de credit primește dosarul abia după ce îl trimiți, iar ANAF și APIA nu primesc nimic de la noi.",
  access: {
    title: "Cine vede dosarul",
    items: [
      { icon: "lock", who: "Tu", text: "Vezi tot dosarul și fiecare cifră din el, cu sursa ei." },
      { icon: "compass", who: "Agenții AI", text: "Citesc documentele și datele firmei doar pentru acest dosar. Modelul nu învață din ele." },
      { icon: "bank", who: "Ofițerul de credit", text: "Primește dosarul doar după ce apeși „Trimite cererea la bancă”. Până atunci, analiza o vezi doar tu." },
      { icon: "shield", who: "Fondul European de Investiții", text: "Dacă alegi creditul verde cu garanție, primește doar datele cerute pentru garanție: firma, creditul și investiția." },
    ],
  },
  never: {
    title: "Ce nu facem niciodată",
    items: [
      "Nu trimitem datele firmei la ANAF sau la APIA: doar le citim, cu acordul tău",
      "Nu folosim dosarul pentru reclame sau pentru alte produse",
      "Nu îți cerem parole, PIN-uri sau coduri primite prin SMS",
      "Nu trimitem datele în afara Uniunii Europene",
    ],
  },
  log: {
    title: "Ultimele accesări",
    items: [
      { who: "Ofițerul de credit", what: "A deschis dosarul, după ce l-ai trimis", when: "12 nov., 11:02" },
      { who: "Agenții AI", what: "Au citit oferta și facturile de energie", when: "12 nov., 10:21" },
      { who: "Tu", what: "Ai încărcat documentele", when: "12 nov., 10:15" },
    ],
  },
  dataTitle: "Ce date folosim",
  data: [
    { name: "ANAF și ONRC", note: "Date publice: denumire, CAEN, angajați, cifră de afaceri, bilanț" },
    { name: "APIA", note: "Cu acordul tău: parcelele, culturile pe 3 ani și subvențiile" },
    { name: "ANSVSA", note: "Cu acordul tău, doar dacă ai animale" },
    { name: "Open Banking", note: "Cu acordul tău: încasările și plățile pe 12–24 de luni" },
    { name: "Documentele încărcate", note: "Oferta, fișele tehnice, autorizațiile și facturile" },
  ],
  erase: "Din Dosarul tău → Retrage cererea. Documentele încărcate și răspunsurile tale se șterg. Datele publice despre firmă rămân publice.",
  contact: "Ai o întrebare? Scrie-ne din Chat 1:1 în aplicație sau sună la *2000.",
};
