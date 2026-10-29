# Busola · frontend persoane fizice

Ecranele statice ale coach-ului financiar, gândit ca funcție opțională în aplicația Smart Mobile.
Coach-ul apare în tabul Produse și se activează doar dacă utilizatorul vrea. Nu face parte din onboarding-ul aplicației.
Ecranele coach-ului (Busola, persoane fizice) sunt statice: date fictive, fără logică de business. Creditul verde (`#/verde/agro/...`) și zona ofițerului (`#/ofiter/...`) sunt conectate la backend-ul Spring (vezi „Cu backend-ul”).

Demo-ul are doi clienți persoană fizică, cu același coach și date diferite:
- Daria, salariată, cu salariul pe 5;
- Matei, student fără venit stabil: bani de la familie, o bursă nesigură și meditații. Coach-ul pune accent pe cheltuielile necesare, pe economisire și pe idei de dezvoltare (vezi `design/coach-students.md`).

Contul de persoană juridică, Legume Bărăgan SRL (o fermă de legume), deschide **consultantul pentru credit verde**: un agent care te ajută să pregătești cererea de credit, cu cele mai bune șanse de aprobare și cele mai bune clauze. Agricultura e primul domeniu al platformei; celelalte domenii apar ca „În curând”. Fluxul urmează README-ul GreenStruct (branch-ul `B2B_Agro`, 28.10.2026) și `design/pj-greenstruct.md`.

## Pornire

Necesită Node.js 20.19 sau mai nou (testat cu Node 24).

```bash
cd frontend
npm install
npm run dev
```

Deschide http://localhost:5173. `npm run build` produce versiunea statică în `frontend/dist`.

## Ecrane

| Rută | Ecran |
|---|---|
| `#/login`, `#/login/pj` | Login simulat (pornire implicită): alegi unul dintre cele două conturi demo de persoană fizică (Daria sau Matei) ori contul de persoană juridică (Legume Bărăgan SRL). Nu se cer date de autentificare |
| `#/intra/pf`, `#/intra/student` | Intrarea în contul ales: coach-ul arată de acum datele acelui client, apoi se deschide Produse |
| `#/produse` | Persoană fizică: tabul Produse, cu cardul „Coach financiar · Nou” |
| `#/firma` | Persoană juridică: tabul Produse, cu cardul „Consultant pentru credit verde · Nou”, cererea trimisă și produsele firmei |
| `#/verde` | Alegerea domeniului: Agricultură e disponibilă; Industria alimentară, Silvicultură, Pescuit și acvacultură apar „În curând”, fără acțiune |
| `#/verde/agro` | Ce urmează: cum decurge, ce face consultantul și ce nu, ce să ai la îndemână, informarea |
| `#/verde/agro/firma` | Pasul 1: firma, din contul firmei; acordurile pentru APIA și Open Banking; datele găsite, fiecare cu sursa lui (inclusiv statutul de IMM) |
| `#/verde/agro/categorie` | Pasul 2: „Ce vrei să faci?”: cele 6 categorii și criteriul verde al celei alese |
| `#/verde/agro/unde` | Pasul 3: parcelele din APIA, pe o hartă SVG (merge și fără internet), și ce s-a văzut pe hartă: secetă, stres hidric, Natura 2000, nitrați |
| `#/verde/agro/documente` | Pasul 4: doar documentele esențiale ale categoriei; cele opționale îmbunătățesc estimarea |
| `#/verde/agro/intrebari` | Pasul 5: întrebările esențiale ale categoriei și cea despre echipamentul vechi, completate din APIA |
| `#/verde/agro/analiza` | Pasul 6: cei 3 agenți, cu nume pe înțelesul fermierului, și mesajele lor |
| `#/verde/agro/oferte` | Pasul 7: creditul clasic și cel verde, nivelul Verde Plus, câștigul pe 5 ani, de ce e mai mică dobânda, ratele după recoltă, garanția FEI |
| `#/verde/agro/schimbari` | Pasul 8: ce să schimbi la investiție, cât costă în plus și în cât timp se recuperează |
| `#/verde/agro/cerere` | Pasul 9: varianta aleasă și verificarea consultantului: cât de pregătit e dosarul, ce mai poți îmbunătăți, clauzele de cerut, obligațiile |
| `#/verde/agro/dosar` | Dosarul trimis: statusul, impactul estimat, ce trimiți după aprobare |
| `#/verde/informare` | Informarea pentru firme: cine vede dosarul, ce nu facem niciodată, ce date folosim, ultimele accesări |
| `#/informare` | Informarea oficială: recomandări cu caracter informativ, deciziile îți aparțin, date criptate, cine îți vede datele, ce nu facem niciodată, ce date se folosesc, ultimele accesări, cum le ștergi |
| `#/activare` | Activarea coach-ului: ce face și ce nu face |
| `#/activare/extrase` | Pasul 1: importul extraselor din contul curent (perioada aleasă) și atașarea extraselor anterioare (PDF, XLS, CSV) |
| `#/activare/calendar` | Pasul 2, opțional: Google Calendar sau calendarul telefonului; ce citește și ce nu |
| `#/activare/calendar/conectat` | Calendarul conectat, evenimentele găsite și bugetul pentru cadouri |
| `#/activare/aplicatii` | Pasul 3, opțional: abonamentele urmărite prin Screen Time |
| `#/activare/intrebari/1` … `6` | Pasul 4: cele 6 întrebări de început, câte una pe ecran; studentul primește alte întrebări (surse de venit, necesare, idei) |
| `#/activare/analiza` | Pasul 5: analiza extraselor (24 de luni pentru Daria, 12 pentru Matei) |
| `#/activare/gata` | Ce a găsit coach-ul și primul pas propus |
| `#/rezumat` | „Disponibil până pe …”, săptămâna curentă, ultimul mesaj, bugete, observații, ce urmează. La student: cât îi ajung banii la ritmul actual și necesarele rămase până la final de perioadă |
| `#/cheltuieli` | Urmărirea cheltuielilor: total pe perioada de buget, împărțit pe categorii, plăți de verificat, căutare, filtre, plățile grupate pe zile |
| `#/cheltuieli/t1` … `t20` (Daria), `m1` … `m33` (Matei) | Detaliile unei plăți: redenumire (de exemplu „Espresso” în loc de „CAFEAEXPRES SRL”), categorie, notă, etichete, regulă pentru același comerciant, „Exclude din cheltuieli”, împărțire, bon fiscal |
| `#/bugete` | Împărțirea banilor din perioadă, bugete pe categorii (la student: Necesare, apoi Opționale), cheltuieli fără buget, o întrebare despre o plată fără categorie |
| `#/obiective` | Obiectivul principal (Daria: laptop; Matei: fond de siguranță, apoi un curs), planul lunar, din ce economisești, unde păstrezi banii și, la student, o sugestie de serviciu |
| `#/idei` | Doar la student: idei de dezvoltare (venituri, educație financiară gratuită de la bancă, oportunități). Pentru Daria, ruta duce la Rezumat |
| `#/profil` | „Ce știu despre tine”: extrasele, date cu sursa lor, permisiuni, cardurile de servicii, dezactivare |
| `#/extrase` | Gestionarea extraselor, deschisă din Profil |
| `#/chat` | Discuția cu coach-ul, pe tot ecranul |

