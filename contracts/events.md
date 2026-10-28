# Evenimente live (SSE)

Catalogul evenimentelor trimise pe `GET /api/runs/{id}/events`. Schema exactă e în [`schemas/event.json`](schemas/event.json); fiecare linie din [`fixtures/*.ndjson`](fixtures/) e un astfel de eveniment.

## Formatul pe fir

Toate evenimentele se trimit ca mesaje SSE **nenumite** (tipul implicit `message`), deci frontend-ul le primește pe `EventSource.onmessage`. Tipul real e în câmpul `type` din JSON.

```text
id: 16
data: {"seq":16,"runId":"run_irg7k2xq4m9p","type":"agent.tool_result", ...}

```

- `id` = `seq`. La reconectare, `EventSource` trimite automat `Last-Event-ID`, iar serverul retrimite tot ce urmează după acel `seq`.
- Prima conectare poate folosi `?after=<seq>` (ex. `after=RunView.lastEventSeq`), fiindcă `EventSource` nu poate seta header-e.
- Serverul trimite întâi istoricul din buffer, apoi evenimentele live. Ordinea e garantată: `seq` crește cu 1, fără goluri.
- Comentariile SSE (`: ping`) la ~15 s țin conexiunea deschisă; frontend-ul le ignoră.
- Fluxul se închide după `run.completed` sau `run.failed`. Acțiunile ofițerului (aprobare) adaugă tranziții noi în același buffer; frontend-ul le primește dacă se reconectează sau dacă reîncarcă `GET /api/runs/{id}`.

## Plicul

```json
{
  "seq": 1,
  "runId": "run_irg7k2xq4m9p",
  "type": "state.transition",
  "agent": null,
  "at": "2026-10-28T09:30:00.000Z",
  "message": "Dosar creat: irigații, 40 ha, 3 documente încărcate",
  "data": { "from": null, "to": "CREAT", "actor": "FARMER" }
}
```

| Câmp | Tip | Ce conține |
|---|---|---|
| `seq` | integer ≥ 1 | ordinea în dosar; e și `id`-ul SSE |
| `runId` | `run_` + 12 caractere `[0-9a-z]` | dosarul |
| `type` | enum (cele 9 de mai jos) | tipul evenimentului |
| `agent` | `TECHNICAL_AUDITOR` \| `FUNDING_OPTIMIZER` \| `GREEN_UNDERWRITER` \| `null` | `null` la `state.transition` și `run.*` |
| `at` | date-time UTC | momentul emiterii |
| `message` | string RO, max. 300 | linia gata de afișat în timeline (fermier și ofițer) |
| `data` | object | depinde de `type`, vezi mai jos |

## Stările dosarului

```text
CREAT → DATE_FIRMA → AGENT_1 → AGENT_2 → AGENT_3 → GATA → TRIMIS → APROBAT → MONITORIZARE
  └──────────┴──────────┴──────────┴──────────┴──→ ESUAT
```

- `CREAT → … → GATA` le face sistemul (`actor: SYSTEM`); prima tranziție (`null → CREAT`) are `actor: FARMER`.
- `GATA → TRIMIS` o face reprezentantul IMM (`POST /api/runs/{id}/submit` cu varianta aleasă, `actor: FARMER`).
- `TRIMIS → APROBAT` o face ofițerul (`POST /api/runs/{id}/approve`, `actor: OFFICER`).
- `APROBAT → MONITORIZARE`: după tragere. În demo, tragerea e simulată imediat după aprobare.
- `POST /api/runs/{id}/request-documents` nu schimbă starea: dosarul rămâne `TRIMIS`, iar documentele apar în `RunView.pendingDocuments`.
- Evenimentele unui agent apar doar cât dosarul e în starea lui (`TECHNICAL_AUDITOR` în `AGENT_1` etc.).

## Ordinea tipică într-un dosar

```text
state.transition  null → CREAT → DATE_FIRMA → AGENT_1
agent.started     TECHNICAL_AUDITOR
  agent.tool_call / agent.tool_result   (extract_document × N, get_module_rules, compute_baseline, ...)
  agent.thought                          (între unelte, când modelul explică ce face)
agent.completed   TECHNICAL_AUDITOR      (output = submit_technical_assessment)
state.transition  AGENT_1 → AGENT_2
  ... la fel pentru FUNDING_OPTIMIZER și GREEN_UNDERWRITER ...
state.transition  AGENT_3 → GATA
run.completed
state.transition  GATA → TRIMIS                  (IMM-ul trimite cererea)
state.transition  TRIMIS → APROBAT → MONITORIZARE (după acțiunea ofițerului)
```

## Cifrele: `calcs` și `calcId`

