# CLAUDE.md — Asistent financiar personal bazat pe AI

> Acest fișier este **sursa comună de adevăr** pentru echipă și pentru agenții AI care ne ajută să scriem cod.
> Orice membru al echipei (sau agentul lui) trebuie să-l citească înainte de a lucra pe proiect.
> Când o decizie se schimbă, actualizăm **întâi** acest fișier, apoi codul.

Legendă: ✅ = decis · 🟡 = propunere implicită, de confirmat de echipă · ❓ = decizie deschisă

---

## 1. Viziune

Un asistent AI care analizează comportamentul financiar al utilizatorului din ultimele luni, identifică tiparele de cheltuieli și problemele recurente și îl ajută să-și stabilească obiective realiste. Asistentul nu se limitează la raportarea cifrelor: poartă o conversație cu utilizatorul, îi înțelege contextul și propune soluții concrete, adaptate obiceiurilor sale.

### Funcționalități principale

**1. Detectarea tiparelor financiare.** Asistentul analizează istoricul tranzacțiilor și identifică automat problemele recurente.
> *Exemplu:* observă că utilizatorul rămâne constant fără bani în ultima săptămână dinaintea salariului și îi recomandă să pună deoparte o sumă fixă imediat după încasarea salariului, pentru a fi mai atent la cheltuieli pe parcursul lunii.

**2. Analiza conversațională a cheltuielilor.** Utilizatorul își descrie problema în cuvinte proprii, iar asistentul caută explicația în date.
> *Exemplu:* „De obicei cheltui banii foarte repede și nu-mi dau seama unde se duc.” → asistentul identifică o cheltuială zilnică de ~30 lei, efectuată dimineața, și îl întreabă pe utilizator despre ea și despre necesitatea ei.

**3. Limite personalizate și alerte în timp real.** Pe baza discuției, utilizatorul își stabilește limite pe categorii, iar asistentul monitorizează respectarea lor.
> *Exemplu:* „Vreau cafea de maximum 3 ori pe săptămână.” La a treia cafea din săptămână primește: „Aceasta a fost ultima cafea din bugetul săptămânii. Pentru zilele rămase, îți recomandăm să o pregătești acasă.”

**4. Optimizarea abonamentelor.** Asistentul identifică abonamentele active și le compară cu utilizarea lor efectivă.
> *Exemplu:* „Plătești lunar X lei pentru abonamentul la sală, dar nu ai mai fost deloc. Ai vrea să-l anulezi și să plătești intrări individuale o perioadă?”

**5. Planificarea cheltuielilor viitoare (integrare cu calendarul).** Asistentul anticipează perioadele cu cheltuieli crescute.
> *Exemplu:* „Luna viitoare ai 10 zile de naștere în calendar. Îți recomandăm să începi să pui bani deoparte încă de luna aceasta.”

**6. Planificarea obiectivelor financiare.** Utilizatorul își comunică obiectivele, iar asistentul construiește un plan concret.
> *Exemplu:* „Vreau să fac o achiziție de 2.000 lei. Sunt dispus(ă) să renunț la abonamentul la sală din luna aceasta.” → asistentul simulează bugetul, propune luna optimă pentru achiziție și suma de economisit lunar.

### Valoare
- **Conștientizare** — utilizatorul înțelege unde se duc banii fără să analizeze extrase.
- **Personalizare** — recomandări bazate pe obiceiurile reale, nu pe reguli generice.
- **Prevenție** — problemele sunt anticipate, nu constatate.
- **Implicare** — utilizatorul participă activ la stabilirea limitelor și obiectivelor.

### Idei pentru etape ulterioare (în afara MVP)
Integrări cu ANAF, ONRC, portal.just.ro; conectare live la mai multe bănci.

---

## 2. Echipa și responsabilități

