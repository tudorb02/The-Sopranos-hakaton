# Busola · frontend persoane fizice

Ecranele statice ale coach-ului financiar, gândit ca funcție opțională în aplicația Smart Mobile.
Coach-ul apare în tabul Produse și se activează doar dacă utilizatorul vrea. Nu face parte din onboarding-ul aplicației.
Doar interfață: datele sunt fictive și nu există logică de business. Singurul comportament este navigarea între ecrane.

Demo-ul are doi clienți persoană fizică, cu același coach și date diferite:
- Daria, salariată, cu salariul pe 5;
- Matei, student fără venit stabil: bani de la familie, o bursă nesigură și meditații. Coach-ul pune accent pe cheltuielile necesare, pe economisire și pe idei de dezvoltare (vezi `design/coach-students.md`).

Contul de persoană juridică, Legume Bărăgan SRL (o fermă de legume), deschide **creditul verde pentru investiții**. Agricultura e primul domeniu al platformei; celelalte domenii apar ca „În curând” (vezi `design/pj-greenstruct.md`).

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
| `#/firma` | Persoană juridică: tabul Produse, cu cardul „Credit verde pentru investiții · Nou”, cererea trimisă și produsele firmei |
| `#/verde` | Alegerea domeniului: Agricultură e disponibilă; Industria alimentară, Silvicultură, Pescuit și acvacultură apar „În curând”, fără acțiune |
| `#/verde/agro` | Ce urmează: cum decurge, ce să ai la îndemână, informarea |
| `#/verde/agro/firma` | Pasul 1: firma, din contul firmei; acordurile pentru APIA, ANSVSA și Open Banking; datele găsite, fiecare cu sursa lui |
| `#/verde/agro/investitie` | Pasul 2: cele 6 tipuri de investiții și criteriul verde al celei alese |
| `#/verde/agro/unde` | Pasul 3: parcelele din APIA, pe o hartă SVG (merge și fără internet), și ce s-a văzut pe hartă |
| `#/verde/agro/documente` | Pasul 4: documentele pentru orice investiție și cele pentru irigații; ce lipsește devine condiție, nu respingere |
| `#/verde/agro/intrebari` | Pasul 5: cele 10 întrebări despre fermă, pe un ecran, completate din APIA și din conturi |
| `#/verde/agro/analiza` | Pasul 6: cei 3 agenți, cu nume pe înțelesul fermierului, și mesajele lor |
| `#/verde/agro/oferta` | Pasul 7: creditul standard și cel verde, câștigul pe 5 ani, ratele după recoltă, obligațiile, garanția FEI |
| `#/verde/agro/dosar` | Dosarul trimis: statusul, ce lipsește înainte de tragere, ce trimiți după aprobare |
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

## Cine vede datele

Ca nimeni să nu creadă că oricine îi poate vedea finanțele, informarea spune explicit cine vede ce:
- **coach-ul:** tu și coach-ul; un consultant doar dacă îi arăți tu profilul, în Chat 1:1; altor firme, niciodată;
- **creditul verde:** analiza o vede doar firma; ofițerul de credit primește dosarul abia după „Trimite cererea la bancă”; Fondul European de Investiții primește doar datele cerute pentru garanție;
- **ce nu facem niciodată:** nu cerem parole, PIN-uri sau coduri; nu mutăm bani fără aprobare; nu trimitem date în afara UE;
- **ultimele accesări:** cine a citit datele și când.

O variantă scurtă apare acolo unde se dau datele: la activarea coach-ului, în Profil și la pasul „Firma ta”. Textele sunt propuneri pentru echipa juridică. Implementarea reală trebuie să le respecte: procesare doar în UE, un model care nu învață din datele clienților, jurnal de acces.

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
