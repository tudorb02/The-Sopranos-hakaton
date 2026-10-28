// The notice of the green-credit flow, same shape as data/legal.js. The wording is a proposal for the bank's
// legal team; "criptate" must hold in the real implementation, in transit and at rest.

export const greenLegal = {
  eyebrow: "Informare",
  title: "Analiza și datele firmei",
  items: [
    { icon: "compass", text: "Dosarul îl pregătești în aplicație, cu ajutorul agenților AI. Banca dă doar aprobarea finală." },
    { icon: "chat", text: "Cifrele sunt calculate de bancă, după reguli fixe. AI-ul citește documentele și scrie explicațiile, dar nu face calcule." },
    { icon: "lock", text: "Datele și documentele firmei sunt criptate, atât la transmitere, cât și la stocare, și sunt folosite doar pentru acest dosar." },
    { icon: "shield", text: "Ce lipsește din dosar devine o condiție înainte de tragere, nu un motiv de respingere." },
  ],
  strip: "Date criptate · Aprobarea finală o dă banca",
  // Who can see the dossier. A proposal for the legal team: every line must hold in the real implementation.
  access: {
    title: "Cine vede dosarul",
    items: [
      { icon: "lock", title: "Tu", text: "Vezi tot dosarul și fiecare cifră din el, cu sursa ei." },
      { icon: "compass", title: "Agenții AI", text: "Citesc documentele și datele firmei doar pentru acest dosar. Modelul nu învață din ele." },
      { icon: "bank", title: "Banca", text: "Primește dosarul gata pregătit doar după ce apeși „Trimite cererea la bancă”, pentru aprobarea finală. Până atunci, îl vezi doar tu." },
      { icon: "shield", title: "Fondul European de Investiții", text: "Dacă alegi creditul verde cu garanție, primește doar datele cerute pentru garanție: firma, creditul și investiția." },
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
      { who: "Banca", what: "A primit dosarul, pentru aprobarea finală", when: "12 nov., 11:02" },
      { who: "Agenții AI", what: "Au citit oferta și facturile de energie", when: "12 nov., 10:21" },
      { who: "Tu", what: "Ai încărcat documentele", when: "12 nov., 10:15" },
    ],
  },
  security: {
    title: "Cum protejăm datele firmei",
    items: [
      { icon: "lock", title: "Criptate peste tot", text: "Documentele și datele firmei sunt criptate la transmitere și la stocare. Fără cheile de criptare ale băncii, un fișier copiat nu poate fi citit." },
      { icon: "shield", title: "Doar din contul firmei", text: "Dosarul se deschide doar din aplicație, de utilizatorii firmei, după autentificare." },
      { icon: "compass", title: "Agenții primesc doar ce le trebuie", text: "Oferta, fișele tehnice și cifrele fermei, fără date personale ale asociaților. Datele rămân în UE." },
    ],
  },
  privacy: {
    title: "Dosarul rămâne privat",
    items: [
      "Dosarul nu devine public. Doar datele din ANAF erau publice și înainte",
      "Nu dăm dosarul altor firme, furnizorilor din ofertă sau altor bănci",
      "În rapoartele pentru investitorii în obligațiuni verzi apar doar totaluri pe categorii, fără numele firmei",
    ],
  },
  incident: {
    title: "Dacă se întâmplă ceva",
    items: [
      { icon: "bell", title: "Un incident de securitate", text: "Dacă ar exista vreodată un incident care afectează datele firmei, te anunțăm direct și anunțăm autoritățile, cum cere legea." },
      { icon: "help", title: "O bănuială", text: "Verifică ultimele accesări de mai sus și scrie-ne din Chat 1:1 sau la *2000." },
    ],
  },
  // The short version, shown at the step where the company gives its consents.
  promise: {
    title: "Dosarul rămâne privat",
    items: ["Criptat, la transmitere și la stocare", "Nu devine public și nu ajunge la alte firme", "Banca îl primește doar când îl trimiți, pentru aprobare"],
    link: "Cine vede dosarul și cum îl protejăm",
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
