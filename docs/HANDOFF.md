# Predare: GreenStruct Agro, branch `B2B_Agro`

Pentru cine preia implementarea. Starea la **28.10.2026**. Citește întâi `README.md` (produsul: §4 calculul, §6 categoriile, §13 deciziile), apoi `CLAUDE.md` (regulile), apoi acest fișier.

**Scopul tău:** aduci backend-ul la ce descrie README-ul, în fazele de mai jos, fără să strici ce merge deja.

---

## 1. Starea în 30 de secunde

| Zonă | Stare |
|---|---|
| Backend Spring (`backend/`) | merge: motor de calcul, orchestrator cu SSE, uneltele agenților pentru **Irigații** și **Utilaje**, ANAF live. 73 de teste trec |
| Contracte (`contracts/`) | OpenAPI, scheme JSON pentru output-urile agenților, evenimente, fixtures; validate automat |
| Agenții Bedrock | **lipsesc.** Orice dosar se oprește la Agent 1 cu `BEDROCK_UNAVAILABLE` |
| Modul offline (rulări înregistrate) | **lipsește** |
| Categoriile 2, 4, 5, 6 | doar config, fără calculatoare, cataloage sau ferme demo |
| Logica nouă din README (dobânda pe componente, niveluri verzi, fonduri F1–F6, DSCR, TRIMIS, portofoliu) | **lipsește**: e Faza 1 și Faza 3 de mai jos |
| Frontend (`frontend/`) | ecranele statice ale Mirunei, aduse pe `B2B_Agro`; build-ul trece, dar sunt **neconectate la API** (Pista C) |

---

## 2. Git

- Lucrezi pe `B2B_Agro`. **Nu atinge `main`**: conține fișierele altei echipe, iar `feat/be-analytics` (proiect Python, Dominic) pornește din el.
- Pe `origin/B2B_Agro` sunt:
  - README-ul și deciziile lui Victor;
  - commit-ul cu backend-ul, contractele, config-ul și datele demo (`bd077eb`);
  - commit-ul cu docs-urile actualizate (`61abd28`);
  - merge-ul frontend-ului Mirunei din `frontend-personal` (`bfbb092`).
- **Frontend-ul** conține și aplicația Busola pentru persoane fizice, pe lângă fluxul agro. Miruna lucrează în continuare pe `frontend-personal`. Când aduci schimbările ei noi, la conflictul din `README.md` păstrezi versiunea `B2B_Agro`.
- Commit-uri mici, Conventional Commits, în engleză. Push doar cu testele verzi.

---

## 3. Pornire

Cerințe: **JDK 21**, Maven, Node 20.19+ (pentru `contracts/` și `frontend/`).

```bash
cd backend && mvn test                         # 73 de teste
cd backend && mvn spring-boot:run              # API pe http://localhost:8080
cd contracts && npm install && npm run check   # lint OpenAPI + scheme
cd contracts && npm run validate:samples       # răspunsurile reale ale backend-ului respectă contractul (după mvn test)
cd contracts && npm run mock                   # mock Prism pe :4010, pentru frontend
cd frontend && npm install && npm run dev      # ecranele pe http://localhost:5173
```

Verificare rapidă:

```bash
curl localhost:8080/api/modules
curl localhost:8080/api/farms/45871203
curl -X POST localhost:8080/api/runs/demo/irigatii
curl -N localhost:8080/api/runs/<runId>/events
```

Variabile de mediu (toate opționale):

| Variabilă | Ce face | Implicit |
|---|---|---|
| `GREENSTRUCT_ANALYSIS_DATE` | fixează „azi”, ca DR-12 să rămână deschis în ziua demo-ului | ziua curentă |
| `GREENSTRUCT_MODE` | `LIVE` / `HYBRID` / `REPLAY` (doar `HYBRID` are efect azi) | `HYBRID` |
| `GREENSTRUCT_ANAF_ENABLED` | `false` = fără apeluri la ANAF (demo offline) | `true` |
| `GREENSTRUCT_AGENT_MODEL_ID` / `GREENSTRUCT_EXTRACTION_MODEL_ID` | modelele Bedrock (inference profiles UE) | gol |

