# Busola · frontend persoane fizice

Ecranele statice ale coach-ului financiar, gândit ca funcție opțională în aplicația Smart Mobile.
Coach-ul apare în tabul Produse și se activează doar dacă utilizatorul vrea. Nu face parte din onboarding-ul aplicației.
Doar interfață: datele sunt fictive și nu există logică de business. Singurul comportament este navigarea între ecrane.

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
| `#/login`, `#/login/pj` | Login simulat (pornire implicită): alegi contul demo de persoană fizică sau juridică. Nu se cer date de autentificare |
| `#/produse` | Persoană fizică: tabul Produse, cu cardul „Coach financiar · Nou” |
| `#/firma` | Persoană juridică: produsele firmei și „Coach pentru firme · În curând” (funcționalitatea vine ulterior) |
| `#/informare` | Informarea oficială: sfaturi orientative, deciziile îți aparțin, date criptate, ce date se folosesc, cum le ștergi |
| `#/activare` | Activarea coach-ului: ce face și ce nu face |
| `#/activare/extrase` | Pasul 1: importul extraselor din contul curent (perioada aleasă) și atașarea extraselor anterioare (PDF, XLS, CSV) |
| `#/activare/calendar` | Pasul 2, opțional: Google Calendar sau calendarul telefonului; ce citește și ce nu |
| `#/activare/calendar/conectat` | Calendarul conectat, evenimentele găsite și bugetul pentru cadouri |
| `#/activare/aplicatii` | Pasul 3, opțional: abonamentele urmărite prin Screen Time |
| `#/activare/intrebari/1` … `6` | Pasul 4: cele 6 întrebări de început, câte una pe ecran |
| `#/activare/analiza` | Pasul 5: analiza celor 24 de luni |
| `#/activare/gata` | Ce a găsit coach-ul și primul pas propus |
| `#/rezumat` | „Până pe 4 decembrie mai ai disponibili…”, săptămâna curentă, ultimul mesaj, bugete, observații, ce urmează |
| `#/bugete` | Împărțirea salariului, bugete pe categorii, cheltuieli fără buget, o întrebare despre o plată nesortată |
| `#/obiective` | Obiectivul „Laptop”: plan pe luni, din ce se strâng banii, unde stau banii |
| `#/profil` | „Ce știu despre tine”: extrasele, date cu sursa lor, permisiuni, sugestii de servicii, dezactivare |
| `#/extrase` | Gestionarea extraselor, deschisă din Profil |
| `#/chat` | Discuția cu coach-ul, pe tot ecranul |

Pentru demo: deschide aplicația și intră ca persoană fizică, apoi ca persoană juridică. Linkul „Schimbă contul” de deasupra aplicației te duce înapoi la login.

Informarea apare:
- pe scurt, într-o bandă fixă deasupra barei de jos pe toate paginile coach-ului și sus în discuție;
- complet, la activare, în Profil și pe `#/informare`.

Textul ei e o propunere și trebuie validat de echipa juridică a băncii. Afirmația „criptate” trebuie să fie adevărată în implementarea reală, atât la transmitere, cât și la stocare.

Data din primul card („Până pe …”) vine din profil. Pentru un salariat e ziua dinaintea salariului, pentru un pensionar ziua dinaintea pensiei, iar pentru venituri neregulate o dată aleasă de utilizator. Vezi `cycle` în `src/data/demo.js`.

## Structură

```
src/
  data/demo.js          datele fictive ale coach-ului; de înlocuit cu apeluri API
  data/activation.js    conținutul cardului din Produse și al pașilor de activare
  data/accounts.js      conturile demo din login și produsele firmei
  data/legal.js         textul informării
  components/           layout (Produse, coach, fluxuri), ui, grafice, iconițe
  screens/              ecranele coach-ului și tabul Produse
  screens/activation/   pașii de activare și rutele lor (routes.js)
  lib/format.js         formatare în lei (ro-RO)
  styles.css            tokenuri de design și stiluri
```

## Design

- Aspectul urmează capturile Smart Mobile din App Store și raiffeisen.ro, văzute pe 28.10.2026:
  - fundal bej cald, carduri albe;
  - galben de brand, linkuri teal, iconițe de contur;
  - sume mari, cu „,00 LEI” scris mic.
- Galbenul apare în:
  - cardurile principale și tabul activ;
  - barele de progres, pașii parcurși și răspunsurile alese;
  - bifele și statusurile active.
- Culorile observate pe raiffeisen.ro sunt definite în OKLCH în `styles.css`: galben #FEE600, text #2B2D33, teal #037080, fundal #F1EDE6.
- Fontul este Hanken Grotesk (licență OFL, inclus prin npm), în locul fontului proprietar al băncii. Funcționează și fără internet.
- Nu folosim logo-ul, ilustrațiile sau fontul Raiffeisen.
- Celelalte taburi din bara de jos (Acasă, Plăți, Carduri) sunt doar decor.

## Pentru funcționalitate

- Înlocuiți `src/data/demo.js` și `src/data/activation.js` cu date din API. Componentele primesc deja datele ca proprietăți.
- Butoanele (Importă extrasele, Conectează, Aprob, opțiunile din întrebări, comutatoarele) nu au încă acțiuni.
- Barele și indicatorii primesc procentul prin variabila CSS `--p`.
