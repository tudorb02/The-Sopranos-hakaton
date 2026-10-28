// Fictional content for the Coach entry in Produse and its optional activation (28 October 2026,
// before the 5 November payday). Selected answers show what Daria chose; nothing is saved.

export const entry = {
  title: "Coach financiar",
  badge: "Nou",
  subtitle: "Funcție opțională",
  text: "Îți analizează extrasele de cont și te ajută cu bugete pe categorii și cu obiective. Îl activezi doar dacă vrei și îl poți opri oricând.",
};

// The existing sections of Produse, shown only as context for where the coach lives.
export const products = [
  { icon: "card", name: "Conturi curente" },
  { icon: "wallet", name: "Economii și depozite" },
  { icon: "card", name: "Carduri" },
  { icon: "bank", name: "Credite" },
  { icon: "shield", name: "Asigurări" },
];

export const intro = {
  title: "Activează coach-ul financiar",
  lead: "Te ajut să vezi unde se duc banii, să-ți pui bugete pe categorii și să strângi pentru ce îți dorești.",
  duration: "Cam 3 minute",
  does: [
    "Citesc extrasele de cont pe care mi le dai și îți arăt tiparele",
    "Te întreb doar ce nu pot vedea din tranzacții",
    "Îți scriu când te apropii de o limită stabilită de tine",
  ],
  doesNot: [
    "Nu fac nicio plată sau operațiune fără acordul tău",
    "Nu folosesc datele pentru credit sau reclame",
    "Mă poți dezactiva oricând, iar datele importate se șterg",
  ],
};

export const statements = {
  lead: "Coach-ul lucrează cu extrasele tale de cont. Cu cât au mai multe luni, cu atât vede mai bine tiparele: ideal 12–24.",
  account: { name: "Cont curent RON", iban: "RO12 RZBR •••• 1234" },
  periods: ["Ultimele 12 luni (nov. 2025 – oct. 2026)", "Ultimele 6 luni", "Ultimele 3 luni"],
  imported: { title: "12 extrase lunare importate", meta: "nov. 2025 – oct. 2026 · 978 de plăți · se actualizează lunar" },
  attachHint: "Din anii trecuți sau de la altă bancă.",
  formats: "PDF, XLS sau CSV · până la 10 MB",
  files: [
    { name: "extras_nov2024-oct2025.pdf", meta: "12 luni · 968 de plăți", state: "done" },
    { name: "extras_alta_banca_2026.csv", meta: "Se citește…", state: "reading", progress: 60 },
  ],
  howTo: [
    "Deschide aplicația sau internet banking-ul băncii",
    "Intră la cont și caută „Extras de cont”",
    "Alege perioada cea mai lungă, în format PDF sau XLS",
    "Salvează fișierul și atașează-l aici",
  ],
  privacy:
    "Din extrase citesc data, suma, comerciantul și descrierea. Transferurile către persoane apar doar ca „transfer către o persoană”. Poți șterge oricând un extras.",
};

export const calendar = {
  options: [
    { id: "google", icon: "calendar", title: "Google Calendar", note: "Citesc doar zilele de naștere și evenimentele marcate de tine.", action: "Conectează", href: "#/activare/calendar/conectat" },
    { id: "phone", icon: "phone", title: "Calendarul telefonului", note: "Datele rămân pe telefon. Coach-ul află doar câte evenimente sunt și când.", action: "Permite" },
  ],
  reads: ["Tipul evenimentului și data", "Zilele de naștere din contactele Google"],
  doesNotRead: ["Titluri, invitați sau locații", "Nu modific nimic în calendar"],
  found: [
    { day: "nov.", month: "2026", title: "10 zile de naștere", note: "Din contactele tale Google" },
    { day: "dec.", month: "2026", title: "Sf. Nicolae, Crăciun, Sf. Ștefan", note: "Sărbători cu cadouri" },
    { day: "19", month: "iun.", title: "Nuntă", note: "Eveniment marcat de tine, în 2027" },
  ],
  gift: {
    question: "Cât vrei să dai de obicei pe un cadou?",
    groups: [
      { label: "Pentru prieteni", options: ["50 lei", "100 lei", "150 lei", "Altă sumă"], selected: "100 lei" },
      { label: "Pentru familie", options: ["100 lei", "200 lei", "300 lei", "Altă sumă"], selected: "200 lei" },
    ],
    result: "Pentru cele 10 zile de naștere din noiembrie: aproximativ 1.200 lei.",
  },
};

export const apps = {
  found: "Am găsit 3 abonamente în extrase.",
  items: [
    { name: "FitZone Gym", lei: 220, note: "Plătit lunar din ianuarie", on: true },
    { name: "StreamFlix", lei: 55, note: "Plătit lunar", on: false },
    { name: "MuzicaPlus", lei: 25, note: "Plătit lunar", on: false },
  ],
  learns: ["Doar dacă ai deschis aplicația într-o zi"],
  doesNotLearn: ["Cât timp stai în aplicație sau ce faci acolo", "Alte aplicații decât cele alese de tine"],
  platform: "Pe iPhone folosesc Screen Time, iar pe Android accesul la datele de utilizare. Telefonul îți cere acordul la pasul următor.",
};