| Rol | Deține (owner) | Livrabile principale |
|---|---|---|
| **Frontend** | UI-ul aplicației (web/mobile ❓) | Ecrane: onboarding, dashboard, chat, reguli, ținte, abonamente, notificări. Consumă API-ul pe baza `openapi.yaml`. |
| **Backend** | API, baza de date, ingestia de date, motorul de analiză, rule engine-ul | Endpointuri REST, scheme DB, import tranzacții, detectare tipare/abonamente, evaluare reguli, notificări. |
| **DevOps / AI** | Agentul conversațional + infrastructura AWS | Prompt-uri, tool-uri ale agentului, memoria utilizatorului, evaluări (evals), CI/CD, medii (dev/prod), monitorizare, secrete. |
| **Business** | Produsul, conținutul și conformitatea | Persona, scenarii de utilizare, criterii de acceptanță, tonul asistentului, textele notificărilor, aspecte legale (GDPR, PSD2, disclaimer „nu este consultanță financiară”), validare cu utilizatori. |

**Graniță importantă Backend ↔ AI:** Backend-ul expune *funcții de analiză deterministe* (servicii interne). Echipa AI le împachetează ca *tool-uri* pentru agent. Backend-ul nu scrie prompt-uri; AI nu scrie SQL direct în tool-uri — folosește serviciile backend.

---

## 3. Cum colaborăm

### 3.1 Principii
1. **Contract-first.** Fișierul `api/openapi.yaml` este contractul dintre frontend și backend. Orice endpoint nou sau modificat se adaugă **întâi** în `openapi.yaml`, prin PR, aprobat de Frontend + Backend. Abia apoi se implementează.
2. **Nimeni nu se blochează.** Frontend-ul lucrează pe un mock server generat din `openapi.yaml` (ex. Prism) până când endpointul real e gata. Backend-ul și AI lucrează pe **date seed** (persona fictive, vezi §9) până există date reale.
3. **Deciziile se scriu.** Deciziile de arhitectură se notează scurt în `docs/decisions/NNN-titlu.md` (context, decizie, consecințe). Deciziile majore se reflectă și aici.
4. **Business definește „gata”.** Fiecare funcționalitate are criterii de acceptanță scrise de Business în issue (format: *Dat fiind… Când… Atunci…*).

### 3.2 Flux de lucru Git 🟡
- `main` este mereu deployabil. Lucrul se face pe branch-uri: `feat/<zona>-<descriere>`, `fix/...`, `chore/...` (zona: `fe`, `be`, `ai`, `infra`, `docs`).
- Commit-uri în format Conventional Commits: `feat(be): add rules endpoint`.
- Orice PR are cel puțin un reviewer. PR-urile care ating `openapi.yaml` sau schema DB → review obligatoriu de la rolul afectat.
- CI rulează lint + teste + validare `openapi.yaml` la fiecare PR.

### 3.3 Ritm 🟡
- Sincronizare scurtă de 2–3 ori pe săptămână: ce am făcut, ce urmează, ce mă blochează.
- Board de task-uri (GitHub Projects) cu coloane: Backlog → To do → In progress → Review → Done. Fiecare task are owner și etichetă de rol.

### 3.4 Dependențe între roluri (ordinea recomandată)
```
Business: persona + scenarii + criterii ──┐
                                          ▼
Backend: schema DB + openapi.yaml ──► Frontend: UI pe mock server
        │                                       │
        ▼                                       │
Backend: import + analiză (pe date seed)        │
        │                                       │
        ▼                                       ▼
AI: tool-uri + agent (pe date seed) ──► Integrare chat end-to-end
        │
DevOps: medii AWS + CI/CD (în paralel, de la început)
```

---

## 4. Arhitectura

### 4.1 Principiul de bază ✅
**LLM-ul nu face calcule și nu inventează cifre.** Toate sumele, frecvențele, tiparele și prognozele sunt calculate de cod determinist (motorul de analiză). Agentul primește rezultatele prin tool-uri și se ocupă de: interpretare, întrebări, negociere cu utilizatorul, formularea recomandărilor și salvarea deciziilor.

