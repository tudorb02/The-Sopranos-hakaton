# 001 — Backend deterministic analytics MVP

## Context și decizie

Implementăm pașii 3–7 din `docs/pattern-recognition.md`, cu Python 3.12,
uv, pandas și PostgreSQL. SQLite este folosit numai pentru teste rapide;
aceleași migrații și teste se pot rula pe PostgreSQL prin `TEST_DATABASE_URL`.
Header-ul obligatoriu `X-User-Id` identifică un utilizator de dezvoltare existent.
Nu este autentificare; utilizatorii sunt creați prin scriptul seed.

Contractul este exportat din FastAPI și verificat automat, conform cererii
acestui task. Review-ul FE/BE al contractului și al schemei DB rămâne necesar
la integrare; nu blocăm implementarea pe un PR intermediar.

## Presupuneri de confirmat

- CSV-ul este contractul fictiv furnizat, nu un format Raiffeisen verificat.
  O singură clasă de parser deține coloanele, separatorul și conversia banilor.
  Se acceptă BOM UTF-8 și mii separate prin punct; exact două zecimale.
  Ora POS este locală în București. Orele inexistente la schimbarea DST sunt
  respinse; orele ambigue folosesc prima apariție (`fold=0`).
- Moneda CSV implicită este RON, transmisă explicit pentru alte extrase.
  Nu există conversie valutară: analizele și tiparele sunt separate pe monedă.
- Soldul este contabil după fiecare rând; ordinea intraday a extrasului este
  păstrată. Istoricul cashflow este contabil; analizele orei folosesc data plății.
- Pragurile implicite și excepțiile §8.1 se centralizează în `analytics/config.py`.
  Baseline orar: ore active 07–24, proporțional cu durata ferestrei; corecție
  Bonferroni pentru ferestrele testate. Niciun baseline de populație.
- Abonamentele comerciale exclud chiria/facturile. Fără sursă explicit conectată
  și monitorizată cel puțin 30 zile, lipsa semnalelor nu înseamnă neutilizare.
  Scriptul seed traduce contextul fixture-urilor în această configurare explicită.
- Maximum 5 insight-uri noi într-o săptămână calendaristică București; identitatea
  tiparului este stabilă per utilizator/tip/comerciant/fereastră/monedă, astfel
  reimportul nu resetează `seen`, `accepted` sau `dismissed`.
- Recalcularea incrementală folosește același pipeline complet în MVP: corect,
  idempotent și simplu; optimizarea pe partiții rămâne pentru volum real.
- `Pattern.type` urmează documentul tehnic; tipurile Insight folosesc mapările
  din CLAUDE.md (ex. `end_of_cycle_shortage` → `end_of_month_shortage`).

## Limite și abateri explicite

Calendarul este exclus explicit din task. Așteptarea `upcoming_spike` din
`birthday_month/expected_patterns.json` este testată ca `xfail(strict=True)`
separat, cu motiv explicit; toate așteptările din scope rulează normal.
Nu modificăm generatorul sau fixture-urile pentru a ascunde această dependență.
CategoryAnomalyDetector, ChangePointDetector și prognoza sunt pasul 8, opțional,
și rămân pentru următoarea iterație. Nu implementăm ML, LLM, Rule Engine sau push.

Echipa trebuie să verifice un export Raiffeisen anonimizat: header, encoding,
debit/credit, sold/ordine, ora POS, timezone, MCC, transferuri și referințe.
Business trebuie să valideze pragurile și relevanța înainte de utilizare reală.