Singurul loc unde apar numere este `agent.tool_result.data.calcs[]`. Fiecare element e un `calcResult`:

| Câmp | Ce conține |
|---|---|
| `calcId` | `calc_` + 12 hex, determinist: hash(run + unealtă + cheie) |
| `tool`, `key` | unealta care a produs cifra și o cheie stabilă (ex. `option_b.installment`) |
| `labelRo`, `display` | eticheta și valoarea formatată românește (`"85.000 EUR"`, `"15,0%"`) |
| `value`, `unit` | valoarea numerică și unitatea (enum) |
| `formula`, `sourceRo`, `dependsOn` | de unde vine cifra; ofițerul poate urmări lanțul de calcule |
| `series` | doar la grafice (ex. graficul de rambursare lună cu lună) |

Output-urile agenților (`agent.completed.data.output`) conțin **doar** `calcId`-uri, niciun număr. Frontend-ul le rezolvă din `calcs` adunate din evenimente sau din `RunView.calcs`.

## Catalog

### `state.transition`

Dosarul trece într-o stare nouă. La `DATE_FIRMA`, `dataSources` spune de unde au venit datele (badge live / mock / cache).

```json
{"seq":2,"runId":"run_irg7k2xq4m9p","type":"state.transition","agent":null,"at":"2026-10-28T09:30:01.200Z","message":"Am preluat datele firmei: ANAF, APIA, Open Banking, risc climatic","data":{"from":"CREAT","to":"DATE_FIRMA","actor":"SYSTEM","dataSources":[{"source":"ANAF","mode":"MOCK"},{"source":"APIA","mode":"MOCK"},{"source":"OPEN_BANKING","mode":"MOCK"},{"source":"COPERNICUS","mode":"MOCK"},{"source":"NATURA_2000","mode":"MOCK"},{"source":"NITRATES","mode":"MOCK"}]}}
```

### `agent.started`

Un agent pornește. `attempt` > 1 când agentul e repornit după o eroare.

```json
{"seq":4,"runId":"run_irg7k2xq4m9p","type":"agent.started","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:01.750Z","message":"Agentul 1 (auditor tehnic) a pornit","data":{"step":"AGENT_1","modelId":"eu.anthropic.claude-sonnet-4-5-20250929-v1:0","mode":"LIVE","attempt":1}}
```

### `agent.thought`

Textul scris de model între apelurile de unelte. `message` e textul scurtat la 300 de caractere; `data.text` e complet (max. 1000).

```json
{"seq":17,"runId":"run_irg7k2xq4m9p","type":"agent.thought","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:20.135Z","message":"Aspersia clasică ajunge la 15,0% economie de apă, sub pragul de 25%. Nu resping dosarul: caut în catalog cea mai ieftină combinație care trece pragul pe aceleași 40 ha.","data":{"text":"Aspersia clasică ajunge la 15,0% economie de apă, sub pragul de 25%. Nu resping dosarul: caut în catalog cea mai ieftină combinație care trece pragul pe aceleași 40 ha.","iteration":3}}
```

### `agent.tool_call`

Modelul cere o unealtă. `input` referă id-uri (configurații, catalog, documente, `calcId`), nu cifre. Apelurile `submit_*` nu se emit ca `tool_call`: un `submit_*` valid devine `agent.completed`.

```json
{"seq":15,"runId":"run_irg7k2xq4m9p","type":"agent.tool_call","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:18.193Z","message":"🔧 verific pragul pentru oferta inițială","data":{"toolUseId":"tooluse_43d32dfe0b2e","tool":"compute_indicator","iteration":3,"input":{"configId":"cfg_initial","documentId":"doc_oferta_aspersie"}}}
```

### `agent.tool_result`

Rezultatul unei unelte: cifrele noi în `calcs`, verdictele fără cifre în `result`. La `extract_document`, `result.extraction` respectă `submit_offer_extraction.json`.

```json
{"seq":16,"runId":"run_irg7k2xq4m9p","type":"agent.tool_result","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:18.335Z","message":"🔧 Aspersia clasică economisește 15,0% apă. NU TRECE (prag 25%)","data":{"toolUseId":"tooluse_43d32dfe0b2e","tool":"compute_indicator","status":"OK","durationMs":82,"calcs":[{"calcId":"calc_ed40c2662d8d","tool":"compute_indicator","key":"cfg_initial.water_saving_pct","labelRo":"Economie de apă: aspersie clasică","value":15.03,"unit":"PCT","display":"15,0%","formula":"1 − apă nouă / apă veche","dependsOn":["calc_c2b8feb9827d","calc_29043a4571fa"]}],"result":{"thresholdResult":"FAIL"}}}
```