Credențialele AWS vin din profil sau din mediu, niciodată din cod.

---

## 4. Cum e construit backend-ul

Pachetul de bază: `backend/src/main/java/ro/greenstruct/agro/`.

| Pachet | Rol |
|---|---|
| `api/` | REST + SSE; erorile au formatul din contract (`ApiExceptionHandler`); `RunViewMapper` rezolvă cifrele pentru UI |
| `orchestration/` | mașina de stări `CREAT → DATE_FIRMA → AGENT_1 → AGENT_2 → AGENT_3 → GATA → APROBAT → MONITORIZARE` (+ `ESUAT`); `RunOrchestrator`; `events/SseHub` (buffer per dosar, reluare cu `Last-Event-ID` sau `?after=`) |
| `tools/` | uneltele pe care le cheamă agenții, grupate pe agent: `technical/`, `funding/`, `underwriting/`. `ToolRegistry.forAgent(slot)` dă subsetul fiecărui agent; `workspace/` ține starea de lucru a unui dosar |
| `engine/` | **motorul de calcul**: Java pur, `BigDecimal` (DECIMAL128), fără Spring. `finance/` (PMT, rate sezoniere, comparație), `funding/` (grant, cofinanțare, punte, de minimis), `irrigation/`, `machinery/`, `impact/`, `affordability/` |
| `modules/` | încarcă `config/modules/*.json` (`ModuleDefinition`) și `ReferenceData` (linii de finanțare, programe, factori, prețuri) |
| `external/` | porturile `CompanyRegistryPort`, `FarmRegistryPort`, `OpenBankingPort`; `anaf/` (live), `mock/` (fermele demo din `data/demo/farms/`) |
| `farm/` | `FarmProfileService.get(cui)`: firmă + fermă + parcele + cashflow + surse |
| `storage/` | documentele încărcate, pe disc local |
| `demo/` | `DemoScenarioService`: dosarele demo din `data/demo/scenarios/` |

### Regulile care țin sistemul corect

1. **AI-ul nu calculează.** Fiecare cifră e un `Calc` cu `calcId` = `"calc_"` + primele 12 caractere din sha256(run | unealtă | cheie | valoare rotunjită). Agenții referă cifrele doar prin `calcId`; backend-ul le rezolvă și verifică că există.
2. **Nicio constantă în cod.** Pragurile, dobânzile, factorii și prețurile stau în `config/`, fiecare cu `sourceRo`. Catalogul de upgrade-uri stă în `data/catalog/`.
3. **Contract-first.** Orice schimbare de format începe în `contracts/`:
   - `openapi.yaml`;
   - `schemas/submit_*.json`, care sunt și schemele uneltelor `submit_*` pentru Bedrock;
   - `events.md`;
   - fixtures.

   Apoi rulezi `npm run check` și `npm run validate:samples`. `ContractSamplesTest` scrie răspunsuri reale în `backend/target/contract-samples`.
4. **Fiecare formulă din motor are test JUnit** cu valori calculate independent (de mână sau în Excel). `ToolChainTest` verifică paritatea cap-coadă pe ambele scenarii demo.

### Agenții (ce unelte au deja)

| Agent | Unelte | Final |
|---|---|---|
| 1. Auditor tehnic | `get_module_rules`, `extract_document`, `compute_baseline`, `compute_indicator`, `search_upgrades`, `simulate_upgrade_package`, `check_dnsh_inputs` | `submit_technical_assessment` |
| 2. Finanțare | `list_financing_lines`, `check_program_eligibility`, `build_funding_stack`, `build_scenario`, `compare_scenarios`, `check_affordability` | `submit_funding_recommendation` |
| 3. Underwriter | `get_labeling_rules`, `get_dnsh_criteria`, `calculate_impact` | `submit_underwriting_report` |