// The six questions of the first conversation (see design/coach-profile.md, Q1–Q5b).
export const questions = [
  {
    id: "probleme",
    title: "Ce te încurcă cel mai des când vine vorba de bani?",
    hint: "Poți alege mai multe.",
    options: [
      { label: "Rămân fără bani înainte de salariu", selected: true },
      { label: "Nu știu unde se duc banii", selected: true },
      { label: "Nu reușesc să pun deoparte" },
      { label: "Plătesc abonamente pe care nu le folosesc" },
      { label: "Altceva" },
    ],
    fields: [{ label: "Spune cu cuvintele tale", type: "textarea", value: "Cheltui foarte repede banii și nu-mi dau seama unde se duc." }],
  },
  {
    id: "obiective",
    title: "Pentru ce ai vrea să strângi bani în lunile următoare?",
    hint: "Poți alege mai multe.",
    options: [
      { label: "O achiziție", selected: true },
      { label: "O vacanță" },
      { label: "O rezervă pentru neprevăzute" },
      { label: "Nimic anume acum" },
    ],
    fields: [
      { label: "Ce anume?", value: "Laptop" },
      { label: "Cât costă?", value: "2000", suffix: "lei", numeric: true },
      { label: "Până când?", type: "select", value: "Cât mai curând", options: ["Cât mai curând", "În 3 luni", "În 6 luni", "Până la final de an"] },
    ],
  },
  {
    id: "bani-in-afara",
    title: "Ai bani care nu trec prin contul ăsta?",
    hint: "De exemplu tichete de masă, numerar sau un cont la altă bancă. Așa calculez corect cât îți rămâne.",
    options: [
      { label: "Tichete de masă", selected: true },
      { label: "Numerar" },
      { label: "Cont la altă bancă" },
      { label: "Nu" },
    ],
    fields: [{ label: "Tichete de masă pe lună", value: "800", suffix: "lei", numeric: true }],
  },
  {
    id: "gospodarie",
    title: "Împarți cheltuielile casei cu cineva?",
    options: [
      { label: "Nu, doar eu", selected: true },
      { label: "Da, cu partenerul" },
      { label: "Da, cu colegi de apartament" },
      { label: "Locuiesc cu familia" },
    ],
  },
  {
    id: "notificari",
    title: "Cât de des vrei să-ți scriu și când să nu te deranjez?",
    options: [
      { label: "Doar când e important" },
      { label: "Cel mult o dată pe zi", selected: true },
      { label: "Doar rezumatul săptămânal" },
    ],
    fields: [
      { label: "Liniște de la", value: "22:00" },
      { label: "până la", value: "08:00" },
      { label: "Rezumatul săptămânal", type: "select", value: "Duminică, la 19:00", options: ["Duminică, la 19:00", "Luni, la 08:00", "Vineri, la 18:00", "Fără rezumat"] },
    ],
  },
  {
    id: "servicii",
    title: "Vrei să-ți spun și când un serviciu Raiffeisen te-ar ajuta?",
    hint: "Îți spun de fiecare dată de ce și cât costă. Poți schimba oricând din Profil.",
    options: [{ label: "Da, cel mult o dată pe săptămână", selected: true }, { label: "Nu, doar sfaturi" }],
  },
];

export const analysis = {
  title: "Mă uit prin ultimele 24 de luni",
  lead: "12 luni importate din contul curent și 12 din extrasul atașat. Durează cam un minut.",
  items: [
    { label: "Venituri și ziua salariului", state: "done", note: "Salariu pe 5, în 24 din 24 de luni" },
    { label: "Plăți recurente și abonamente", state: "done", note: "9 plăți recurente, dintre care 3 abonamente" },
    { label: "Categorii pentru 1.946 de plăți", state: "running", note: "1.362 din 1.946", progress: 70 },
    { label: "Obiceiuri și luni grele", state: "waiting", note: "Urmează" },
  ],
  note: "Poți închide aplicația. Îți scriu când e gata.",
};

export const findings = {
  lead: "Din 24 de luni de extrase, din calendar și din răspunsurile tale.",
  items: [
    { text: "Rămâi cu sub 100 lei în cont de pe 27 până pe 5, în 5 din ultimele 6 luni.", src: "obs" },
    { text: "Aproape în fiecare dimineață plătești ~30 lei la Boabe & Co: cam 600 lei pe lună.", note: "Te întreb despre asta în discuție.", src: "obs" },
    { text: "FitZone Gym: 220 lei pe lună, iar aplicația sălii n-a mai fost deschisă din aprilie.", src: "obs" },
    { text: "În noiembrie ai 10 zile de naștere.", src: "obs", label: "din calendar" },
  ],
  firstStep: {
    title: "Primul pas pe care ți-l propun",
    text: "Pe 5 noiembrie, după salariu, pune deoparte cei 1.200 lei pentru cadouri. Așa vezi de la început cât îți rămâne pentru restul lunii.",
    action: "Vezi propunerea",
    href: "#/chat",
  },
};
