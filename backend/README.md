# Backend: import și analiză deterministă

Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL și uv. Nu există apeluri
LLM sau autentificare reală. Toate datele seed sunt fictive.

## Pornire cu Docker

Din rădăcina repository-ului, cu Docker Compose v2 și Python instalate:

```sh
make setup                       # generează .env local, ignorat de Git, cu parolă aleatoare
docker compose up --build -d
make migrate
make test
make seed
```

API: `http://localhost:8000`, documentație: `http://localhost:8000/docs`.
`make seed` afișează UUID-ul fiecărui utilizator; trimite-l ca `X-User-Id`.
Header-ul este numai pentru dezvoltare și trebuie înlocuit înainte de lansare.
Porturile sunt legate numai la localhost.

```sh
curl -H "X-User-Id: $DEV_USER_ID" \
  -F 'file=@backend/seed/output/daily_coffee/transactions.csv' \
  http://localhost:8000/api/v1/accounts/import
curl -H "X-User-Id: $DEV_USER_ID" \
  'http://localhost:8000/api/v1/analytics/summary?period=all'
curl -H "X-User-Id: $DEV_USER_ID" http://localhost:8000/api/v1/insights
```

Upload-ul întoarce `202` și job-ul deja procesat sincron. Un CSV invalid produce
un job `failed`, cu cod și mesaj sigur; tranzacțiile acelui import sunt anulate
integral. `GET /api/v1/imports/{id}` expune statusul. Limita fișierului: 10 MiB.
`account_id` și `currency` sunt câmpuri multipart opționale; contul implicit este
unic per utilizator/provider/monedă. Conturile suplimentare pot fi furnizate de
viitoarea integrare bancară și selectate explicit la import.

## Rulare locală fără container

```sh
uv sync --extra test
export DATABASE_URL='postgresql+psycopg://...'  # din mediul tău; fără credențiale în Git
uv run alembic upgrade head
make local-run
uv run pytest
```

Fără `DATABASE_URL`, se poate folosi SQLite local (`backend/dev.db`) pentru
dezvoltare rapidă; în Compose se folosește exclusiv PostgreSQL.
`uv run pytest` folosește SQLite temporar și migrațiile reale. Pentru verificarea
pe PostgreSQL: `TEST_DATABASE_URL="$DATABASE_URL" uv run pytest` sau `make test`.
Testele creează și șterg numai scheme cu UUID aleator; rolul de test trebuie să
poată crea scheme. Nu șterg tabelele aplicației.

`make openapi` exportă contractul în `api/openapi.yaml` și îl copiază din container
în checkout. Local: `PYTHONPATH=backend uv run python backend/scripts/export_openapi.py`.
Un test compară exact schema FastAPI cu YAML-ul versionat. FastAPI și Pydantic
sunt fixate la versiuni exacte pentru stabilitatea exportului.
`make lint` verifică codul backend. După schimbări de cod, reconstruiește imaginea
cu `docker compose up --build -d` înainte de comenzile din container.

## Structură și limite

- `app/api/`: adaptoare HTTP, scheme Pydantic, identitatea de dezvoltare.
- `app/models/`, `migrations/`: UUID, sume `BIGINT` în bani, date UTC, constrângeri.
- `app/services/csv_parser.py`: singurul parser care cunoaște formatul CSV presupus.
- `app/services/import_service.py`: job durabil, deduplicare per cont, import atomic.
- `app/analytics/preprocessing/`: comercianți, aliasuri, rapidfuzz, categorii JSON,
  ora POS și estimarea salariului. `CategoryFallback` are implementarea neutră
  `UncategorizedFallback`; categoria este memorată pe comerciant. Aliasurile din
  DB folosesc forma normalizată și au prioritate față de regulile JSON.
- `app/analytics/detectors/`: detectorii puri `RecurringDetector`,
  `PaydayCycleDetector`, `TimeOfDayDetector`, `UnusedSubscriptionDetector`.
- `app/analytics/config.py`, `validation.py`, `ranker.py`, `pipeline.py`: praguri
  centralizate, eliminarea zgomotului, scorul și persistarea rezultatelor.
- `app/services/analytics_service.py`: funcții Python pentru viitoarele tool-uri AI:
  `get_spending_summary`, `get_cashflow_pattern`, `find_recurring_expenses`,
  `list_subscriptions`, `list_insights`. Primesc o sesiune și un `user_id`, cu
  parametri expliciți; nu fac commit și nu recalculează detectorii la citire.
