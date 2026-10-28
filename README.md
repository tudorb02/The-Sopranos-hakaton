# The-Sopranos-hakaton

## Structura repository-ului

- `frontend/`: Busola, ecranele coach-ului financiar pentru persoane fizice, gândit ca extensie a aplicației Smart Mobile (React Native / Expo, date fictive). Detalii în [frontend/README.md](frontend/README.md).
- `backend/`: API-ul coach-ului financiar (FastAPI): import extrase, detectarea tiparelor de cheltuieli, insight-uri, plus generatorul de date mock. Detalii în [backend/README.md](backend/README.md) și [docs/pattern-recognition.md](docs/pattern-recognition.md).
- `CLAUDE.md`: arhitectura și regulile comune pentru echipă și agenții AI.

---

🌱 GreenStruct Agro
Agenți AI care transformă investițiile fermelor în credite verzi Raiffeisen.

Proiect pentru hackathonul Raiffeisen Bank România: „Provocare Deschisă: Agenți AI în Servicii Bancare”.

Cuprins
Problema și soluția
Cum funcționează, pe scurt
Ce tipuri de investiții acoperim
Interfața pentru fermier (IMM)
Interfața pentru ofițerul Raiffeisen
Agenții AI și pașii prin care trece un dosar
Ce informații cerem firmei
Cum construim varianta de credit verde
Arhitectura tehnică
Roluri și task-uri
Planul pe etape
Demo-ul
Reguli de lucru în echipă
1. Problema și soluția
Problema
Raiffeisen are bani pentru credite verzi: garanții FEI / InvestEU, obligațiuni verzi cu categoria „Agriculture and forestry”, Credit BIO, finanțare pentru irigații.
Un credit poate intra pe aceste linii doar dacă se dovedește tehnic că investiția e verde: economisește apă, energie sau motorină și nu face rău mediului (criteriile DNSH).
Verificarea tehnică se face manual. Pe credite mici, pentru ferme mici, costă prea mult, așa că multe ferme primesc un credit standard, mai scump.
Fermierul nu are expertiză ESG. Nu știe ce trebuie să cumpere ca să fie eligibil.
Soluția
GreenStruct Agro primește de la fermier câteva documente și răspunsuri simple. Apoi 3 agenți AI:

verifică tehnic investiția și, dacă nu e verde, propun un upgrade care o face eligibilă;
compară financiar creditul standard cu creditul verde;
generează raportul de conformitate pentru ofițerul de credit Raiffeisen.
Regula de aur: AI-ul citește documente, decide pașii și scrie texte. Toate calculele le face codul (motorul financiar), niciodată AI-ul.

2. Cum funcționează, pe scurt
  FERMIERUL                                          OFIȚERUL RAIFFEISEN
  ─────────                                          ───────────────────
  1. Introduce CUI-ul
  2. Alege tipul investiției
  3. Încarcă documentele
  4. Răspunde la chestionar
           │
           ▼
  ┌─────────────────────────────────────────────┐
  │  AGENT 1 — Auditor tehnic                    │──► vede live fiecare pas
  │  "Investiția e verde? Dacă nu, ce upgrade?"  │
  ├─────────────────────────────────────────────┤
  │  AGENT 2 — Optimizator financiar             │──► vede calculele
  │  "Credit standard vs. credit verde"          │
  ├─────────────────────────────────────────────┤
  │  AGENT 3 — Underwriter verde                 │──► primește raportul
  │  "Raport oficial pentru bancă"               │
  └─────────────────────────────────────────────┘
           │
           ▼
  5. Vede oferta verde                               6. Aprobă / cere documente
     și economia pe 5 ani
3. Ce tipuri de investiții acoperim
Acoperim toată agricultura prin 6 module. Agenții sunt aceiași pentru toate modulele, iar fiecare modul e un fișier de configurare (criteriu, documente, întrebări, formule, upgrade-uri).