Pentru demo: intră cu Daria, apoi cu Matei, ca să vezi cum se adaptează coach-ul la un venit stabil și la unul neregulat; la final, intră ca persoană juridică și parcurge creditul verde pentru fermă. Iconița „Ieși din cont” din antetul Produse te duce înapoi la login. Mențiunea „prototip, date fictive, neafiliat Raiffeisen Bank” apare doar în nota de pe ecranul de login.

Informarea apare:
- pe scurt, într-o bandă fixă deasupra barei de jos pe toate paginile coach-ului și sus în discuție;
- complet, la activare, în Profil și pe `#/informare`.

Textul ei e o propunere și trebuie validat de echipa juridică a băncii. Afirmația „criptate” trebuie să fie adevărată în implementarea reală, atât la transmitere, cât și la stocare.

Data din primul card („Disponibil până pe …”) vine din profil:
- pentru un salariat, ziua dinaintea salariului;
- pentru un pensionar, ziua dinaintea pensiei;
- fără venit stabil, ziua dinaintea următoarei încasări sigure (la Matei, banii de la familie, pe 1) sau o dată aleasă de utilizator.

Veniturile estimate, cum e bursa, intră în calcul doar după ce ajung în cont. Vezi `cycle` în `src/data/demo.js` și `src/data/student.js`.

## Cu backend-ul (creditul verde)

Creditul verde și zona ofițerului lucrează pe API-ul din `contracts/openapi.yaml`; nicio cifră nu e calculată sau formatată în frontend, toate vin din `RunView.calcs[calcId].display`.

```bash
# 1. backend (offline, fără Bedrock și ANAF)
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) GREENSTRUCT_ANAF_ENABLED=false GREENSTRUCT_ANALYSIS_DATE=2026-10-28 mvn spring-boot:run
# 2. frontend; Vite trimite /api către http://localhost:8080 (VITE_BACKEND_URL schimbă ținta, de ex. Prism pe :4010)
cd frontend && npm install && npm run dev
```

