# API Node pentru demo-ul personal — plan înainte de implementare

Branch: `feat/server-node-api`, pornit din `main` (`6a0c29a`).
Date inventariate: `persona.js`, `data/{personas,demo,student,tracking,activation,
accounts,bank,legal}.js` și toate ecranele personale, inclusiv activarea.

## Contract de citire

Prefix separat: `/api/demo/v1`. `:persona` este `pf` (Daria) sau `student` (Matei).
Identificatorii vechi `t1…t20`, `m1…m33` rămân chei de prezentare; DB are UUID.
Răspunsurile păstrează cheile, opționalitatea și unitățile originale ale ecranelor.
Sumele sunt întregi în bani în DB și în calcule; conversia în lei are loc numai
la serializarea JSON pentru contractul existent. Nu se scriu totaluri calculate în DB.

| Metodă/rută | Consumator | Date |
|---|---|---|
| GET `/accounts` | Login PF | `login`, `accounts` personale |
| GET `/catalog` | componente comune | categorii, informare, produse și texte statice |
| GET `/personas/:persona` | PersonaProvider | obiectul compus integral, cu forma vechiului `usePersona()` |
| GET `/personas/:persona/products` | Produse | `client`, `entry`, `products`; disponibil și după dezactivare |
| GET `/personas/:persona/summary` | Rezumat | `today`, `cycle`, `week`, `lastMessage`, `insight`, `budgets`, `agenda`, `essentials` când există |
| GET `/personas/:persona/tracking` | Cheltuieli | `spending`, `filters`, `review`, `days`, categorii și etichete |
| GET `/personas/:persona/transactions/:id` | Detalii | tranzacția în forma actuală, inclusiv grupul `day` |
| GET `/personas/:persona/budgets` | Bugete | `allocation`, `budgetGroups`, `budgets`, `cycle`, `question`, `unbudgeted` |
| GET `/personas/:persona/goals` | Obiective | `goal`, `pots`, `nextGoals`, `reserve`, `services` |
| GET `/personas/:persona/ideas` | Idei (Matei) | `ideas` |
| GET `/personas/:persona/profile` | Profil | `profile`, `services`, informare și preferințe de confidențialitate |
| GET `/personas/:persona/chat` | Chat | `chat`, `services` |
| GET `/personas/:persona/activation` | Activare | `intro`, `statements`, `calendar`, `apps`, `questions`, `analysis`, `findings` |

Frontend-ul încarcă obiectul compus pentru a păstra `usePersona()` și navigarea
actuale. Rutele pe ecran permit citire independentă și verificarea contractului.
Filtrarea/căutarea poate fi făcută prin query pe `/tracking`, fără a schimba forma.

## Contract de scriere și acțiuni UI

| Metodă/rută | Acțiune |
|---|---|
| PATCH `/personas/:persona/transactions/:id` | Salvează denumire, categorie, notă, etichete, excludere și regulă de comerciant |
| POST `/personas/:persona/transactions/:id/splits` | Împarte suma în categorii, cu conservarea exactă a sumei |
| POST `/personas/:persona/transactions/:id/receipt` | Atașează bonul; conținutul este stocat în DB |
| POST `/personas/:persona/categories` | Categorie nouă, disponibilă în picker |
| POST `/personas/:persona/budgets` | Adaugă buget |
| PATCH `/personas/:persona/budgets/:id` | Modifică limită/perioadă, fără contoare trimise de client |
| PATCH `/personas/:persona/profile/:section` | Corectează secțiunile Despre tine, Banii tăi și Cum comunicăm |
| PATCH `/personas/:persona/preferences` | Permisiuni, confidențialitate, sugestii servicii |
| PATCH `/personas/:persona/services/:id` | Salvează decizia de pe card, fără activare bancară reală |
| POST `/personas/:persona/ideas/decision` | Adaugă ideea în plan sau o respinge |
| POST `/personas/:persona/chat/messages` | Salvează mesajul, fără a inventa răspuns AI |
| POST `/personas/:persona/chat/:index/decision` | Aprobă/refuză propunerea din conversație |
| POST `/personas/:persona/imports` | Import demo din cont pentru perioada aleasă, idempotent |
| POST `/personas/:persona/statements` | Atașează extras; validare tip/mărime, fără parserul Python |
| PATCH `/personas/:persona/calendar` | Conectare demo și opțiunile bugetului de cadouri |
| PATCH `/personas/:persona/apps/:name` | Alegerea aplicației monitorizate |
| PUT `/personas/:persona/answers/:question` | Salvează opțiuni și câmpuri înainte de Continuă |
| POST `/personas/:persona/coach` | Activează demo-ul, inclusiv după dezactivare |
| DELETE `/personas/:persona/coach` | Șterge datele coach-ului, păstrând contul de login |