#	Modul	Exemple	Criteriu verde (configurabil)	Ce măsurăm
1	💧 Irigații	picurare, aspersie cu senzori	economie de apă ≥ 25%	m³ apă / an
2	☀️ Energie la fermă	panouri solare, pompe solare, agrivoltaic	regenerabil prin natura investiției	kWh, t CO₂
3	🚜 Utilaje & precizie	tractoare eficiente, GPS, dozare variabilă	−20% motorină sau îngrășăminte / ha	litri, kg N, t CO₂
4	🐄 Zootehnie & biogaz	digestor, stocare gunoi de grajd	reducere emisii + valorificare deșeuri	t CO₂e, kWh
5	❄️ Post-recoltă	depozite frigorifice, uscătoare, sere	economie de energie ≥ 20%	kWh, t CO₂
6	🌱 Ecologic & regenerativ	conversie bio, culturi de acoperire	certificare ecologică UE	ha certificate
⚠️ Pragurile sunt propuneri. Le confirmăm cu mentorii Raiffeisen și le ținem în config/, nu în cod.

Nu acoperim (extinderi viitoare): industria alimentară, silvicultura comercială, pescuitul.

4. Interfața pentru fermier (IMM)
Ecranul din stânga al aplicației. Limbaj simplu, fără jargon bancar sau ESG.

Pasul 1 — Firma ta
Câmp: CUI
Bife de acord: date APIA și Open Banking
Aplicația afișează automat: denumirea, CAEN-ul, hectarele, culturile și animalele. Fermierul doar confirmă.
Pasul 2 — Ce vrei să cumperi?
6 carduri mari cu iconițe, câte unul pentru fiecare modul.
Fermierul alege unul.
Pasul 3 — Unde?
Hartă cu parcelele lui (din APIA).
Bifează parcelele pe care se face investiția.
Pasul 4 — Documente
Zone de upload, cu o listă care se schimbă în funcție de modul (vezi secțiunea 7).
Buton „Încarcă dosarul demo” pentru prezentare.
Pasul 5 — Câteva întrebări
Chestionar de ~10 întrebări, precompletat din APIA.
Durează sub 3 minute.
Pasul 6 — Analiza (live)
Bară de progres cu mesaje simple:
„Citim oferta…”
„Sistemul ales economisește 15% apă. Pentru creditul verde e nevoie de 25%.”
„Am găsit o soluție: picurare + senzori de umiditate.”
Pasul 7 — Oferta ta
Două carduri, unul lângă altul:
Credit standard	🌱 Credit verde Raiffeisen
Investiție	inițială	optimizată (cu upgrade)
Dobândă	standard	redusă
Garanție	ipotecă pe teren	garanție FEI (fără ipotecă)
Rate	lunare egale	adaptate recoltei
Economie apă / energie	mică	mare
Mesaj mare: „Câștigi X EUR în 5 ani alegând creditul verde”
Grafic: economiile și ratele lună de lună.
Buton: „Trimite cererea la bancă”
Pasul 8 — După aprobare
Listă de dovezi de trimis, cu termene: factura finală, procesul-verbal de punere în funcțiune, poze.
Status: În analiză → Aprobat → Monitorizare.
5. Interfața pentru ofițerul Raiffeisen
Ecranul din dreapta al aplicației. Totul e detaliat, verificabil și cu sursa fiecărei cifre.

Panoul 1 — Dosarul
Date firmă (ANAF), date fermă (APIA), cashflow (Open Banking).
Harta parcelelor, cu straturi pentru risc de secetă, Natura 2000 și zone vulnerabile la nitrați.
Panoul 2 — Timeline-ul agenților (live)
Fiecare pas al fiecărui agent apare în timp real:

✅ Agent 1 pornit
   📄 Oferta citită: aspersie clasică, 85.000 EUR
   🔧 Tool: verifica_prag(economie_apa=15%) → NU TRECE (prag 25%)
   🔧 Tool: cauta_upgrade(...) → picurare + senzori, +X EUR
   🔧 Tool: verifica_prag(economie_apa=32%) → TRECE