| Rută | Ce face |
|---|---|
| `#/verde/agro/firma` … `#/verde/agro/cerere` | cei 9 pași ai IMM-ului: CUI + acorduri, categoriile din `GET /api/modules` (cu „Dosar demo” pe fiecare), parcele pe harta SVG din GeoJSON, documente și întrebări din modul, analiza live (SSE), ofertele (`view=sme`), ce schimbi, trimiterea cererii |
| `#/verde/agro/dosar` | starea dosarului (trimis / aprobat / monitorizare), documentele cerute de bancă, condițiile înainte de tragere, rezultatul la 12 luni |
| `#/ofiter` | deschide un dosar după id, încarcă un dosar demo, dosare recente, portofoliul |
| `#/ofiter/dosar/<runId>` | panourile din README §8 pe `view=full`: dosarul firmei și harta, pașii agenților, analiza tehnică, structurarea creditului, raportul verde, acțiuni (Aprobă, Cere documente, PDF, Simulează 12 luni), portofoliul |

Comutatorul **IMM / Ofițer** de pe ecranele verzi păstrează id-ul dosarului în `sessionStorage`, ca o singură persoană să joace ambele roluri. IMM-ul nu vede fondurile, FEI dincolo de „fără ipotecă, datorită unei garanții europene”, DSCR sau descompunerea dobânzii; ecranele lui nu le afișează, iar liniile live sunt traduse din `lib/labels.js` (`TOOL_LINES_SME`).

Verificări fără browser, cu backend-ul pornit:

```bash
node scripts/smoke.mjs          # client API + SSE: demo, evenimente, view=sme, trimitere, aprobare, monitorizare, portofoliu, PDF
node scripts/screenshots.mjs    # Chrome headless prin DevTools (fără dependențe): parcurge fluxul cu click-uri reale și salvează capturi în /tmp/gs/shots
```

Fără credențiale AWS, doar rulările demo se termină; încărcarea propriilor PDF-uri cere Bedrock pentru citirea documentelor.

## Structură cod nou

```
src/lib/api.js        clientul API (erori {error:{code,message}} ca ApiError, NETWORK/UNAVAILABLE când backend-ul nu răspunde)
src/lib/sse.js        evenimentele live prin fetch streaming, cu reconectare ?after=<ultimul seq>
src/lib/calc.js       rezolvă calcId -> display; opțiunile clasic / verde
src/lib/hooks.js      useRun, useRunEvents, useModules, useFarm
src/lib/session.js    schița cererii și dosarul curent (sessionStorage)
src/lib/labels.js     textele în engleză pentru enum-uri (copie statică, fără cifre)
src/screens/green/agro/   pașii IMM-ului   src/screens/officer/   zona ofițerului
src/green-live.css    stilurile noi (fluxul IMM și zona ofițerului)
```

## Cine vede datele și cum le protejăm

Ca nimeni să nu creadă că oricine îi poate vedea finanțele, că i se pot fura datele sau că finanțele lui devin publice, informarea (`#/informare` pentru coach, `#/verde/informare` pentru firme) are:
- **cine vede datele:** la coach, tu și coach-ul; un consultant doar dacă îi arăți tu profilul, în Chat 1:1; altor firme, niciodată. La creditul verde, analiza o vede doar firma; banca primește dosarul gata pregătit abia după „Trimite cererea la bancă”, doar pentru aprobarea finală; Fondul European de Investiții primește doar datele cerute pentru garanție;
- **cum le protejăm:** criptare la transmitere și la stocare, acces doar din aplicație (PIN, amprentă, Face ID), un cod în loc de nume și IBAN pentru modelul AI, fără date de card;
- **ce rămâne privat:** nimic nu devine public (fără profiluri publice, clasamente sau comparații cu alți clienți); în rapoartele pentru obligațiunile verzi apar doar totaluri, fără numele firmei;
- **ce nu facem niciodată:** nu cerem parole, PIN-uri sau coduri; nu mutăm bani fără aprobare; nu trimitem date în afara UE;
- **ultimele accesări:** cine a citit datele și când;
- **dacă se întâmplă ceva:** telefon pierdut (*2000), incident de securitate (anunțăm clientul și autoritatea, cum cere legea), o bănuială.

Unde se dau datele apare un card scurt, „Datele tale rămân private” sau „Dosarul rămâne privat”: la activarea coach-ului și la pasul „Firma ta”. Profilul are linkul „Cine îți vede datele” și două setări, „Ascunde sumele pe ecran” și „Fără sume în notificări”. Banda de jos a coach-ului spune „Date criptate și private”.

Textele sunt propuneri pentru echipa juridică. Devin promisiuni de produs, așa că implementarea reală trebuie să le respecte: procesare doar în UE, un model care nu învață din datele clienților, pseudonimizare înainte de model, un jurnal de acces real, notificarea incidentelor.