---

## 5. Ce e deja făcut (nu reface)

- **Irigații:**
  - indicator = economia de apă;
  - căutarea celui mai ieftin pachet de upgrade-uri care trece pragul;
  - pompă solară;
  - contor de apă cerut de DNSH.
- **Utilaje:**
  - economia de motorină din vechimea tractoarelor, cu consumul specific pe benzi de vechime: 246 / 252 / 265 / 280 g/kWh;
  - ponderea flotei înlocuite (o extindere fără înlocuire = economie 0);
  - pachetul de precizie;
  - alternativa „tractoare noi Stage V”;
  - verificarea puterii totale pe hectar.
- **Second-hand:**
  - DR-12 refuză utilajele second-hand;
  - utilajul trebuie să aibă cel mult 12 ani la ultima rată;
  - tractoarele diesel second-hand nu primesc etichetă verde.
- **Finanțare:**
  - variantele A/B;
  - grant DR-12 + cofinanțare + punte;
  - garanțiile FEI InvestEU și FGCR;
  - rate sezoniere: aceeași valoare actualizată ca anuitatea, plătite doar în lunile cu încasări;
  - testul de capacitate de plată (40% din cashflow);
  - durata aleasă de fermier (`loan_term`).
- **ANAF live:** identitate, CAEN, TVA, stare fiscală și bilanț.
  - Firmele inactive sau radiate sunt refuzate cu motivul.
  - Răspunsurile se țin în cache 12 ore; dacă ANAF pică, se folosește ultimul răspuns.
  - Fermele demo nu ajung la ANAF.
  - Managerul (vârstă, instalare) nu vine de la ANAF: e la ONRC, care nu are API public. Rămâne `null` și devine condiție „de confirmat din extrasul ONRC”.
- **API-ul complet din contract:** module, ferme, dosare (multipart), dosare demo, SSE, aprobare, cerere de documente, health Bedrock.

---

## 6. Ce trebuie implementat

Ordinea contează: Faza 1 schimbă contractele și formulele de care depind celelalte. **Pista B** (agenții) poate merge în paralel cu Faza 1, cu altă persoană.

### Faza 1: logica din README pe Irigații și Utilaje

Rezultatul fazei: cele două scenarii demo dau exact cifrele și pașii din README §4 și §6.

**1.1 Contractele (primele)**
- `openapi.yaml`:
  - starea `TRIMIS` între `GATA` și `APROBAT` (README: „OFERTE GATA → TRIMIS → APROBAT”);
  - `POST /api/runs/{id}/submit` cu `{ "variant": "CLASIC" | "VERDE" }`;
  - pe `Company`: `totalAssetsEur` și `smeStatus`; `manager` devine opțional; `turnoverEur` acceptă `null`;
  - o vedere pentru IMM fără fonduri: `GET /api/runs/{id}?view=sme`, sau un câmp separat. README §13: „IMM-ul nu vede fondurile”.
- `schemas/submit_funding_recommendation.json`:
  - variantele `CLASIC` / `VERDE` în locul lui A/B, sau o mapare clară între ele;
  - descompunerea dobânzii (calcId-uri pe componente);
  - nivelul verde;
  - DSCR-ul;
  - avantajul net.
- `schemas/submit_underwriting_report.json`:
  - fondul propus (F1–F6);
  - cerințele fondului bifate (§3.2);
  - categoria din cadrul obligațiunilor verzi (§3.3);
  - datele lipsă transformate în condiții înainte de tragere.
- `events.md` și fixtures: regenerezi cu `tools/gen-fixtures.mjs`.
- `examples/modules.json` nu are întrebările noi (din cauza asta mock-ul Prism diferă de `/api/modules`). Actualizează-l.
- **Limită:** cel mult 15 întrebări per modul (o impune contractul).