✅ Agent 1 terminat
⏳ Agent 2 pornit
   🔧 Tool: calculeaza_credit(...)
   ...
Așa ofițerul vede exact ce a făcut AI-ul și că cifrele vin din cod.

Panoul 3 — Comparația financiară
Tabelul A vs. B, cu toate cifrele.
Graficul de rambursare (rate sezoniere).
Verificarea capacității de plată.
Panoul 4 — Raportul de conformitate verde
Decizie: Eligibil verde / Eligibil cu condiții / Neeligibil
Criteriul folosit și sursa lui; valoarea atinsă față de prag
Tabel DNSH cu cele 5 criterii, fiecare cu status și justificare
Impact: m³ apă, kWh, t CO₂ economisite pe an
Etichetă Green Bond: categoria Agriculture and forestry
Condiții înainte de tragere (documente lipsă)
Riscuri semnalate
Panoul 5 — Acțiuni
Butoane: Aprobă, Cere documente și Descarcă raportul PDF.
Badge discret care arată sursa datelor: live / cache / fallback.
6. Agenții AI și pașii prin care trece un dosar
Ciclul de viață al unui dosar
CREAT → DATE_FIRMĂ → AGENT_1 → AGENT_2 → AGENT_3 → GATA → APROBAT → MONITORIZARE
La fiecare pas, backend-ul trimite un eveniment live (SSE) către ambele ecrane.

🔍 Agent 1 — Auditor tehnic
Primește	documentele, chestionarul, modulul ales, datele fermei
Face	1. extrage din PDF-uri parametrii tehnici (doar ce scrie în document)
2. calculează situația actuală vs. investiția nouă (prin tool)
3. verifică pragul verde (prin tool)
4. dacă nu trece, caută în catalog cel mai ieftin upgrade care îl face să treacă
5. verifică criteriile DNSH
Dă mai departe	configurația inițială, configurația recomandată, rezultatul DNSH, câmpurile lipsă
💰 Agent 2 — Optimizator financiar
Primește	cele 2 configurații de la Agentul 1, profilul financiar al fermei
Face	1. ia condițiile produselor (dobânzi, garanții)
2. construiește Opțiunea A (standard) și Opțiunea B (verde)
3. le compară pe 5 ani cu motorul financiar
4. calculează impactul de mediu
5. verifică dacă ferma își permite rata
Dă mai departe	comparația completă, recomandarea, explicația pentru fermier
📋 Agent 3 — Underwriter verde
Primește	output-ul Agenților 1 și 2
Face	1. încadrează creditul în categoria Green Bond
2. compune tabelul DNSH
3. transformă informațiile lipsă în condiții înainte de tragere
4. scrie raportul pentru comitetul de credit
Dă mai departe	raportul final de conformitate
Cum garantăm că output-ul AI e corect
Fiecare agent termină obligatoriu prin apelul unui tool submit_*, cu o schemă JSON fixă. Nu parsăm text liber.
Output-ul e validat cu zod. Dacă e invalid, agentul primește eroarea și se corectează.
Backend-ul recalculează toate cifrele cu motorul financiar și le suprascrie pe cele din output-ul AI.
7. Ce informații cerem firmei
🤖 Luăm automat (fermierul doar confirmă)
Informație	Sursa
Denumire, CAEN, angajați, cifră de afaceri, bilanț	ANAF / ONRC (din CUI)
Parcele, hectare, culturi pe 3 ani, subvenții	APIA (cu acordul fermierului)
Număr și specie de animale	Registrul exploatațiilor (ANSVSA)
Cashflow pe 12–24 luni, sezonalitate	Open Banking (cu acord)
Risc de secetă / grindină / inundații	coordonatele parcelelor (Copernicus)
Zonă Natura 2000, zonă vulnerabilă la nitrați, stres hidric	coordonatele parcelelor
În demo, toate acestea sunt mock-uri cu date fixe.

