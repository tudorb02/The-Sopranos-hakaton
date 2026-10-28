# Rulări înregistrate (planul B, README §11)

Aici stau deciziile agenților din rulări reale, pentru modul `REPLAY` și pentru fallback-ul din `HYBRID`. Fără chei AWS, aplicația pornește direct în `REPLAY` și citește de aici.

```text
golden/<scenariu>/technical_auditor.json
golden/<scenariu>/funding_optimizer.json
golden/<scenariu>/green_underwriter.json
```

`<scenariu>` = `irigatii` sau `utilaje` (id-ul dosarului demo). Un dosar care nu e demo folosește înregistrarea modulului său.

## Ce conține un fișier

- `steps`: gândurile și apelurile de unelte ale agentului, în ordine (`tool` + `input`).
- La `extract_document`, `extraction` păstrează citirea PDF-ului, ca replay-ul să nu aibă nevoie de Bedrock.
- `submit`: input-ul final al uneltei `submit_*`.
- **Nicio cifră și niciun `calcId`.** Referințele la calcule sunt scrise `{{calc:unealtă/cheie}}` (de ex. `{{calc:compute_indicator/cfg_initial.water_saving_pct}}`).

## Cum se reia

La replay, fiecare apel înregistrat rulează din nou prin `ToolRegistry` pe **motorul curent**, deci cifrele se recalculează. `{{calc:...}}` devine `calcId`-ul din dosarul curent (cel mai recent calcul cu acea unealtă și cheie). La final, `submit` se validează din nou pe schema din `contracts/schemas/`. Dacă o unealtă nu mai produce un calcul, replay-ul se oprește cu `UNKNOWN_CALC_ID` și numele calculului lipsă: reînregistrează.

Evenimentele sunt cele ale unei rulări live (`agent.tool_call`, `agent.tool_result`, ...), cu o pauză între ele (`greenstruct.agent-runtime.replay-delay`, implicit 350 ms). Badge-ul sursei este `GOLDEN`.

## Cum înregistrezi

Doar pe date demo fictive. Ai nevoie de cheia Bedrock din `.env` (`AWS_BEARER_TOKEN_BEDROCK`).

1. Pornește backend-ul live, cu înregistrarea pornită:

   ```bash
   cd backend
   GREENSTRUCT_MODE=LIVE GREENSTRUCT_RECORD_GOLDEN=true mvn spring-boot:run
   ```

2. Lansează dosarul demo: `curl -X POST localhost:8080/api/runs/demo/irigatii` (apoi `utilaje`). Așteaptă `run.completed` în `GET /api/runs/{id}/events`.
3. La fiecare agent terminat cu succes, fișierul lui apare în `golden/<scenariu>/`. Se scrie doar pentru dosare demo și doar pentru rulări live.
4. Verifică în `git diff` că nu apar `calc_` (trebuie doar `{{calc:...}}`), apoi comite.
5. Testează offline: `GREENSTRUCT_MODE=REPLAY mvn spring-boot:run` (sau pornește fără chei) și rulează același dosar.

Re-înregistrează de fiecare dată când se schimbă uneltele, schemele `submit_*` sau cheile calculelor.

## Nivelurile de rezervă

`LIVE` = doar Bedrock. `HYBRID` = Bedrock, iar dacă pică după reîncercări și modelul de rezervă: cache (aceleași documente, în memorie), apoi `golden/`, cu `agent.degraded` și badge `CACHE` / `GOLDEN`. `REPLAY` = doar `golden/`.