### 4.2 Componente
```
                       ┌──────────────────────────────┐
  Client (FE) ──REST──►│          API Gateway         │
                       └───────┬──────────────┬───────┘
                               │              │
                 ┌─────────────▼───┐   ┌──────▼────────────────┐
                 │  Core API (BE)  │   │  Agent Service (AI)   │
                 │  CRUD, auth,    │◄──│  LLM + tool-uri       │
                 │  import         │   │  memorie utilizator   │
                 └───┬─────────┬───┘   └──────────┬────────────┘
                     │         │                  │ apelează
                     │   ┌─────▼──────────────────▼──┐
                     │   │  Analytics Engine (BE)    │
                     │   │  tipare, abonamente,      │
                     │   │  cash flow, prognoze      │
                     │   └─────────────┬─────────────┘
                     ▼                 ▼
               ┌──────────────────────────────┐
               │        PostgreSQL            │
               └──────────────────────────────┘
                     ▲                 │
   tranzacție nouă   │                 │ eveniment
               ┌─────┴───────┐   ┌─────▼────────────┐
               │  Ingestion  │──►│  Rule Engine     │──► Notification Service ──► push / in-app
               │  (CSV/bank) │   │  (fără LLM)      │
               └─────────────┘   └──────────────────┘
                                         ▲
               ┌─────────────────────┐   │
               │ Scheduler (zilnic / │───┘ + declanșează Insight Job
               │ săptămânal / lunar) │──► Agent Service generează insight-uri proactive
               └─────────────────────┘
```

| Componentă | Owner | Rol |
|---|---|---|
| Core API | Backend | Auth, CRUD (reguli, ținte, abonamente), import tranzacții, conversații. |
| Ingestion | Backend | Import CSV (MVP) / agregator Open Banking (ulterior). Normalizare, categorizare, deduplicare. |
| Analytics Engine | Backend | Funcții pure: detectare tipare, abonamente, cash flow, prognoză, simulare obiective. Plan detaliat: `docs/pattern-recognition.md`. |
| Rule Engine | Backend | Evaluează fiecare tranzacție nouă față de regulile utilizatorului. Fără LLM. |
| Agent Service | AI | Conversația cu utilizatorul, apeluri de tool-uri, memorie, generare insight-uri. |
| Scheduler + Insight Job | AI + DevOps | Rulează periodic analiza și cere agentului să formuleze insight-uri proactive. |
| Notification Service | Backend | Trimite notificări (push / in-app), respectă limite de frecvență. |

### 4.3 Cele trei moduri de funcționare
1. **Reactiv (chat):** utilizatorul scrie → Agent Service → tool-uri → răspuns (streaming).
2. **Pe evenimente (fără LLM):** tranzacție nouă → Rule Engine → notificare („ultima cafea din săptămână”). Rapid, ieftin, predictibil.
3. **Proactiv (programat):** Scheduler → Analytics → Agent formulează insight-uri → apar în feed / ca notificare („luna viitoare ai 10 zile de naștere”).

### 4.4 Stack tehnic 🟡
Pentru demo-ul frontend Daria/Matei, cererea de integrare din 28.10.2026 introduce
un API separat Node.js + Express în `server/`, cu PostgreSQL în baza `nexxt_demo`.
Prefixul este `/api/demo/v1`, iar contractul este `api/node-openapi.yaml`.
Serviciul servește datele și salvează acțiunile demo; nu înlocuiește backend-ul
Python, motorul de analiză sau fluxul pentru persoane juridice/credit verde.
Planul și presupunerile sunt în `docs/node-api-plan.md`.

| Zonă | Propunere |
|---|---|
| Backend + Agent | Python 3.12, FastAPI, SQLAlchemy + Alembic, Pydantic |
| Bază de date | PostgreSQL (AWS RDS) |
| LLM | Claude (Anthropic API sau AWS Bedrock), cu tool use. Modelul se configurează prin `LLM_MODEL` |
| Cozi / evenimente | AWS SQS + EventBridge (scheduler) |
| Hosting | AWS ECS Fargate (API + Agent) sau Lambda pentru job-uri |
| Notificări | AWS SNS / Firebase Cloud Messaging / APNs |
| Secrete | AWS Secrets Manager |
| Frontend | ❓ Web (Next.js) sau mobile (React Native / Expo) |
| CI/CD | GitHub Actions |