📄 Documente cerute pentru orice investiție
Oferta / proforma + fișa tehnică a investiției noi
Situația actuală: ce se înlocuiește (fișă tehnică, poză cu eticheta sau descriere)
Parcelele pe care se face investiția (selectate pe hartă)
📄 Documente specifice fiecărui modul
Modul	Ce mai cerem
💧 Irigații	autorizația de gospodărire a apelor (ANAR), consumul actual de apă sau energia de pompare
☀️ Energie	facturile de energie pe 12 luni, suprafața disponibilă
🚜 Utilaje	facturile de motorină și de îngrășăminte pe 12 luni, hectare lucrate
🐄 Biogaz	sistemul actual de stocare a gunoiului de grajd, autorizația de mediu
❄️ Post-recoltă	facturile de energie pe 12 luni, capacitatea de stocare
🌱 Ecologic	contractul cu organismul de certificare sau certificatul, planul de conversie
❓ Chestionarul de fermă (~10 întrebări, precompletat)
Culturile principale și producția medie (t/ha) pe ultimii 3 ani
Câte îngrășăminte cu azot folosiți (kg/ha)?
Cum lucrați solul? (arătură / minimă / no-till)
Folosiți culturi de acoperire sau rotație?
Irigați acum? Cu ce sistem?
Aveți asigurare pentru culturi?
Aveți certificări? (ecologic, GlobalGAP)
Aveți contracte de vânzare cu procesatori sau retaileri?
În ce luni încasați cel mai mult?
Ce faceți cu utilajul vechi și cu deșeurile (ambalaje, folie)?
📦 După aprobare
Când	Ce
La tragere	factura finală, care corespunde configurației aprobate
După instalare	procesul-verbal de punere în funcțiune + poze geolocalizate
Periodic	verificare automată prin satelit (parcelele sunt cultivate, vegetația e sănătoasă)
La 12 luni	consumul real (apă / energie / motorină), care se compară cu estimarea
Orice informație lipsă devine condiție înainte de tragere, nu motiv de respingere.

8. Cum construim varianta de credit verde
Pasul 1 — Verificăm investiția inițială
Calculăm indicatorul modulului (de ex. economia de apă) cu formula din config. Îl comparăm cu pragul.

Pasul 2 — Re-ingineria investiției (dacă e sub prag)
În loc să respingem dosarul, Agentul 1 caută în catalogul de upgrade-uri (data/catalog/<modul>.json) cea mai ieftină combinație care trece pragul.

Exemplu: aspersie clasică (15% economie) → + picurare + senzori de umiditate (32% economie), cu un cost suplimentar mic.

Pasul 3 — Construim cele două opțiuni
Opțiunea A — standard	Opțiunea B — verde
Investiție	cea inițială	cea optimizată
Dobândă	standard	redusă (linie FEI / InvestEU / Green Bond)
Garanție	ipotecă	garanție FEI (fără ipotecă)
Costuri ipotecă	evaluare, notar, asigurare	0
Rate	lunare egale	sezoniere (grație + plăți după recoltă)
Economii	mici	mari (apă + energie + motorină)
Dobânzile, procentele de garanție și costurile se iau din config/financing-lines.json și se confirmă cu mentorii Raiffeisen.

Pasul 4 — Comparăm cu motorul financiar (cod, nu AI)
Calcul	Formula
Rată lunară	PMT = P · r / (1 − (1 + r)^−n), cu r = dobânda anuală / 12
Rate sezoniere	aceeași valoare totală, plătită doar în lunile cu încasări
Economii lunare	cantitate economisită × preț (apă, kWh, litri motorină)
Costuri ipotecă	cost inițial + cost anual × ani
Avantajul net	(economii B − plăți B − costuri B) − (economii A − plăți A − costuri A)
CO₂ evitat	cantitate economisită × factor de emisie
Recuperarea upgrade-ului	cost upgrade / economie lunară suplimentară
Fiecare formulă are teste automate cu valori fixe. Dacă un test pică, demo-ul e stricat.

Pasul 5 — Verificăm capacitatea de plată
Rata (sau rata sezonieră) trebuie să încapă în cashflow-ul din Open Banking, conform limitei din config.