Navigarea, extinderea cardurilor, filtrele și drafturile anulate rămân stări UI.
Scrierile confirmate refac obiectul din API. Erorile păstrează draftul și permit
reîncercarea; cererile vechi sunt anulate/ignorate la schimbarea persoanei.

## Schema și seed

DB `nexxt_demo`, creată automat fără a modifica baza `nexxt` a backend-ului Python.
Migrații SQL versionate, seed tranzacțional și idempotent, fără ștergere la restart.
Tabele pentru conturi demo, persoane/context, cicluri, tranzacții, obligații fixe,
bugete, obiective/depuneri/proiecții, abonamente, permisiuni/preferințe, răspunsuri,
mesaje, documente și decizii. Conținutul static este JSON servit de API.

O copie înghețată a datelor originale rămâne numai în fixture-urile testelor.
Seed-ul operațional păstrează fapte de bază, nu copii ale totalurilor UI.
Testele compară răspunsurile, integral și per ecran, cu fixture-urile inițiale;
apoi modifică faptele și verifică recalcularea și persistența.

## Presupuneri explicite

- Cererea Node/Express este o excepție pentru demo la stack-ul Python din CLAUDE.
  `backend/`, `data/green/`, `screens/green/` și `Business.jsx` nu se modifică.
- Nu există auth real: selectarea persoanei este mecanism de demo, numai pe
  localhost. Namespace-ul separat împiedică amestecarea cu API-ul Python.
- `DEMO_TODAY=2026-11-12` este singura sursă a zilei de referință; București
  este fusul orelor din tranzacții. Nu se folosește ceasul mașinii în calcule.
- Fixele Dariei de 3.020 lei sunt obligații planificate, distincte de cei
  2.455 lei deja plătiți. Cadourile de 380 lei se plătesc din pușculița de 1.200
  lei, separat de cele 739 lei cheltuieli variabile. Aceste plăți suplimentare
  nu apar artificial în lista inițială de 20 tranzacții.
- Matei: sold inițial 361 lei + încasări 1.500 − economii 150 − cheltuieli
  1.071 = 640. Necesare rămase 503, opționale rămase 137. Fondul are 650 lei
  efectivi; cei 665 din planul lunii includ încă 15 lei proiectați, neîncasați.
- Istoricul pentru mediile din Profil este seed separat de perioada curentă.
  Nu se pretinde că lista curentă reprezintă 12/24 luni de istoric.
- Conectarea calendarului, Screen Time, importul PDF/XLS și serviciile băncii
  sunt acțiuni de demo persistate. Nu se implementează OAuth, Screen Time real,
  tranzacții bancare, parsare PDF sau conversație AI în această integrare.
- După dezactivare, datele personale ale coach-ului sunt șterse în cascadă;
  reactivarea reîncarcă explicit scenariul fictiv. Restartul nu îl reface tacit.
- Textele juridice originale sunt păstrate pentru fidelitate vizuală; sunt
  propuneri de produs, nu o certificare a securității demo-ului.