---

## 5. Fluxul de date

### 5.1 Ingestie
```
CSV Raiffeisen / API bancă
   → parsare → normalizare (Transaction)
   → deduplicare (după external_id sau hash dată+sumă+descriere)
   → categorizare (reguli pe merchant + fallback LLM, cache pe merchant)
   → salvare în DB
   → eveniment `transaction.created` în coadă
        → Rule Engine (verifică reguli → eventual notificare)
        → Analytics (recalculare incrementală abonamente/tipare)
```

### 5.2 Chat
```
FE: POST /conversations/{id}/messages
  → Agent Service încarcă: profilul + memoria utilizatorului, reguli active, ținte, ultimele N mesaje
  → LLM decide ce tool-uri apelează (ex. find_recurring_expenses)
  → tool-ul apelează Analytics Engine → returnează date structurate
  → LLM formulează răspunsul; dacă utilizatorul a luat o decizie → tool `save_memory` / `create_budget_rule`
  → răspuns trimis în streaming (SSE) către FE
```

### 5.3 Exemplu complet: „cafeaua de dimineață”
1. Utilizator: „Cheltui banii foarte repede și nu știu unde se duc.”
2. Agent → `get_spending_summary(period=last_3_months)` + `find_recurring_expenses()`.
3. Analytics returnează: `{merchant: "Cafenea X", avg_amount: 3000, frequency: "22/30 zile", time_window: "08:00–09:30", monthly_total: 66000}` (sume în bani).
4. Agent: „Am observat că aproape în fiecare dimineață cheltui ~30 lei la Cafenea X, adică ~660 lei/lună. Ți se pare o cheltuială necesară?”
5. Utilizator: „Aș vrea maxim 3 pe săptămână.”
6. Agent → `create_budget_rule({type: "count_limit", merchant_or_category: "coffee", limit: 3, period: "week"})` după confirmare explicită.
7. La a 3-a tranzacție din săptămână, Rule Engine trimite notificarea.

### 5.4 Utilizarea abonamentelor (sală)
⚠️ **Limitare tehnică:** Apple **nu permite** aplicațiilor terțe să citească sau să trimită pe server datele Screen Time. Surse alternative de „utilizare”:
- **Geofence** pe locația sălii (aplicația mobilă trimite vizitele) 🟡
- **Apple Health / Google Fit** — antrenamente înregistrate
- **Confirmare directă** de la utilizator în chat („Ai fost la sală luna asta?”)

Toate ajung în backend prin `POST /usage-signals` și sunt comparate cu costul abonamentului.

### 5.5 Calendar
Integrare Google Calendar / iCloud (OAuth). Backend-ul sincronizează evenimentele relevante (zile de naștere, sărbători, călătorii) și le transformă în `UpcomingExpense` cu sumă estimată (din istoric sau setată de utilizator).

---

## 6. Modele de date (nucleu)

> Convenții ✅: **sumele sunt întregi în bani** (1 leu = 100 bani), câmp `amount_minor` + `currency` (implicit `RON`). Sume negative = cheltuieli. Datele sunt stocate în UTC, afișate în `Europe/Bucharest`. ID-uri UUID.