Pasul 6 — Recomandarea
Opțiunea B e recomandată doar dacă este eligibilă și avantajul net este pozitiv.

9. Arhitectura tehnică
Stack
Zonă	Tehnologie
Frontend	React + TypeScript + Tailwind + Shadcn UI (pornit din Lovable), Leaflet pentru hărți, Recharts pentru grafice
Backend	Node.js + TypeScript + Fastify
AI	AWS Bedrock, ConverseCommand cu Claude (citire PDF + tool use), regiune EU
Fișiere	AWS S3, cu fallback pe disc local
Live	Server-Sent Events (SSE)
Validare	zod (aceleași scheme pentru AI, backend și frontend)
Teste	vitest
Structura repo-ului
greenstruct-agro/
├── frontend/                  # aplicația React
│   └── src/
│       ├── views/sme/         # ecranul fermierului
│       ├── views/officer/     # ecranul ofițerului
│       └── components/        # hartă, timeline, carduri A/B, raport
├── backend/
│   └── src/
│       ├── routes/            # API + SSE
│       ├── orchestrator/      # ciclul de viață al dosarului
│       ├── agents/            # cei 3 agenți (prompt + tools)
│       ├── tools/             # motorul financiar + calcule (DETERMINIST)
│       ├── modules/           # config pentru cele 6 module
│       ├── services/          # Bedrock, S3
│       ├── mock-external-apis/# ANAF, APIA, ANSVSA, Open Banking, climă, Natura 2000
│       └── fallback/          # răspunsuri salvate pentru demo
├── shared/                    # tipuri + scheme zod comune
├── data/
│   ├── catalog/               # catalogul de upgrade-uri pe module
│   └── demo/                  # PDF-urile și datele pentru demo
└── config/                    # praguri, dobânzi, factori de emisie
API
Endpoint	Ce face
POST /api/runs	creează un dosar (CUI + modul + documente + chestionar) și întoarce runId
GET /api/runs/:id	starea completă a dosarului
GET /api/runs/:id/events	fluxul live de evenimente (SSE)
POST /api/runs/:id/approve	ofițerul aprobă
Evenimente live
state.transition · agent.started · agent.thought · agent.tool_call · agent.tool_result · agent.completed · agent.degraded · run.completed · run.failed

Planul B pentru demo (fallback)
Nivel	Când	Ce se întâmplă
1. Live	normal	AWS Bedrock real
2. Retry	AWS răspunde greu	reîncercare + model de rezervă
3. Cache	timeout	răspunsul salvat de la o rulare anterioară cu aceleași documente
4. Golden	AWS indisponibil / fără internet	redăm o rulare reală înregistrată, cu același timing
Motorul financiar rulează mereu live, pentru că e cod local.

10. Roluri și task-uri
👤 Frontend Lead
Responsabil de: tot ce vede juriul.

 Layout split-view: fermier (stânga) / ofițer (dreapta)
 Wizard-ul fermierului: CUI → modul → parcele → documente → chestionar
 Harta parcelelor (Leaflet) cu straturile de risc
 Conectarea la SSE și timeline-ul live al agenților
 Cardurile A vs. B + graficul cu rate sezoniere
 Raportul de conformitate + butoanele Aprobă / Cere documente
 Polish pentru proiector (contrast, fonturi mari, animații)
Începe imediat cu datele din data/demo/demo-scenario.json.

👤 Backend Lead
Responsabil de: server, fluxul de date și calcule.

 Server Fastify + cele 4 endpoint-uri + SSE
 Motorul financiar + teste (rate, rate sezoniere, economii, CO₂, comparație)
 Orchestratorul: ciclul de viață al dosarului + evenimentele
 Sistemul de module (citirea config-urilor)
 Mock-uri: ANAF, APIA, ANSVSA, Open Banking, risc climatic, Natura 2000, nitrați, satelit
 Fallback-ul (retry → cache → golden)
 Upload S3 cu fallback local
Începe imediat cu motorul financiar. Nu depinde de nimeni.

