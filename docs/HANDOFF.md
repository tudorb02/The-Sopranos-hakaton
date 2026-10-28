# Predare: GreenStruct Agro, branch `B2B_Agro`

Starea la **28.10.2026**. Citește întâi `README.md` (produsul), apoi `CLAUDE.md` (regulile), apoi acest fișier.

## 1. Starea în 30 de secunde

| Zonă | Stare |
|---|---|
| Motor de calcul (`engine/`) | gata pentru cele 6 categorii: irigații, energie, utilaje, zootehnie, post-recoltă, ecologic; plus dobânda pe componente, niveluri verzi, DSCR, selectorul de upgrade, monitorizarea de 12 luni și portofoliul. Fiecare funcție are teste pe valori calculate separat |
| Unelte ale agenților (`tools/`) | gata; fiecare categorie e un `ModuleCalculator` (`tools/technical/*Module.java`) |
| Agenți | Bedrock (`bedrock/`, modelele verificate live cu cheia din `.env`) și, ca ultim nivel din planul B, agenți pe reguli (`agents/rules/`) care cheamă aceleași unelte fără model. **Toată aplicația rulează offline** |
| API | complet: module, fermă, dosare, SSE, `submit`, `approve`, cerere de documente, raport PDF, „Simulează 12 luni”, portofoliu, health Bedrock |
| Contracte | fixtures și exemple se generează din răspunsurile reale ale backend-ului (`npm run gen`); `npm run check` și `npm run validate:samples` trec |
| Ferme demo | 6, numerice și fictive (verificate că nu există la ANAF): `45871203` irigații, `41726035` energie, `38264019` utilaje, `47209135` zootehnie, `38751946` post-recoltă, `41629307` ecologic |
| Frontend | vezi `frontend/README.md` |

## 2. Pornire

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
cd backend && mvn test                      # toate testele
GREENSTRUCT_ANAF_ENABLED=false GREENSTRUCT_ANALYSIS_DATE=2026-10-28 mvn spring-boot:run   # http://localhost:8080
cd contracts && npm install && npm run check && npm run validate:samples
```

Demo offline fix, chiar dacă `.env` are cheie Bedrock: `GREENSTRUCT_MODE=REPLAY`. Fără cheie, aplicația trece singură pe REPLAY și, fără rulări înregistrate în `data/demo/golden/`, pe agenții pe reguli.

Verificare rapidă a fluxului întreg:

```bash
RUN=$(curl -s -X POST localhost:8080/api/runs/demo/irigatii | jq -r .runId)
curl -s -X POST localhost:8080/api/runs/$RUN/submit -H 'content-type: application/json' -d '{"variant":"VERDE"}'
curl -s -X POST localhost:8080/api/runs/$RUN/approve -H 'content-type: application/json' -d '{"officerId":"ofiter.demo"}'
curl -s -o raport.pdf localhost:8080/api/runs/$RUN/report.pdf
curl -s -X POST localhost:8080/api/runs/$RUN/simulate-monitoring
curl -s localhost:8080/api/portfolio
```

Regenerarea contractelor după o schimbare de format: `cd backend && mvn test -Dtest=ContractSamplesTest`, apoi `cd contracts && npm run gen && npm run check`.

## 3. Cum e construit

- `orchestration/`: mașina de stări `CREAT → DATE_FIRMA → AGENT_1 → AGENT_2 → AGENT_3 → GATA → TRIMIS → APROBAT → MONITORIZARE`; `MonitoringService`, `PortfolioService`, `ReportService` (PDF cu OpenPDF, font DejaVu pentru diacritice).
- `tools/`: uneltele agenților; `ToolRegistry`; `Calc` (singurul loc cu cifre; `calcId` determinist și idempotent); `CalcStore` normalizează cheile (snake_case) și trunchiază câmpurile la limitele contractului.
- `bedrock/`: `ToolLoop` (Converse, până la 12 iterații), reluare (`{{calc:tool/key}}`), cache, recorder, `AgentRuntime` cu nivelurile LIVE → cache → golden → reguli.
- `agents/rules/`: `RuleBased{Technical,Funding,Underwriter}Agent`, `DnshRules`, `RecordedExtractions` (citirile înregistrate ale documentelor demo din `data/demo/extractions/`; unele sunt generate de `scripts/demo-data/extractions.mjs`).
- Categorie nouă: un `ModuleCalculator`, `config/modules/<id>.json`, `data/catalog/<id>.json`, o fermă și un scenariu în `data/demo/`, citirile documentelor în `data/demo/extractions/`.

## 4. De știut și de decis

1. **Datele demo ale utilajelor:** cashflow-ul din fișierul Product (74.000 EUR/an) nu acoperă rata: ambele credite pică testul de 40%, iar agentul recomandă clasicul. Decizie de produs: cashflow mai mare, durată mai lungă sau altă regulă.
2. **Regula de recomandare:** creditul verde se recomandă dacă e eligibil și avantajul net e pozitiv (README §4, pasul 8); testul de plată se arată separat.
3. **Garanția FEI la dobânda Credit BIO (ecologic):** `PricingSupport` folosește 70% și pentru Credit BIO, care nu are FEI. De ajustat când răspund mentorii.
4. **Nivelurile verzi** rezultă din regulile README: zootehnie 85% → Verde Plus; post-recoltă 29,65% și utilaje 20,7% → Verde cu upgrade (sub 37,5% / 30%). Fișierele Product spuneau „Verde” pentru ultimele două.
5. **Parametri demo:** pragurile, PD/LGD, ponderile de risc, procentul FEI, bonusul de impact și toleranța de monitorizare sunt `demo: true` în `config/` până răspund mentorii Raiffeisen (README §14).
6. **Neverificat:** interfața în browser pe toate cele 6 categorii; un dosar LIVE complet pe Bedrock (doar verificări punctuale ale modelelor și ale extracției).
7. **Coordonare cu Miruna:** ea a implementat în paralel `TRIMIS`, `submit`, `select_fund`, `compute_dscr`, `determine_green_tier`; am păstrat versiunile ei. Să nu se mai lucreze în două locuri la `price_loan`, monitorizare sau PDF.
8. **Rulări înregistrate (`data/demo/golden/`):** nu există; pașii sunt în `data/demo/golden/README.md`. Nu sunt necesare, pentru că agenții pe reguli acoperă lipsa lor.
9. **Contract:** `affordability.ratioCalcId`/`dscrCalcId` sunt opționale (fără Open Banking nu există cashflow); `componentCategory` și cheile de extracție au fost extinse pentru noile categorii.

## 5. Capcane

- ANAF răspunde la un CUI necunoscut cu HTTP 404 și corp JSON; o cerere pe secundă. Testele nu cheamă ANAF-ul real. Calea de lucru e `/api/PlatitorTvaRest/v9/tva`.
- `Path` din `@ConfigurationProperties` se leagă greșit din jar: căile sunt `String`.
- Thread-uri virtuale: `ReentrantLock`, nu `synchronized`, în jurul operațiilor blocante.
- Nu opri backend-ul altcuiva cu `pkill -f spring-boot:run`; folosește `SERVER_PORT=8090` pentru o a doua instanță.
- `.env` (cheie Bedrock pe termen scurt, `us-west-2`) e în afara git; regiunea e US, deci doar date demo fictive.
