# API Node pentru demo-ul personal

API Express separat pentru Daria (`pf`) și Matei (`student`). Nu folosește și nu
modifică backend-ul Python. PostgreSQL 16, baza **`nexxt_demo`**, prefix
**`/api/demo/v1`**, Node.js 24 sau mai nou.

## Pornire

Din rădăcina repository-ului, cu Docker pornit:

```sh
make setup
docker compose up --build -d
# Sau numai serviciile demo: make node-up
```

Serverul creează automat baza separată, rulează migrațiile și seed-ul înainte de
a asculta cereri. Frontend-ul așteaptă verificarea de sănătate a serverului.

- Frontend: http://localhost:8081 (suprascriere prin `FRONTEND_PORT`).
- API: http://localhost:3001/api/demo/v1/accounts.
- Contract: http://localhost:3001/api/demo/v1/openapi.json.
- Health: http://localhost:3001/health.

```sh
make node-test       # Vitest + Supertest, pe PostgreSQL în scheme temporare
make node-seed       # idempotent; nu resetează modificările
make node-openapi    # regenerează contractul, servit și de API
```

`DEMO_TODAY=2026-11-12` este data implicită; scrierile primesc data demo și ora reală. Se poate suprascrie în `.env`, apoi
recrea containerul `server`. Nu se folosește data mașinii pentru calcule.
`make setup` generează parola PostgreSQL local, în `.env` ignorat de Git.

## Fără Docker

Configurează din mediu `NODE_DATABASE_URL`, către baza `nexxt_demo`, și opțional
`NODE_ADMIN_DATABASE_URL`, pentru crearea ei. Acestea sunt URL-uri PostgreSQL
standard; nu copia URL-ul `postgresql+psycopg` al Python. Nu comite credențiale.

```sh
cd server
npm install
npm start                  # migrare + seed + listen pe 3001
npm test                   # Vitest + Supertest, SQLite temporar implicit
NODE_TEST_DATABASE_URL="$NODE_DATABASE_URL" npm test
```

Rolul testelor PostgreSQL trebuie să poată crea/șterge scheme. Fiecare test își
creează o schemă UUID; tabelele aplicației nu sunt șterse. Migrarea și seed-ul
folosesc tranzacții și lock-uri pentru porniri simultane.

Pentru depanare offline, fără porturi sau registry:

```sh
npm run test:offline
```

Același set de aserțiuni folosește runner-ul Node, Express cu cereri în proces și
SQLite. Acesta nu înlocuiește verificarea Vitest/Supertest/PostgreSQL din CI.
În mediul de implementare au putut rula testele offline, lint-ul și exportul web;
Docker, porturile HTTP și descărcarea dependențelor au fost blocate de sandbox.
Versiunile dependențelor directe sunt fixate. Lock-ul noului server nu a putut
fi rezolvat offline pentru Vitest; instalarea curată/CI folosește `npm install`.
Pentru verificarea vizuală nu a fost disponibil un browser conectat în sesiune;
compatibilitatea datelor și build-ul web au fost verificate automat.

## Date și contract

Inventarul pe ecrane și toate endpointurile sunt în
[planul de implementare](../docs/node-api-plan.md). Contractul este
[api/node-openapi.yaml](../api/node-openapi.yaml); JSON-ul este valid YAML 1.2.
Testele verifică generarea și corespondența cu rutele implementate.

Modelul de date este descris în [ADR 002](../docs/decisions/002-demo-fact-model.md).
DB-ul păstrează fapte în bani întregi:
- istoricul bancar și tranzacțiile curente;
- importurile și extrasele, cu starea lor reală;
- rulările analizei și insight-urile;
- bugete, obiective, pușculițe și abonamente cu semnale de utilizare;
- calendarul, memoria utilizatorului și mesajele cu dată.

Totalurile, notele cu cifre, agenda, constatările și progresul se calculează la
citire. `GET /metrics` furnizează procentele. Câmpurile `lei`, `spent`, `left`
etc. sunt convertite din bani numai la serializare.

`seed/scenarios.json` conține faptele și șabloanele de text (`{{cheie}}`), iar
`seed/catalog.json` textele comune. Istoricul de 12 luni se generează determinist
la seed, din tiparele din `ledger`. Fixture-ul `tests/fixtures/frontend-baseline.json`
este prototipul inițial. Testele verifică faptul că faptele reproduc valorile
scenariului. Seed-ul nu suprascrie tacit editările la restart.

Extrasele CSV sunt citite de backend-ul Python (`PYTHON_API_URL`, implicit
`http://api:8000` în Docker). Rulează o dată `make migrate` și `make demo-users`.
Fără Python, fișierul este salvat și apare ca necitit, cu motivul.

Scrierile sunt validate și izolate per persoană. Antetul `Idempotency-Key` previne
dublarea la reîncercare, iar `If-Match` poate verifica revizia din
`X-Data-Revision`. Nu se loghează descrieri de tranzacții sau conținutul mesajelor.

Dezactivarea șterge datele coach-ului în cascadă și păstrează contul demo. Seed-ul
nu le reintroduce la restart. Reactivarea pornește coach-ul fără import și fără
analiză: fluxul Extrase → Analiză → Ce am găsit rulează pe date reale.

Calendarul și urmărirea aplicațiilor sunt fapte demo persistate, fără OAuth sau
Screen Time real. Chat-ul salvează mesaje și aprobări; nu generează răspunsuri AI. Corecturile textuale ale profilului nu modifică
tranzacțiile bancare. Acest API nu are autentificare reală și este expus local.
