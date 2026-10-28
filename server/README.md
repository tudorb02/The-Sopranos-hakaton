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

`DEMO_TODAY=2026-11-12` este data implicită. Se poate suprascrie în `.env`, apoi
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

`GET /personas/pf` și `/personas/student` păstrează exact obiectele inițiale ale
frontend-ului. Datele per ecran sunt disponibile și separat. `GET /metrics`
(sub persoană) furnizează progresul și procentele fără a modifica formele vechi.
Sumele din DB și calcule sunt întregi în bani; câmpurile vechi `lei`, `spent`,
`left` etc. sunt convertite în lei numai la serializare, pentru compatibilitate.

Tabelele păstrează tranzacții, obligații fixe, limite, solduri inițiale, abonamente,
depuneri și proiecții, istoric pentru medii, profil/context, mesaje, răspunsuri,
documente, preferințe și decizii. Totalurile, sumele rămase, contoarele,
mediile, prognoza din idee și progresul se calculează la citire.

`seed/scenarios.json` conține faptele operaționale. `seed/catalog.json` conține
textele și categoriile comune. Fixture-ul `tests/fixtures/frontend-baseline.json`
este copia înghețată a interfeței inițiale și este folosit pentru compatibilitate,
nu pentru răspunsurile API. `npm run seed:build` reconstruiește seed-ul din acest
fixture numai când se schimbă intenționat scenariul, cu review al rezultatelor.
Pentru o versiune nouă de seed trebuie planificată o migrare; seed-ul existent nu
suprascrie tacit editările utilizatorilor la restart.

Scrierile sunt validate și izolate per persoană. Antetul `Idempotency-Key` previne
dublarea la reîncercare, iar `If-Match` poate verifica revizia din
`X-Data-Revision`. Nu se loghează descrieri de tranzacții sau conținutul mesajelor.

Dezactivarea șterge datele coach-ului în cascadă și păstrează contul demo. Seed-ul
nu le reintroduce la restart. Reactivarea explicită reîncarcă scenariul fictiv.

Calendarul, urmărirea aplicațiilor, importurile și serviciile bancare sunt demo-uri
persistate, fără OAuth sau operațiuni reale. Chat-ul salvează mesaje și aprobări;
nu generează răspunsuri AI. Corecturile textuale ale profilului nu modifică
tranzacțiile bancare. Acest API nu are autentificare reală și este expus local.
