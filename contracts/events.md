# Live events (SSE)

Catalogue of the events sent on `GET /api/runs/{id}/events`. The exact schema is in [`schemas/event.json`](schemas/event.json); each line in [`fixtures/*.ndjson`](fixtures/) is one such event.

## Wire format

All events are sent as **unnamed** SSE messages (default type `message`), so the frontend receives them on `EventSource.onmessage`. The real type is in the `type` field of the JSON.

```text
id: 16
data: {"seq":16,"runId":"run_irg7k2xq4m9p","type":"agent.tool_result", ...}

```

- `id` = `seq`. On reconnect, `EventSource` automatically sends `Last-Event-ID`, and the server resends everything after that `seq`.
- The first connection can use `?after=<seq>` (e.g. `after=RunView.lastEventSeq`), because `EventSource` cannot set headers.
- The server first sends the history from the buffer, then the live events. Order is guaranteed: `seq` grows by 1, without gaps.
- SSE comments (`: ping`) every ~15 s keep the connection open; the frontend ignores them.
- The stream closes after `run.completed` or `run.failed`. Submitting the application and the bank's approval add new transitions to the same buffer; the frontend receives them if it reconnects or reloads `GET /api/runs/{id}`.

## The envelope

```json
{
  "seq": 1,
  "runId": "run_irg7k2xq4m9p",
  "type": "state.transition",
  "agent": null,
  "at": "2026-10-28T09:30:00.000Z",
  "message": "Dossier created: irrigation, 40 ha, 3 documents uploaded",
  "data": { "from": null, "to": "CREAT", "actor": "FARMER" }
}
```

| Field | Type | Contents |
|---|---|---|
| `seq` | integer ≥ 1 | the order within the dossier; also the SSE `id` |
| `runId` | `run_` + 12 characters `[0-9a-z]` | the dossier |
| `type` | enum (the 9 below) | the event type |
| `agent` | `TECHNICAL_AUDITOR` \| `FUNDING_OPTIMIZER` \| `GREEN_UNDERWRITER` \| `null` | `null` for `state.transition` and `run.*` |
| `at` | date-time UTC | when it was emitted |
| `message` | English string, max. 300 | the line ready to display in the timeline (farmer and officer) |
| `data` | object | depends on `type`, see below |

## Dossier states

```text
CREAT → DATE_FIRMA → AGENT_1 → AGENT_2 → AGENT_3 → GATA → TRIMIS → APROBAT → MONITORIZARE
  └──────────┴──────────┴──────────┴──────────┴──→ ESUAT
```

- `CREAT → … → GATA` are made by the system (`actor: SYSTEM`); the first transition (`null → CREAT`) has `actor: FARMER`.
- `GATA` = the offers are ready. `GATA → TRIMIS` is made by the SME when it picks the option and submits the application (`POST /api/runs/{id}/submit`, `actor: FARMER`).
- `TRIMIS → APROBAT` is the bank's final approval (`POST /api/runs/{id}/approve`, `actor: OFFICER`).
- `APROBAT → MONITORIZARE`: after drawdown. In the demo, drawdown is simulated right after approval.
- `POST /api/runs/{id}/request-documents` does not change the state: the dossier stays `TRIMIS`, and the documents appear in `RunView.pendingDocuments`.
- An agent's events appear only while the dossier is in that agent's state (`TECHNICAL_AUDITOR` in `AGENT_1`, etc.).

## Typical order in a dossier

```text
state.transition  null → CREAT → DATE_FIRMA → AGENT_1
agent.started     TECHNICAL_AUDITOR
  agent.tool_call / agent.tool_result   (extract_document × N, get_module_rules, compute_baseline, ...)
  agent.thought                          (between tools, when the model explains what it is doing)
agent.completed   TECHNICAL_AUDITOR      (output = submit_technical_assessment)
state.transition  AGENT_1 → AGENT_2
  ... the same for FUNDING_OPTIMIZER and GREEN_UNDERWRITER ...
state.transition  AGENT_3 → GATA
run.completed
state.transition  GATA → TRIMIS                   (after the SME submits the application)
state.transition  TRIMIS → APROBAT → MONITORIZARE (after the bank's approval)
```

## Figures: `calcs` and `calcId`

The only place where numbers appear is `agent.tool_result.data.calcs[]`. Each element is a `calcResult`:

| Field | Contents |
|---|---|
| `calcId` | `calc_` + 12 hex, deterministic: hash(run + tool + key) |
| `tool`, `key` | the tool that produced the figure and a stable key (e.g. `option_b.installment`) |
| `labelRo`, `display` | the label and the value formatted in English (`"85,000 EUR"`, `"15.0%"`); the `Ro` suffix is historical |
| `value`, `unit` | the numeric value and the unit (enum) |
| `formula`, `sourceRo`, `dependsOn` | where the figure comes from; the officer can follow the chain of calculations |
| `series` | only for charts (e.g. the month-by-month repayment chart) |

Agent outputs (`agent.completed.data.output`) contain **only** `calcId`s, no numbers. The frontend resolves them from the `calcs` collected from the events or from `RunView.calcs`.

## Catalogue

### `state.transition`

The dossier moves to a new state. At `DATE_FIRMA`, `dataSources` says where the data came from (live / mock / cache badge).

```json
{"seq":2,"runId":"run_irg7k2xq4m9p","type":"state.transition","agent":null,"at":"2026-10-28T09:30:01.200Z","message":"Company data retrieved: ANAF, APIA, Open Banking, climate risk","data":{"from":"CREAT","to":"DATE_FIRMA","actor":"SYSTEM","dataSources":[{"source":"ANAF","mode":"MOCK"},{"source":"APIA","mode":"MOCK"},{"source":"OPEN_BANKING","mode":"MOCK"},{"source":"COPERNICUS","mode":"MOCK"},{"source":"NATURA_2000","mode":"MOCK"},{"source":"NITRATES","mode":"MOCK"}]}}
```

### `agent.started`

An agent starts. `attempt` > 1 when the agent is restarted after an error.

```json
{"seq":4,"runId":"run_irg7k2xq4m9p","type":"agent.started","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:01.750Z","message":"Agent 1 (technical auditor) started","data":{"step":"AGENT_1","modelId":"eu.anthropic.claude-sonnet-4-5-20250929-v1:0","mode":"LIVE","attempt":1}}
```

### `agent.thought`

The text written by the model between tool calls. `message` is the text cut to 300 characters; `data.text` is complete (max. 1000).

```json
{"seq":17,"runId":"run_irg7k2xq4m9p","type":"agent.thought","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:20.135Z","message":"Classic sprinkler irrigation reaches 15.0% water saving, below the 25% threshold. I am not rejecting the dossier: I am searching the catalogue for the cheapest combination that passes the threshold on the same 40 ha.","data":{"text":"Classic sprinkler irrigation reaches 15.0% water saving, below the 25% threshold. I am not rejecting the dossier: I am searching the catalogue for the cheapest combination that passes the threshold on the same 40 ha.","iteration":3}}
```

### `agent.tool_call`

The model requests a tool. `input` references ids (configurations, catalogue, documents, `calcId`), not figures. `submit_*` calls are not emitted as `tool_call`: a valid `submit_*` becomes `agent.completed`.

```json
{"seq":15,"runId":"run_irg7k2xq4m9p","type":"agent.tool_call","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:18.193Z","message":"🔧 checking the threshold for the initial offer","data":{"toolUseId":"tooluse_43d32dfe0b2e","tool":"compute_indicator","iteration":3,"input":{"configId":"cfg_initial","documentId":"doc_oferta_aspersie"}}}
```

### `agent.tool_result`

The result of a tool: new figures in `calcs`, figure-free verdicts in `result`. For `extract_document`, `result.extraction` follows `submit_offer_extraction.json`.

```json
{"seq":16,"runId":"run_irg7k2xq4m9p","type":"agent.tool_result","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:18.335Z","message":"🔧 Classic sprinkler irrigation saves 15.0% water. FAILS (threshold 25%)","data":{"toolUseId":"tooluse_43d32dfe0b2e","tool":"compute_indicator","status":"OK","durationMs":82,"calcs":[{"calcId":"calc_ed40c2662d8d","tool":"compute_indicator","key":"cfg_initial.water_saving_pct","labelRo":"Water saving: classic sprinkler","value":15.03,"unit":"PCT","display":"15.0%","formula":"1 − new water / old water","dependsOn":["calc_c2b8feb9827d","calc_29043a4571fa"]}],"result":{"thresholdResult":"FAIL"}}}
```

With `status: "ERROR"`, `errors` is required. A `submit_*` rejected by schema validation looks the same (with no `tool_call` before it); the agent receives the errors and submits again:

```json
{"seq":40,"runId":"run_utl3m8vz2c6h","type":"agent.tool_result","agent":"FUNDING_OPTIMIZER","at":"2026-10-28T10:15:41.169Z","message":"⚠️ Output rejected by validation: grantOutlook is missing. The agent is correcting itself","data":{"toolUseId":"tooluse_d210ef77bb0d","tool":"submit_funding_recommendation","status":"ERROR","durationMs":12,"calcs":[],"result":{},"errors":[{"path":"/grantOutlook","messageRo":"Required field missing."}]}}
```

### `agent.completed`

The agent sent a valid `submit_*`. `output` follows the tool schema (`submit_technical_assessment`, `submit_funding_recommendation` or `submit_underwriting_report`); the backend has checked that every `calcId` exists. `source` drives the live / cache / fallback badge.

```jsonc
{"seq":27,"runId":"run_irg7k2xq4m9p","type":"agent.completed","agent":"TECHNICAL_AUDITOR","at":"2026-10-28T09:30:30.713Z","message":"✅ Agent 1 finished: below threshold → upgrade → 32.0%, above threshold","data":{"submitTool":"submit_technical_assessment","source":"LIVE","iterations":6,"durationMs":31800,"output":{ /* full submit_technical_assessment: the agent.completed line of TECHNICAL_AUDITOR in fixtures/irigatii.ndjson */ }}}
```

### `agent.degraded`

The agent switched to a fallback level (retry → backup model → cache → golden). The badge in the officer panel changes; `agent.completed.data.source` confirms the final level.

```json
{"seq":44,"runId":"run_utl3m8vz2c6h","type":"agent.degraded","agent":"GREEN_UNDERWRITER","at":"2026-10-28T10:15:48.119Z","message":"⚠️ Bedrock responded slowly; retrying (badge: retry)","data":{"level":"RETRY","reason":"THROTTLED","attempt":2,"modelId":"eu.anthropic.claude-sonnet-4-5-20250929-v1:0","detailRo":"ThrottlingException on the first call; retrying after 1.5 s."}}
```

### `run.completed`

All agents have finished; the dossier is `GATA`. Comes right after the `AGENT_3 → GATA` transition. `netAdvantageCalcId` is the big figure on the farmer's card ("You gain X EUR").

```json
{"seq":56,"runId":"run_irg7k2xq4m9p","type":"run.completed","agent":null,"at":"2026-10-28T09:30:55.028Z","message":"Analysis complete: eligible with conditions, we recommend B (+67,327 EUR over 5 years)","data":{"state":"GATA","durationMs":55028,"decision":"ELIGIBLE_WITH_CONDITIONS","recommendedOptionId":"B","netAdvantageCalcId":"calc_79c1e3df6a0f","sources":{"TECHNICAL_AUDITOR":"LIVE","FUNDING_OPTIMIZER":"LIVE","GREEN_UNDERWRITER":"LIVE"}}}
```

### `run.failed`

The analysis stopped and all fallback levels failed. Comes right after the `<state> → ESUAT` transition. The fixtures do not contain such a dossier; the example is hand-made.

```json
{"seq":31,"runId":"run_irg7k2xq4m9p","type":"run.failed","agent":null,"at":"2026-10-28T09:31:40.000Z","message":"The analysis stopped at Agent 2: Bedrock is not responding and there is no saved run.","data":{"state":"ESUAT","failedStep":"AGENT_2","errorCode":"BEDROCK_UNAVAILABLE","messageRo":"Bedrock is not responding and there is no saved run for these documents. Try again or start the demo dossier.","retryable":true}}
```

## Tools (possible values of `tool`)

| Agent | Tools |
|---|---|
| Technical auditor | `extract_document`, `get_module_rules`, `compute_baseline`, `compute_indicator`, `search_upgrades`, `simulate_upgrade_package`, `check_dnsh_inputs` → `submit_technical_assessment` |
| Funding | `list_financing_lines`, `check_program_eligibility`, `build_funding_stack`, `build_scenario`, `compare_scenarios`, `check_affordability` → `submit_funding_recommendation` |
| Underwriter | `get_labeling_rules`, `get_dnsh_criteria`, `calculate_impact` → `submit_underwriting_report` |

`extract_document` runs inside Agent 1, with a separate call (smaller model, forced tool `submit_offer_extraction`) for each document.