Cu `status: "ERROR"`, `errors` e obligatoriu. Tot așa arată și un `submit_*` respins de validarea schemei (fără `tool_call` înainte); agentul primește erorile și trimite din nou:

```json
{"seq":40,"runId":"run_utl3m8vz2c6h","type":"agent.tool_result","agent":"FUNDING_OPTIMIZER","at":"2026-10-28T10:15:41.169Z","message":"⚠️ Output respins de validare: lipsește grantOutlook. Agentul se corectează","data":{"toolUseId":"tooluse_d210ef77bb0d","tool":"submit_funding_recommendation","status":"ERROR","durationMs":12,"calcs":[],"result":{},"errors":[{"path":"/grantOutlook","messageRo":"Câmp obligatoriu lipsă."}]}}
```

### `agent.completed`

Agentul a trimis un `submit_*` valid. `output` respectă schema uneltei (`submit_technical_assessment`, `submit_funding_recommendation` sau `submit_underwriting_report`); backend-ul a verificat că fiecare `calcId` există. `source` alimentează badge-ul live / cache / fallback.

```jsonc
{"seq":27,"runId":"run_irg7k2xq4m9p","type":"agent.completed","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:30.713Z","message":"✅ Agentul 1 a terminat: sub prag → upgrade → 32,0%, peste prag","data":{"submitTool":"submit_technical_assessment","source":"LIVE","iterations":6,"durationMs":31800,"output":{ /* submit_technical_assessment complet: fixtures/irigatii.ndjson, linia 27 */ }}}
```

### `agent.degraded`

Agentul a trecut la un nivel de fallback (retry → model de rezervă → cache → golden). Badge-ul din panoul ofițerului se schimbă; `agent.completed.data.source` confirmă nivelul final.

```json
{"seq":44,"runId":"run_utl3m8vz2c6h","type":"agent.degraded","agent":"GREEN_UNDERWRITER","at":"2026-10-28T10:15:48.119Z","message":"⚠️ Bedrock a răspuns lent; reîncerc (badge: retry)","data":{"level":"RETRY","reason":"THROTTLED","attempt":2,"modelId":"eu.anthropic.claude-sonnet-4-5-20250929-v1:0","detailRo":"ThrottlingException la primul apel; reîncercare după 1,5 s."}}
```

### `run.completed`

Toți agenții au terminat; dosarul e `GATA`. Vine imediat după tranziția `AGENT_3 → GATA`. `netAdvantageCalcId` e cifra mare de pe cardul fermierului („Câștigi X EUR”).

```json
{"seq":56,"runId":"run_irg7k2xq4m9p","type":"run.completed","agent":null,"at":"2026-10-28T09:30:55.028Z","message":"Analiză completă: eligibil cu condiții, recomandăm B (+67.327 EUR în 5 ani)","data":{"state":"GATA","durationMs":55028,"decision":"ELIGIBLE_WITH_CONDITIONS","recommendedOptionId":"B","netAdvantageCalcId":"calc_79c1e3df6a0f","sources":{"TECHNICAL_AUDITOR":"LIVE","FUNDING_OPTIMIZER":"LIVE","GREEN_UNDERWRITER":"LIVE"}}}
```

### `run.failed`

Analiza s-a oprit și toate nivelurile de fallback au eșuat. Vine imediat după tranziția `<stare> → ESUAT`. Fixtures nu conțin un astfel de dosar; exemplul e construit de mână.

```json
{"seq":31,"runId":"run_irg7k2xq4m9p","type":"run.failed","agent":null,"at":"2026-10-28T09:31:40.000Z","message":"Analiza s-a oprit la Agentul 2: Bedrock nu răspunde și nu există o rulare salvată.","data":{"state":"ESUAT","failedStep":"AGENT_2","errorCode":"BEDROCK_UNAVAILABLE","messageRo":"Bedrock nu răspunde și nu există o rulare salvată pentru aceste documente. Reîncearcă sau pornește dosarul demo.","retryable":true}}
```

## Uneltele (valori posibile pentru `tool`)

| Agent | Unelte |
|---|---|
| Auditor tehnic | `extract_document`, `get_module_rules`, `compute_baseline`, `compute_indicator`, `search_upgrades`, `simulate_upgrade_package`, `check_dnsh_inputs` → `submit_technical_assessment` |
| Finanțare | `list_financing_lines`, `check_program_eligibility`, `build_funding_stack`, `build_scenario`, `compare_scenarios`, `check_affordability` → `submit_funding_recommendation` |
| Underwriter | `get_labeling_rules`, `get_dnsh_criteria`, `calculate_impact` → `submit_underwriting_report` |

`extract_document` rulează în interiorul Agentului 1, cu un apel separat (model mai mic, unealtă forțată `submit_offer_extraction`) pentru fiecare document.