| Entitate | Câmpuri principale |
|---|---|
| `User` | id, email, name, locale, salary_day (opțional), created_at |
| `Account` | id, user_id, provider (`csv` / `raiffeisen` / …), iban_masked, currency |
| `Transaction` | id, account_id, external_id, booked_at, amount_minor, currency, description_raw, merchant_id, category, is_recurring |
| `Merchant` | id, name_normalized, category_default |
| `Subscription` | id, user_id, merchant_id, amount_minor, period (`monthly`/`yearly`), next_charge_at, status (`active`/`cancel_planned`/`cancelled`), usage_source |
| `UsageSignal` | id, user_id, subscription_id, source (`geofence`/`health`/`manual`), occurred_at |
| `BudgetRule` | id, user_id, type (`count_limit` / `amount_limit`), target (category sau merchant), limit, period (`week`/`month`), notify_at (ex. „la ultima”), active |
| `RuleCounter` | rule_id, period_start, current_count, current_amount_minor |
| `Goal` | id, user_id, name, target_amount_minor, target_date (opțional), saved_amount_minor, status, linked_actions (ex. „anulez sala”) |
| `CalendarEvent` | id, user_id, source, title, starts_at, type (`birthday`/`holiday`/`other`) |
| `UpcomingExpense` | id, user_id, calendar_event_id, estimated_amount_minor, due_at |
| `Insight` | id, user_id, type (`end_of_month_shortage` / `recurring_expense` / `unused_subscription` / `upcoming_spike` / `goal_progress`), payload (JSON), status (`new`/`seen`/`accepted`/`dismissed`), created_at |
| `Conversation` / `Message` | id, user_id / conversation_id, role, content, tool_calls (JSON), created_at |
| `UserMemory` | id, user_id, kind (`problem`/`preference`/`decision`/`context`), content, source_message_id, created_at |
| `Notification` | id, user_id, channel, title, body, related_entity, sent_at, read_at |

**Memoria utilizatorului este structurată**, nu doar istoric de chat. Ex: „sunt dispusă să anulez sala” → `UserMemory{kind: "decision", content: "Dispus(ă) să anuleze abonamentul la sală pentru obiectivul de 2000 lei"}`.

---

## 7. API — endpointuri necesare (v1)

> Prefix: `/api/v1`. Auth: Bearer JWT 🟡. Format: JSON. Erori: `{ "error": { "code": "...", "message": "..." } }`.
> Specificația completă și autoritară se află în `api/openapi.yaml`.

### Auth & utilizator
| Metodă | Rută | Descriere |
|---|---|---|
| POST | `/auth/register` | Creare cont |
| POST | `/auth/login` | Login → JWT |
| GET / PATCH | `/me` | Profil (inclusiv `salary_day`, preferințe notificări) |
| DELETE | `/me` | Ștergere cont și date (GDPR) |

### Conturi & tranzacții
| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/accounts` | Lista conturilor |
| POST | `/accounts/import` | Upload CSV (multipart) → job de import |
| GET | `/imports/{id}` | Status import |
| GET | `/transactions?from=&to=&category=&merchant=` | Listare paginată |
| PATCH | `/transactions/{id}` | Re-categorizare manuală |

### Analiză (pentru dashboard)
| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/analytics/summary?period=` | Total pe categorii, venit vs. cheltuieli |
| GET | `/analytics/cashflow?months=` | Evoluția soldului, zile critice din lună |
| GET | `/analytics/recurring` | Cheltuieli recurente detectate |

### Insight-uri
| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/insights?status=` | Feed de insight-uri proactive |
| PATCH | `/insights/{id}` | Marcare `seen` / `accepted` / `dismissed` |

### Chat cu agentul
| Metodă | Rută | Descriere |
|---|---|---|
| POST | `/conversations` | Conversație nouă (opțional pornită dintr-un insight: `insight_id`) |
| GET | `/conversations` | Lista conversațiilor |
| GET | `/conversations/{id}/messages` | Istoric |
| POST | `/conversations/{id}/messages` | Trimite mesaj → răspuns **SSE streaming** (evenimente: `token`, `tool_call`, `action`, `done`) |

Evenimentul `action` anunță FE că agentul a creat/modificat ceva (regulă, țintă), ca UI-ul să se reîmprospăteze sau să afișeze un card de confirmare.

### Reguli de buget
| Metodă | Rută | Descriere |
|---|---|---|
| GET / POST | `/rules` | Listare / creare |
| PATCH / DELETE | `/rules/{id}` | Modificare / ștergere |
| GET | `/rules/{id}/status` | Progres în perioada curentă (ex. 2/3 cafele) |

### Obiective
| Metodă | Rută | Descriere |
|---|---|---|
| GET / POST | `/goals` | Listare / creare |
| PATCH / DELETE | `/goals/{id}` | Modificare / ștergere |
| GET | `/goals/{id}/plan` | Plan calculat: luna recomandată, economie lunară, scenarii |

### Abonamente
| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/subscriptions` | Abonamente detectate + utilizare |
| PATCH | `/subscriptions/{id}` | Confirmare / marcare `cancel_planned` / ignorare |
| POST | `/usage-signals` | Semnale de utilizare de la mobil (geofence / Health / manual) |