**1.2 Config**
- `config/pricing.json` (nou), cu valorile ilustrative din README §4, pasul 6, marcate `demo: true`:
  - indicele EURIBOR 3M;
  - PD clasic / verde, LGD;
  - RW client, RW FEI = 0, rata de capital, costul capitalului;
  - diferența de cost de finanțare, diferența de cost operațional, subvenția de program, profitul țintă;
  - reducerea pe fiecare nivel verde;
  - bonusul de impact (−0,25 pp).
- `config/funds.json` (nou), cu F1–F6:
  - cerințele fiecăruia (§3.2);
  - fondul principal și alternativele pe modul (§3.3);
  - categoria F2 pe modul;
  - procentul garanției FEI (70%);
  - sursa fiecărei valori.

  Legătura cu ce există:
  - F1 = actuala garanție `eif.investeu.sustainability` din `financing-lines.json`;
  - F6 = programele AFIR din `funding-programs.json`, care rămân.
- `config/factors.json`: aliniază la README:
  - motorină 2,68 kg/l (acum 2,66);
  - rețea 0,26 t/MWh (acum 0,23);
  - adaugă gaz 0,20 t/MWh, azot 4,29 kg CO₂e/kg N, metan GWP 27, pompare 0,002725 kWh/(m³·m).
- Fișierele rămân cu numele lor actuale. Actualizează în README §14 căile `config/constants.json` → `config/factors.json` și `backend/src/categories/*.json` → `config/modules/*.json`.
- `config/modules/irigatii.json`:
  - eficiențele: brazde 0,60, aspersie 0,75, picurare 0,90;
  - senzorii: −10%;
  - Kc pe cultură, ET₀ și ploaia efectivă pe zonă, H_presiune pe sistem, η pompă;
  - întrebări noi: sursa apei, adâncimea sau înălțimea de pompare;
  - pragul pentru ferme care încep să irige: η ≥ 0,85, autorizație ANAR, fără stres hidric sever.
- `config/modules/utilaje.json`:
  - prag ≥ 20% la motorină **sau** la azot pe hectar;
  - motor Stage V obligatoriu;
  - durata implicită **5 ani** (README §13). Întrebarea `loan_term` rămâne, cu `ANI_5` implicit.
- Grația până la prima recoltă, maximum 12 luni, configurată pe modul. Acum e `firstInstallmentOffsetMonths: 4`, fix.

**1.3 Motorul de calcul** (fiecare cu teste pe valori calculate de mână)
- `engine/pricing/` (nou):
  - `Marja = finanțare + PD × LGD × (1 − g) + RW_efectiv × rata de capital × costul capitalului + operațional + profit`;
  - `RW_efectiv = RW_client × (1 − g) + RW_FEI × g`;
  - dobânda = indice + marjă;
  - testul: exemplul din README, unde 8,9% devine ~6,3% (−1,01 pp risc, −0,76 pp capital, −0,30 pp finanțare, −0,15 pp operațional, −0,40 pp subvenție).
- Nivelul verde, după README §4, pasul 8:
  - **Verde Plus:** indicatorul ≥ prag × 1,5 și DNSH complet;
  - **Verde:** prag atins, DNSH OK sau cu condiții;
  - **Verde cu upgrade:** investiția cerută era sub prag, iar upgrade-ul e acceptat;
  - **Clasic:** sub prag, fără upgrade.
- DSCR = `(cashflow operațional anual + economii anuale) / (rate + dobânzi pe an)`. Limita de 40% rămâne ca test suplimentar.
- Avantajul net = `(economii − plăți − costuri)_verde − (economii − plăți − costuri)_clasic`. Costul ipotecii intră doar la clasic.
- Recuperarea upgrade-ului = `cost upgrade / economie lunară suplimentară`.
- Irigații:
  - `NIR = Σ max(0, Kc × ET₀ − P_ef) × 10 × ha`;
  - `V_vechi = NIR / η_vechi`;
  - `V_nou = NIR × (1 − s) / η_nou`;
  - energia de pompare = `V × (H_ridicare + H_presiune) × 0,002725 / η_pompă`;
  - CO₂ din kWh × 0,26 / 1000.
  - Înlocuiește necesarul fix de 3.800 m³/ha și kWh/m³ fix.