## Sugestii de servicii

Un serviciu Raiffeisen apare doar pentru o nevoie spusă sau confirmată de client (regulile sunt în `design/coach-services.md`). Cardul (`components/services.jsx`) arată:
- ce este serviciul, pe scurt;
- „Cum te ajută”, pe fond galben: exact ce face pentru acest client, cu sumele lui;
- costurile și condițiile, varianta fără serviciu și motivul pentru care apare;
- linkul către pagina serviciului pe raiffeisen.ro (se deschide într-o filă nouă) și data informațiilor.

Cardurile apar în Obiective, în Profil și în discuție, în varianta completă sau compactă. Faptele despre servicii stau în `src/data/bank.js`; partea personală stă în datele fiecărui client. Studentului nu i se propun credite, overdraft sau rate.

## Structură

```
src/
  data/demo.js          datele fictive ale Dariei pentru coach; de înlocuit cu apeluri API
  data/student.js       datele fictive ale lui Matei, cu aceleași forme ca fișierele Dariei
  data/personas.js      cei doi clienți demo; ecranele îl citesc pe cel activ cu usePersona()
  data/bank.js          serviciile și paginile raiffeisen.ro la care trimite coach-ul
  data/activation.js    conținutul cardului din Produse și al pașilor de activare (Daria)
  data/accounts.js      conturile demo din login și produsele firmei
  data/tracking.js      categoriile, culorile lor și plățile Dariei din perioada curentă
  data/green/           creditul verde: domeniile (sectors.js), informarea (legal.js) și câte un pachet pe domeniu
                        (agro/: modulele, documentele, întrebările și dosarul demo; packs.js le leagă)
  persona.js            clientul activ, ales la login
  data/legal.js         textul informării
  components/           layout (Produse, coach, fluxuri), ui, grafice, iconițe, cardul de serviciu,
                        piesele creditului verde (green.jsx) și harta parcelelor (parcels.jsx)
  screens/              ecranele coach-ului și tabul Produse
  screens/activation/   pașii de activare și rutele lor (routes.js)
  screens/green/        alegerea domeniului, pașii creditului verde (comuni tuturor domeniilor) și rutele lor;
                        agro/ are doar ce e specific agriculturii (parcelele)
  lib/format.js         formatare în lei (ro-RO)
  styles.css            tokenuri de design și stiluri
```

## Design

- Aspectul urmează capturile Smart Mobile din App Store și raiffeisen.ro, văzute pe 28.10.2026:
  - fundal bej cald, carduri albe;
  - galben de brand, linkuri teal, iconițe de contur;
  - sume mari, cu „,00 lei” scris mic.
- Galbenul apare în:
  - cardurile principale și tabul activ;
  - barele de progres, pașii parcurși și răspunsurile alese;
  - bifele și statusurile active.
- Culorile observate pe raiffeisen.ro sunt definite în OKLCH în `styles.css`: galben #FEE600, text #2B2D33, teal #037080, fundal #F1EDE6.
- Ecranul de cheltuieli preia tiparele aplicațiilor mari de finanțe personale:
  - din Revolut: căutare, filtre și listă pe zile;
  - din Monzo: culori pe categorii;
  - din Copilot Money: plăți de verificat și reguli pe comerciant.
- Culorile categoriilor sunt validate pentru daltonism și au ordine fixă pe categorie: albastru Alimente, portocaliu Cafenele, verde Livrări de mâncare, violet Restaurante, roz Taxi, gri Fără categorie. Galbenul de brand nu e folosit ca și culoare de categorie.
- Fontul este Hanken Grotesk (licență OFL, inclus prin npm), în locul fontului proprietar al băncii. Funcționează și fără internet.
- Nu folosim logo-ul, ilustrațiile sau fontul Raiffeisen.
- Celelalte taburi din bara de jos (Acasă, Plăți, Carduri) sunt doar decor.

## Pentru funcționalitate

- Un domeniu nou pentru creditul verde înseamnă un folder nou în `src/data/green/`, o linie în `packs.js` și, dacă e nevoie, o variantă a pasului „unde”. Ecranele comune nu se schimbă.
- Cifrele ofertei vin, în implementarea reală, din motorul financiar (README-ul GreenStruct). Calculul valorilor demo e scris în comentariul din `src/data/green/agro/scenario.js`.

- Înlocuiți datele din `src/data/` cu date din API, păstrând formele din `demo.js` și `student.js`. Ecranele citesc clientul activ prin `usePersona()`.
- Butoanele (Importă extrasele, Conectează, Aprob, opțiunile din întrebări, comutatoarele) nu au încă acțiuni.
- Barele și indicatorii primesc procentul prin variabila CSS `--p`.
