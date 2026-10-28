# Busola · frontend persoane fizice

Ecranele statice ale coach-ului financiar, gândit ca un tab nou („Coach”) în aplicația Smart Mobile.
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
| `#/rezumat` | Banii rămași până la salariu, săptămâna curentă, ultimul mesaj al coach-ului, bugete, o observație, ce urmează |
| `#/bugete` | Împărțirea salariului, bugete pe categorii, cheltuieli fără buget, o întrebare despre o plată nesortată |
| `#/obiective` | Obiectivul „Laptop”: plan pe luni, din ce se strâng banii, unde stau banii, bani puși deoparte |
| `#/profil` | „Ce știu despre tine”: fiecare rând cu sursa lui (observat, spus, stabilit, estimat), permisiuni, sugestii de servicii |
| `#/chat` | Discuția cu coach-ul, pe tot ecranul, ca un flux din aplicație |

## Structură

```
src/
  data/demo.js      toate datele fictive; de înlocuit cu apeluri API
  components/       layout (antet, sub-pagini, bara aplicației), ui, grafice, iconițe
  screens/          cele 5 ecrane
  lib/format.js     formatare în lei (ro-RO)
  styles.css        tokenuri de design și stiluri
```

## Design

- Aspectul urmează capturile Smart Mobile din App Store și raiffeisen.ro, văzute pe 28.10.2026:
  - fundal bej cald, carduri albe;
  - galben de brand pentru acțiunea principală, linkuri teal, iconițe de contur;
  - sume mari, cu „,00 LEI” scris mic.
- Culorile observate pe raiffeisen.ro sunt definite în OKLCH în `styles.css`: galben #FEE600, text #2B2D33, teal #037080, fundal #F1EDE6.
- Fontul este Hanken Grotesk (licență OFL, inclus prin npm), în locul fontului proprietar al băncii. Funcționează și fără internet.
- Nu folosim logo-ul, ilustrațiile sau fontul Raiffeisen.
- Celelalte taburi din bara de jos (Acasă, Plăți, Carduri, Produse) sunt doar decor.
- Textele au contrast de cel puțin 4,5:1 pe fundalurile folosite.

## Pentru funcționalitate

- Înlocuiți `src/data/demo.js` cu date din API. Componentele primesc deja datele ca proprietăți.
- Butoanele (Aprob, Adaugă un buget, opțiunile din întrebări, comutatoarele) nu au încă acțiuni.
- Barele și indicatorii primesc procentul prin variabila CSS `--p`.