- Utilaje:
  - `l/ha` de acum, din facturile de motorină / hectarele lucrate. Benzile pe vechime rămân estimarea când lipsesc facturile;
  - reducerea de azot = `kgN/ha × reducerea dozării`;
  - CO₂e = `(Δl × 2,68 + ΔkgN × 4,29) / 1000`.
- Statutul de IMM:
  - în `external/anaf/AnafCompanyMapper`, activele totale din bilanț = active imobilizate + circulante + cheltuieli în avans;
  - IMM = < 250 de angajați și (cifră de afaceri ≤ 50 mil. EUR sau active ≤ 43 mil. EUR).

**1.4 Uneltele agenților**
- Agentul 2 primește unelte noi:
  - `price_loan` (descompunerea dobânzii, clasic și verde);
  - `determine_green_tier`;
  - `compute_dscr`.
- `build_scenario` construiește:
  - **clasicul:** investiția cerută, linia standard, ipotecă, rate egale;
  - **verdele:** investiția verde, garanția F1 în locul ipotecii, grație până la recoltă, rate după încasări.
- `compare_scenarios`: avantajul net cu formula de mai sus.
- Agentul 3 primește unelte noi:
  - `select_fund`;
  - `check_fund_requirements` (bifează §3.2);
  - `get_bond_category`.

  `get_labeling_rules` rămâne doar pentru tabelul ofițerului.
- Agentul 1: `compute_baseline` și `compute_indicator` cu noile formule. Datele lipsă devin condiții, nu motive de respingere (README §5.3).

**1.5 Orchestrator și API**
- `RunStatus.TRIMIS`;
- `POST /submit` (doar din `GATA`);
- `approve` doar din `TRIMIS`;
- vederea IMM fără fonduri în `RunViewMapper`.

**1.6 Datele demo**
- Ferma de legume `45871203`:
  - irigă acum prin **brazde** (azi e `ASPERSIE_VECHE`);
  - cere aspersie clasică: 20%, sub prag;
  - picurarea dă 33%;
  - picurare + senzori dă 40% = Verde Plus.
- Actualizează `data/demo/scenarios/irigatii.json`, `data/catalog/irigatii.json`, `contracts/examples/*` și cifrele așteptate din `ToolChainTest`. Recalculează-le independent; nu copia ce dă codul.

### Faza 2: categoriile 2, 4, 5, 6

Pentru fiecare: calculator în `engine/`, catalog în `data/catalog/<modul>.json`, fermă demo în `data/demo/farms/` (CUI numeric fictiv, verificat că **nu** există la ANAF), scenariu în `data/demo/scenarios/`, `demoReady: true` în config. Uneltele aleg calculatorul după `module.calculator()`.

| Modul | Calcul (README §6) | Moment de îndrumare (README §13) | Fond |
|---|---|---|---|
| `energie` | producție `kWp × producția specifică`; autoconsum lunar `Σ min(E_lună, consum_lună)`; energie vândută; acoperire; pompă solară în locul motorinei | eligibil direct; arată **redimensionarea** | F1 |
| `zootehnie` | CH₄ = capete × EF (IPCC Tier 1, pe specie și stocare); reducerea din catalog; CO₂e cu GWP 27; kWh din biogaz; azot din digestat | sub prag → upgrade; prag ≥ 50% + valorificarea gunoiului | F1 |
| `post_recolta` | `I = kWh / tone (sau m²)`; economie ≥ 20%; curent și gaz separat; agent frigorific cu GWP redus (DNSH) | sub prag → upgrade | F1 |
| `ecologic` | venit pe anii de conversie, venit după certificare, subvenții, **golul de lichiditate** lunar, ha certificate, azot evitat | **conversie etapizată**; golul dimensionează grația și linia F5 | F3 + F5 |

Ferma ecologică nu are economii de energie. Riscul ei e lichiditatea, deci rata și grația se calculează din golul lunar.