### Calendar & cheltuieli viitoare
| Metodă | Rută | Descriere |
|---|---|---|
| POST | `/integrations/calendar/connect` | Pornire OAuth (Google / iCloud) |
| DELETE | `/integrations/calendar` | Deconectare |
| GET | `/upcoming-expenses?months=` | Cheltuieli anticipate |
| PATCH | `/upcoming-expenses/{id}` | Ajustare sumă estimată |

### Notificări
| Metodă | Rută | Descriere |
|---|---|---|
| POST | `/devices` | Înregistrare token push |
| GET | `/notifications` | Listă in-app |
| PATCH | `/notifications/{id}` | Marcare citită |

---

## 8. Agentul AI (owner: DevOps/AI)

### 8.1 Design
- **Un singur agent cu tool-uri** ✅ (nu multi-agent în MVP).
- Context la fiecare conversație: profil, `UserMemory`, reguli active, ținte, ultimele N mesaje, data curentă.
- Agentul **propune** și **cere confirmare explicită** înainte de orice acțiune care modifică date (creare regulă, țintă, marcare abonament). Nu anulează niciodată singur un abonament real.
- Răspunde în **limba română** (implicit), ton: prietenos, fără judecăți, concret, scurt. ❓ Tonul final îl definește Business.
- Disclaimer: oferă recomandări de buget personal, **nu** consultanță de investiții.

### 8.2 Tool-uri (mapate pe servicii backend)
| Tool | Ce returnează / face | Serviciu backend |
|---|---|---|
| `get_spending_summary(period)` | Totaluri pe categorii, venit vs. cheltuieli | Analytics |
| `get_cashflow_pattern(months)` | Sold pe zile, zile critice, ziua salariului | Analytics |
| `find_recurring_expenses(min_frequency)` | Cheltuieli repetitive (merchant, sumă, frecvență, interval orar) | Analytics |
| `list_subscriptions()` | Abonamente + cost + utilizare | Analytics |
| `get_upcoming_expenses(months)` | Evenimente din calendar + sume estimate | Analytics |
| `simulate_goal(amount, constraints)` | Luna optimă, economie lunară, impactul renunțărilor | Analytics |
| `create_budget_rule(...)` | Creează regulă (după confirmare) | Core API |
| `create_goal(...)` / `update_goal(...)` | Gestionare ținte | Core API |
| `update_subscription_status(id, status)` | Ex. `cancel_planned` | Core API |
| `save_memory(kind, content)` | Salvează problemă / preferință / decizie / context | Core API |

Tool-urile returnează **JSON structurat cu sume în bani**; agentul le formatează în lei la afișare.

### 8.3 Insight-uri proactive (Insight Job)
| Insight | Declanșator | Frecvență |
|---|---|---|
| `end_of_month_shortage` | Sold < prag în ultimele zile înainte de salariu, ≥ 2 luni din 3 | Lunar |
| `recurring_expense` | Merchant cu ≥ 3 tranzacții/săptămână | Săptămânal |
| `unused_subscription` | Abonament activ fără semnale de utilizare în ultimele 30 de zile | Lunar |
| `upcoming_spike` | Cheltuieli anticipate luna viitoare > X% peste medie | Lunar (în jur de ziua 20) |
| `goal_progress` | Abatere de la planul unei ținte | Săptămânal |