👤 AI Engineer
Responsabil de: cei 3 agenți și AWS Bedrock.

 Acces AWS Bedrock funcțional (regiune EU, model activat)
 Funcția generică runAgent (loop cu tool calling + validare zod)
 Agent 2 (primul, pentru că nu are nevoie de PDF-uri)
 Agent 1 (citire PDF + prag + căutare upgrade)
 Agent 3 (raport)
 Prompt-uri care citesc regulile din config-ul modulului
 Înregistrarea rulărilor demo pentru fallback
Gata când: fiecare agent dă output valid de 10 ori din 10.

👤 Product, Date & Demo
Responsabil de: cifre realiste, povestea și prezentarea.

 Prima oră: întrebările pentru mentorii Raiffeisen (vezi mai jos)
 Config-urile celor 6 module: praguri, documente, întrebări
 Cataloagele de upgrade-uri (prețuri și eficiențe credibile)
 Condițiile produselor (dobânzi, garanții, costuri) în config/
 PDF-urile demo: ferma de legume și ferma de vaci
 Textele în română pentru fermier
 Scriptul demo + pitch deck-ul
 Conducerea repetițiilor (inclusiv cu internetul oprit)
Întrebări pentru mentorii Raiffeisen:

Ce praguri folosește banca pentru „verde” la irigații, utilaje și zootehnie?
Care sunt termenii actuali pentru Credit BIO, finanțarea irigațiilor și garanția InvestEU?
Ce raportează echipa Green Bonds pentru categoria Agriculture and forestry?
11. Planul pe etape
Etapă	Frontend	Backend	AI	Product / Demo
0. Start	layout split-view	schelet server + motor financiar	acces Bedrock	întrebări mentori + cifre
1. Bucăți separate	ecrane cu date fake	orchestrator + SSE + mock-uri	Agent 2, apoi Agent 1	config module + cataloage
2. Integrare	conectare la SSE real	conectare agenți reali	Agent 3 + prompt-uri stabile	PDF-uri demo + script
3. Siguranță	polish + hartă	fallback + cache	înregistrare rulări demo	pitch deck
4. Repetiție	toți	toți	toți	conduce repetițiile
🚩 Punct de control la jumătatea hackathonului: un dosar trece complet de la upload la raport, chiar dacă arată urât. După acest punct nu mai adăugăm funcționalități noi, doar îmbunătățim.

12. Demo-ul
Moment	Ce arătăm	Durată
Rularea principală (live)	Fermă de legume, 40 ha, sud-est. Cere aspersie clasică → sub pragul de apă → agentul propune picurare + senzori + pompă solară → comparație A/B cu rate după recoltă → raport cu harta parcelelor	~2 min
A doua rulare (rapidă)	Fermă de vaci, 150 de capete → biogaz. Arată că același sistem tratează alt tip de investiție	~30 sec
Ecranul de module	cele 6 carduri, toate funcționale	10 sec
Demo-ul e gata când
 Un dosar trece live prin cei 3 agenți și se vede pe ambele ecrane
 Se vede momentul „sub prag → upgrade → peste prag”
 Avantajul net în EUR e calculat de cod și are teste
 Raportul are DNSH, impact, etichetă Green Bond și condiții
 A doua rulare (biogaz) funcționează
 Demo-ul merge fără internet
 Totul durează sub 3 minute și a fost repetat de cel puțin 3 ori
13. Reguli de lucru în echipă
shared/ e contractul. Tipurile și schemele se schimbă doar cu acordul celor afectați.
AI-ul nu calculează. Orice cifră afișată vine din backend/src/tools/.
Nicio valoare hard-codată. Praguri, dobânzi și factori de emisie stau în config/.
Demo-ul e sfânt. Nimeni nu face push pe main în ultimele ore fără ca demo-ul să treacă local.
Branch-uri pe rol: frontend/..., backend/..., ai/..., product/..., cu PR-uri mici.
Fără date reale de clienți. Doar date demo și mock-uri.