### Faza 3: după acordare și portofoliu

- `GET /api/portfolio`: credite verzi pe categorii, sume pe fiecare fond, impactul total (t CO₂, MWh, m³).
- „Simulează 12 luni” (zona ofițer):
  - date de monitorizare simulate;
  - impactul real față de cel estimat;
  - bonusul de impact (−0,25 pp) dacă se confirmă;
  - actualizarea portofoliului.
- Raportul PDF, generat la „Aprobă” (README §8): decizie, nivel verde, prag, DNSH, fond, cerințe, categorie F2, condiții, riscuri. Ca bibliotecă Java: OpenPDF sau openhtmltopdf.
- Dovezile după acordare (README §5.3): factura la tragere, procesul-verbal + poze geolocalizate, indicatorul real la 12 luni.

### Pista B (în paralel): agenții Bedrock și modul offline

Fără ea, niciun dosar nu trece de Agent 1.

- **AWS:**
  - echipa are o **cheie Bedrock pe termen scurt**, pe regiunea `us-west-2` (12 ore). O pui în `.env` la rădăcina repo-ului, după `.env.example`; backend-ul o citește la pornire;
  - modelele verificate cu cheia: `us.anthropic.claude-sonnet-5-5` pentru agenți și `us.anthropic.claude-haiku-5-5` pentru extracție (Converse, 28.10.2026);
  - regiunea e US: doar date demo fictive. Pentru o regiune UE e nevoie de altă cheie și de profilurile `eu.*`;
  - AWS SDK v2 citește cheia din variabila `AWS_BEARER_TOKEN_BEDROCK`. Spring o încarcă doar ca proprietate, deci clientul Bedrock trebuie să o primească explicit (token provider), ca să meargă și din `.env`.
- **Cod:**
  - dependența AWS SDK v2 `bedrockruntime`;
  - `bedrock/BedrockGateway` + `ToolLoop` (Converse, max. 8 iterații, se termină la `submit_*`, eroarea de schemă se trimite înapoi agentului);
  - cele 3 implementări `orchestration.Agent`, cu prompturi în `resources/prompts/`, unelte din `ToolRegistry.forAgent` și schemele `submit_*` din `contracts/schemas/`;
  - o implementare de `tools.technical.DocumentExtractor` (citirea PDF-urilor);
  - o implementare de `api.BedrockHealthProbe`.
- **Planul B** (README §11): reîncercare + model de rezervă → cache (aceleași documente, după hash) → rulare înregistrată în `data/demo/golden/` (modul `REPLAY`).
  - Se reiau **deciziile** agentului (unelte + input-uri); cifrele se recalculează live din motor.
  - Fără chei AWS, aplicația pornește direct în `REPLAY`.
- **PDF-urile demo:** `data/demo/docs/README.md` listează numele cerute de scenarii. README §13 cere să fie generate de un script din aceleași JSON-uri ca mock-urile.

### Pista C: frontend conectat la API

- Ecranele Mirunei citesc azi date fictive locale. Trebuie legate la:
  - `GET /api/farms/{cui}`;
  - `GET /api/modules`;
  - `POST /api/runs`;
  - `EventSource` pe `/api/runs/{id}/events?after=`;
  - `GET /api/runs/{id}`.
- Pentru dezvoltare: proxy Vite `/api → http://localhost:8080`. CORS permite deja `localhost:5173`.
- Tipurile TypeScript se generează din `contracts/schemas` (`json-schema-to-typescript`). Până merg agenții, frontend-ul poate lucra pe mock-ul Prism.

---

## 7. Decizii luate (aplică-le, nu le rediscuta fără motiv)

