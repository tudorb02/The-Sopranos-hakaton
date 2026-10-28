# contracts/

Singurul loc unde se schimbă formatul datelor dintre frontend, backend și agenții de pe Bedrock (contract-first). Orice schimbare de aici se anunță rolurilor afectate și trece `npm run check`.

| Fișier | Ce conține | Cine îl folosește |
|---|---|---|
| [`openapi.yaml`](openapi.yaml) | API-ul REST (OpenAPI 3.1): module, fermă, dosare, SSE, acțiunile ofițerului, health | frontend (Prism, tipuri), backend (controllere) |
| [`schemas/submit_*.json`](schemas/) | output-urile agenților (JSON Schema 2020-12) | Bedrock (scheme de unelte), backend (validare networknt), frontend (tipuri TS) |
| [`schemas/event.json`](schemas/event.json) | plicul evenimentelor SSE și `calcResult` | backend (`SseHub`), frontend (timeline) |
| [`events.md`](events.md) | catalogul evenimentelor, cu un exemplu pentru fiecare tip | toți |
| [`fixtures/*.ndjson`](fixtures/) | câte un dosar complet, un eveniment pe linie: `irigatii` și `utilaje` | frontend (timeline fără backend), backend (teste în modul REPLAY) |
| [`examples/*.json`](examples/) | exemplele din `openapi.yaml` (servite de Prism), generate din fixtures | frontend |
| [`tools/`](tools/) | generatorul de fixtures și validatorul | toți |

## Comenzi

```bash
cd contracts && npm install
```

```bash
npm run check
```

`check` rulează ambele verificări:
- `npm run lint`: `redocly lint openapi.yaml` (excepțiile justificate sunt în `.redocly.lint-ignore.yaml`);
- `npm run validate`: [`tools/validate.mjs`](tools/validate.mjs), care verifică:
  - schemele compilează (Ajv, strict), iar `$defs` copiate între fișiere sunt identice;
  - schemele agenților nu au câmpuri numerice (singura excepție: numărul paginii la extracție);
  - fiecare linie din fixtures respectă `event.json`, iar fiecare `output` respectă schema `submit_*`;
  - `seq` fără goluri, tranziții de stare permise, evenimentele agentului doar în starea lui;
  - fiecare `calcId` folosit a fost emis înainte de o unealtă; `configId`, `componentId`, `conditionId` există;
  - DNSH are 5 obiective diferite de contribuția substanțială; B e recomandat doar dacă e eligibil, are avantaj net și trece testul de plată;
  - exemplele din `events.md` și din `openapi.yaml` respectă schemele.

Alte comenzi:

```bash
npm run mock
```

Pornește Prism pe `http://localhost:4010` (`Prefer: example=utilaje` alege exemplul).

```bash
npm run validate:samples
```

Verifică răspunsurile reale ale backend-ului față de contract. Testul `ContractSamplesTest` din `backend/` (rulat de `mvn test`) scrie răspunsurile și evenimentele SSE în `backend/target/contract-samples/<Schema>__<caz>.json`; scriptul le validează pe toate.

```bash
npm run gen
```

Regenerează `fixtures/` și `examples/` după o schimbare de format. Cifrele vin din [`tools/gen-fixtures.mjs`](tools/gen-fixtures.mjs), care aplică formulele din planul de arhitectură (§4, §5).

Fără npm install, doar cu npx:

```bash
npx @redocly/cli@2.62.1 lint openapi.yaml
```

## Reguli

1. **Cifrele vin doar din motor.** Singurul loc cu numere este `calcResult` (în `agent.tool_result.data.calcs` și în `RunView.calcs`). Output-urile agenților referă cifrele prin `calcId` (`^calc_[a-f0-9]{12}$`). Backend-ul respinge un `submit_*` care referă un `calcId` necunoscut.
2. **Scheme închise.** `additionalProperties: false` peste tot, enum-uri unde se poate, texte libere în română cu `maxLength`. Cheile și identificatorii sunt în engleză.
3. **Schemele agenților sunt autonome** (doar `$ref` locale), ca să poată fi trimise direct la Bedrock. Backend-ul scoate `$schema`, `$id` și `title` înainte de `toolSpec.inputSchema`; numele uneltei e `title`. Dacă Bedrock refuză `$ref`, backend-ul le expandează la încărcare.
4. **Evenimentele SSE** sunt toate mesaje nenumite, cu `id = seq`. Detaliile sunt în `events.md`.

## Cifrele din demo (generate, de folosit ca așteptări în testele JUnit)

| | Irigații (40 ha legume, Constanța) | Utilaje (400 ha cereale, Călărași) |
|---|---|---|
| Inițial | aspersie clasică 85.000 EUR, 15,0% economie de apă (prag 25%) | 4 tractoare Stage V 440.000 EUR, 12,0% economie de motorină (prag 20%) |
| Recomandat | picurare + senzori + contor + pompă solară 125.000 EUR, 32,0% | + pachet de precizie 52.000 EUR, 20,8%; precizia = 10,6% din valoare |
| Impact/an | 74.937 m³ apă, 97.503 kWh din rețea, 22,4 t CO₂ | 7.488 l motorină, 3.000 kg N, 19,9 t CO₂ |
| A | credit standard 8,9%, 60 luni: 1.760 EUR/lună + ipotecă | credit standard 7,5%, 84 luni: 6.749 EUR/lună |
| B | credit verde 6,4% + garanție FEI 70%, rate iul–oct: 7.360 EUR/rată | grant DR-12 200.000 EUR + cofinanțare 292.000 EUR la 6,0% cu FGCR 80%: 4.266 EUR/lună + punte 200.000 EUR |
| Avantaj net B | 67.327 EUR în 5 ani; upgrade amortizat în 22,7 luni | 241.532 EUR în 7 ani; precizia amortizată în 32,6 luni |
| Grant | nicio sesiune AFIR deschisă (DR-26), spus explicit | DR-12 deschis până la 02.12.2026 |

Dobânzile, pragurile, prețurile și acoperirea garanțiilor sunt valori demo, de confirmat cu mentorii Raiffeisen. Ele trebuie să stea în `config/`, nu în cod.