Limită de frecvență pentru notificări proactive 🟡: maximum 1 insight push pe zi, restul doar în feed.

### 8.4 Evaluare
Set de scenarii de test (în `agent/evals/`) pe persona seed: pentru fiecare, mesajul utilizatorului + comportamentul așteptat (ce tool-uri apelează, ce NU trebuie să spună). Rulat în CI la orice schimbare de prompt.

---

## 9. Date de test (seed)
Generator în `backend/seed/` care creează 6 luni de tranzacții pentru persona-urile:
1. **„Finalul de lună”** — salariu pe 10, cheltuieli mari în prima jumătate, sold aproape de 0 înainte de salariu.
2. **„Cafeaua zilnică”** — ~30 lei la cafenea în 20+ dimineți/lună.
3. **„Sala nefolosită”** — abonament lunar la sală, zero semnale de utilizare.
4. **„Luna aniversărilor”** — 10 zile de naștere în calendar luna viitoare.
5. **„Obiectivul de 2000 lei”** — venit stabil, vrea o achiziție, dispus(ă) să renunțe la sală.

Business validează că persona-urile sunt realiste.

---

## 10. Structura repository-ului 🟡
```
/
├── CLAUDE.md               ← acest fișier
├── api/openapi.yaml        ← contractul FE ↔ BE
├── docs/decisions/         ← decizii de arhitectură (ADR)
├── backend/                ← Core API, Ingestion, Analytics, Rule Engine, Notifications
│   ├── app/
│   ├── tests/
│   └── seed/
├── agent/                  ← Agent Service: prompt-uri, tool-uri, memorie, evals
│   ├── prompts/
│   ├── tools/
│   └── evals/
├── frontend/               ← aplicația client
└── infra/                  ← IaC (Terraform / CDK), CI/CD
```

---

## 11. Reguli pentru agenții AI care scriu cod în acest proiect
1. Citește acest fișier și `api/openapi.yaml` înainte de a modifica cod.
2. **Nu modifica contractul API** fără să actualizezi `openapi.yaml` în același PR și fără să semnalezi asta explicit.
3. Respectă granițele de ownership din §2. Dacă un task cere modificări în zona altui rol, semnalează-le în descrierea PR-ului.
4. **Sume = întregi în bani**, niciodată float. Fus orar de afișare `Europe/Bucharest`.
5. LLM-ul nu calculează sume: orice cifră prezentată utilizatorului provine dintr-un tool/serviciu determinist.
6. Textele pentru utilizator sunt în română; codul, numele de variabile, commit-urile și comentariile în engleză.
7. **Date sensibile:** nu loga IBAN-uri complete, descrieri brute de tranzacții sau conținutul conversațiilor în producție. Nu folosi date reale în teste, doar seed.
8. Secretele (chei API, credențiale DB) vin exclusiv din variabile de mediu / Secrets Manager — niciodată în cod.
9. Orice funcție de analiză nouă vine cu teste pe datele seed.
10. Dacă o decizie marcată ❓ sau 🟡 îți afectează task-ul, nu o rezolva tacit — întreabă sau notează presupunerea în PR.

---

## 12. Scope MVP și decizii deschise

**MVP propus 🟡:** import CSV + date seed · detectare tipare și abonamente · chat cu agentul · reguli de buget cu notificări · obiective cu plan · insight-uri proactive de bază. Calendarul și semnalele de utilizare (geofence/Health) pot intra în a doua iterație.

**Decizii deschise ❓**
- Platforma frontend: web, mobile sau ambele?
- Sursa de date bancare după MVP: agregator Open Banking (Salt Edge / Tink) sau API Raiffeisen direct (necesită licență AISP)?
- Anthropic API direct sau AWS Bedrock?
- Auth propriu (JWT) sau serviciu gestionat (Cognito / Auth0)?
- Tonul exact al asistentului și politica de notificări (Business).
- Public țintă: uz intern / pilot restrâns sau lansare publică (impact pe GDPR, costuri, scalare).