| Decizie | Detaliu |
|---|---|
| README-ul lui Victor are prioritate la produs | stack-ul rămâne Spring + `contracts/` (nu Node + zod); README §11 descrie deja asta |
| Utilaje: 5 ani implicit | fermierul poate alege 3 / 5 / 7 ani |
| Grantul AFIR (DR-12) e alternativa F6 | propus doar dacă e eligibil; IMM-ul vede doar „Credit verde Raiffeisen” |
| Nivelurile verzi sunt decizia principală | etichetele Taxonomie / verde de piață / tranziție rămân doar în raportul ofițerului |
| Regulile second-hand rămân | fără grant, max. 12 ani la ultima rată, propunerea de tractoare noi |
| ANAF live, restul mock | APIA, ANSVSA, Open Banking, hărțile de risc rămân mock-uri cu interfața serviciului real |
| Un CUI real fără fermă APIA primește 404 cu mesaj clar | APIA cunoaște doar fermele demo. Alternativa (profil fără fermă, parcele introduse manual) cere schimbări în contract; încă nedecisă |

---

## 8. Capcane

- **Testele nu cheamă ANAF-ul real:** `backend/src/test/resources/config/application.yml` îl oprește. Testele ANAF folosesc `MockRestServiceServer`.
- **ANAF:**
  - răspunde la un CUI necunoscut cu **HTTP 404 și corp JSON** `{"found":[],"notFound":[…]}`, nu cu eroare;
  - permite o cerere pe secundă (`min-interval: 1s`);
  - dacă bilanțul pe anul trecut nu e depus încă, se ia anul dinainte;
  - un CUI fără date de bilanț întoarce `"i": []`.
- **CUI-urile demo** `45871203` și `38264019` sunt fictive și au fost verificate că nu există la ANAF. Orice fermă demo nouă trebuie verificată la fel.
- **Data analizei:** DR-12 e deschis până la 02.12.2026. Pentru demo, fixează `GREENSTRUCT_ANALYSIS_DATE`, altfel eligibilitatea depinde de ziua prezentării.
- **Paritatea din `ToolChainTest`:** cifrele așteptate sunt calculate independent. Când schimbi o formulă, recalculează-le de mână; nu le copia din output-ul codului.
- **Contractul are limite** (de ex. max. 15 întrebări per modul, `additionalProperties: false` peste tot). Rulează `npm run validate:samples` după `mvn test`.
- **`Path` din `@ConfigurationProperties`** se leagă greșit din jar; căile sunt `String`, cu metode care întorc `Path`.
- **Thread-uri virtuale:** folosește `ReentrantLock`, nu `synchronized`, în jurul operațiilor care blochează (vezi `AnafClient`).
- **Documentele de plan** (`PLAN_TEHNIC_SPRING.md`, `RESEARCH_FINANTARE_AGRI.md`) sunt în afara repo-ului, la Tudor. Cere-le sau mută-le în `docs/`.

---

## 9. Întrebări deschise pentru mentorii Raiffeisen

Lista completă e în README §14. Cele care blochează cifrele din Faza 1:

1. Pragurile verzi reale (25% apă, 20% motorină / azot / energie, 50% metan).
2. Procentul și comisionul garanției FEI InvestEU.
3. Parametrii dobânzii: PD, LGD, ponderi de risc, cost de finanțare.
4. Există încă eticheta F2 „Agriculture and forestry”, iar F4 (irigații cu FEI) mai e activ?
5. Banca finanțează cofinanțarea AFIR?

Până la răspuns, valorile din config rămân marcate `demo: true` și apar ca „parametri demo” la ofițer.

---

## 10. Gata înseamnă (README §12)

- [ ] Ferma de legume trece live prin cei 3 agenți, în ambele zone
- [ ] Se vede momentul *„sub prag → upgrade → peste prag”*
- [ ] Se vede **de ce** dobânda verde e mai mică (descompunerea pe componente)
- [ ] Raportul ofițerului are fondul, cerințele bifate, DNSH, impactul și condițiile
- [ ] Toate cele 6 ferme demo trec complet
- [ ] Toate cifrele vin din motor și au teste
- [ ] Demo-ul merge **fără internet** (`REPLAY` + `GREENSTRUCT_ANAF_ENABLED=false`)
