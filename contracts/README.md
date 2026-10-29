# contracts/

The single place where the data format between the frontend, the backend and the Bedrock agents changes (contract-first). Every change here is announced to the roles affected and passes `npm run check`.

| File | Contents | Used by |
|---|---|---|
| [`openapi.yaml`](openapi.yaml) | the REST API (OpenAPI 3.1): modules, farm, dossiers, SSE, officer actions, health | frontend (Prism, types), backend (controllers) |
| [`schemas/submit_*.json`](schemas/) | the agent outputs (JSON Schema 2020-12) | Bedrock (tool schemas), backend (networknt validation), frontend (TS types) |
| [`schemas/event.json`](schemas/event.json) | the SSE event envelope and `calcResult` | backend (`SseHub`), frontend (timeline) |
| [`events.md`](events.md) | the event catalogue, with one example per type | everyone |
| [`fixtures/*.ndjson`](fixtures/) | one complete dossier per demo scenario, one event per line | frontend (timeline without a backend), backend (tests in REPLAY mode) |
| [`examples/*.json`](examples/) | the examples in `openapi.yaml` (served by Prism) | frontend |
| [`tools/`](tools/) | the export script for fixtures and examples, and the validators | everyone |

## Commands

```bash
cd contracts && npm install
```

```bash
npm run check
```

`check` runs both checks:
- `npm run lint`: `redocly lint openapi.yaml` (the justified exceptions are in `.redocly.lint-ignore.yaml`);
- `npm run validate`: [`tools/validate.mjs`](tools/validate.mjs), which checks that:
  - the schemas compile (Ajv, strict), and `$defs` copied between files are identical;
  - the agent schemas have no numeric fields (the only exception: the page number in extraction);
  - every line in the fixtures follows `event.json`, and every `output` follows its `submit_*` schema;
  - `seq` has no gaps, state transitions are allowed, and agent events occur only in that agent's state;
  - every `calcId` used was emitted earlier by a tool; `configId`, `componentId`, `conditionId` exist;
  - DNSH has 5 objectives other than the substantial contribution; B is recommended only if it is eligible, has a net advantage and passes the affordability test;
  - the examples in `events.md` and in `openapi.yaml` follow the schemas.

Other commands:

```bash
npm run mock
```

Starts Prism on `http://localhost:4010` (`Prefer: example=utilaje` picks the example).

```bash
npm run validate:samples
```

Checks the backend's real responses against the contract. The `ContractSamplesTest` test in `backend/` (run by `mvn test`) writes the responses and SSE events to `backend/target/contract-samples/<Schema>__<case>.json`; the script validates all of them.

```bash
(cd ../backend && mvn test -Dtest=ContractSamplesTest) && npm run gen
```

Regenerates `fixtures/` and `examples/` after a format change. `npm run gen` runs [`tools/export-from-samples.mjs`](tools/export-from-samples.mjs), which copies the real backend responses from `backend/target/contract-samples/` (produced by `ContractSamplesTest`), so the fixtures cannot drift from the code. [`tools/gen-fixtures.mjs`](tools/gen-fixtures.mjs) is legacy: do not run it, it overwrites the real fixtures.

Without npm install, with npx only:

```bash
npx @redocly/cli@2.62.1 lint openapi.yaml
```

## Rules

1. **Figures come only from the engine.** The only place with numbers is `calcResult` (in `agent.tool_result.data.calcs` and in `RunView.calcs`). Agent outputs reference figures by `calcId` (`^calc_[a-f0-9]{12}$`). The backend rejects a `submit_*` that references an unknown `calcId`.
2. **Closed schemas.** `additionalProperties: false` everywhere, enums where possible, free texts in English with `maxLength`. Keys and identifiers are in English; field names keep the historical `Ro` suffix (`labelRo`, `sourceRo`, `messageRo`, ...) for compatibility.
3. **Agent schemas are self-contained** (local `$ref` only), so they can be sent to Bedrock directly. The backend removes `$schema`, `$id` and `title` before `toolSpec.inputSchema`; the tool name is `title`. If Bedrock rejects `$ref`, the backend expands them on load.
4. **SSE events** are all unnamed messages, with `id = seq`. The details are in `events.md`.

## Demo figures (expected values for the JUnit tests)

| | Irrigation (40 ha vegetables, Constanța) | Machinery (400 ha cereals, Călărași) |
|---|---|---|
| Initial | classic sprinkler 85,000 EUR, 15.0% water saving (threshold 25%) | 4 Stage V tractors 440,000 EUR, 12.0% diesel saving (threshold 20%) |
| Recommended | drip + sensors + meter + solar pump 125,000 EUR, 32.0% | + precision package 52,000 EUR, 20.8%; precision = 10.6% of the value |
| Impact/yr | 74,937 m³ water, 97,503 kWh from the grid, 22.4 t CO₂ | 7,488 l diesel, 3,000 kg N, 19.9 t CO₂ |
| A | standard loan 8.9%, 60 months: 1,760 EUR/month + mortgage | standard loan 7.5%, 84 months: 6,749 EUR/month |
| B | green loan 6.4% + EIF guarantee 70%, Jul–Oct instalments: 7,360 EUR/instalment | grant DR-12 200,000 EUR + co-financing 292,000 EUR at 6.0% with FGCR 80%: 4,266 EUR/month + bridge 200,000 EUR |
| Net advantage B | 67,327 EUR over 5 years; upgrade paid back in 22.7 months | 241,532 EUR over 7 years; precision paid back in 32.6 months |
| Grant | no open AFIR session (DR-26), stated explicitly | DR-12 open until 2026-12-02 |

Interest rates, thresholds, prices and guarantee coverage are demo values, to be confirmed with the Raiffeisen mentors. They must live in `config/`, not in code.