- `scripts/load_seed.py`: încarcă fixture-urile existente, fără să le genereze.
  Orizontul implicit este explicit `2026-10-31`; suprascriere prin `--as-of`.

`AnalyticsPipeline(session).run_full(user_id, as_of=...)` rulează după fiecare
import reușit. `run_incremental(transaction_id)` folosește aceeași analiză completă
în MVP. Funcțiile de modul cu aceleași nume pot gestiona și propria sesiune.
Recategorizarea și modificările semnalelor/abonamentelor recalculează rezultatele.
Identitatea insight-ului rămâne stabilă, inclusiv după reimport și feedback.
Tiparele care nu mai sunt susținute sunt inactive și nu mai apar în feed.
Istoricul insuficient este comunicat prin `summary.history`.

Sumele de cheltuială și costul abonamentului sunt negative; impactul lunar este
pozitiv. Nicio sumă nu este convertită la float; doar proporțiile și statisticile
folosesc numere reale. Analizele sunt separate pe monedă, fără curs de schimb.
`summary` acceptă `current_month`, `last_month`, `last_3_months`, `last_6_months`,
`all`. Intervalele `from`/`to` pentru tranzacții sunt date locale inclusive.
Cashflow-ul folosește soldul contabil, data înregistrării și ordinea rândurilor;
detectorii orari folosesc ora reală în `Europe/Bucharest` și ignoră precizia `day`.
O corectură manuală de categorie este păstrată cu `category_corrected=true`, pentru
viitoare date de antrenare; nu schimbă implicit toate plățile comerciantului.

Pentru neutilizare trebuie configurate explicit `usage_source` și
`usage_connected_at` prin `PATCH /subscriptions/{id}`. Sunt necesare cel puțin
30 zile monitorizate. `POST /usage-signals` nu conectează implicit o sursă;
retransmiterea aceluiași semnal este idempotentă. Conectarea geofence/Health nu
este implementată aici. Scriptul seed traduce explicit contextul fixture-urilor
în aceste câmpuri și încarcă JSON-ul de semnale.

## Adăugarea unui detector

1. Implementează `Detector` din `detectors/base.py`: `name`, `min_history_days`,
   `detect(txs: DataFrame, profile: UserProfile) -> list[Pattern]`. Nu accesa DB,
   rețeaua sau ceasul global; folosește `profile.as_of`.
2. Adaugă pragurile în `config.py`, dovezile de suport/săptămâni/istoric și
   semnificație în `Pattern.evidence`. Banii rămân întregi.
3. Înregistrează detectorul în `detectors.DETECTORS`; constructorul primește
   `AnalyticsConfig`. Ajustează opțional maparea `INSIGHT_TYPES` pentru feed.
   Pipeline-ul citește registrul automat. `UnusedSubscriptionDetector`
   se rulează după sincronizarea abonamentelor în DB.
4. Adaugă teste pozitive, negative și verificarea că input-ul nu este modificat.
   Completează așteptările persona împreună cu owner-ul generatorului, fără să
   modifici manual CSV-urile. Exportă OpenAPI dacă schimbi contractul.

## Stadiul verificărilor

Testele includ import/reimport, rollback după eroare, migrare înainte/înapoi,
izolarea utilizatorilor, categorii, fus orar/DST, detectorii și contractul API.
Persona `balanced` trebuie să aibă zero insight-uri. Toate așteptările din scope
sunt evaluate în pipeline. `birthday_month/upcoming_spike` are un test separat
`xfail(strict=True)`: necesită calendarul, exclus explicit din acest task.

În mediul de implementare s-au folosit biblioteci locale existente pentru teste
Python 3.12/SQLite: accesul la rețea este blocat și Docker/uv nu sunt instalate.
Rapidfuzz are o cale offline lentă cu aceeași similaritate Indel; instalarea
normală prin uv folosește rapidfuzz. Validarea imaginii Docker, instalarea curată
uv și testele PostgreSQL trebuie executate de echipă/CI.

Formatul real Raiffeisen, baseline-ul orar și pragurile finale trebuie confirmate.
Presupunerile și limitele sunt în [ADR 001](../docs/decisions/001-backend-analytics.md).
Calendarul, prognoza, detectorii opționali din pasul 8, ML, agentul, auth real,
bugetele și notificările rămân în afara acestei implementări.
