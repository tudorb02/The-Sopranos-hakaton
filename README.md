# 🌱 GreenStruct Agro

**Aplicație cu agenți AI care le oferă IMM-urilor din agricultură, pe lângă un credit clasic, un credit verde Raiffeisen cu dobândă mai mică și un plan prin care investiția lor devine verde.**

Proiect pentru hackathonul Raiffeisen Bank România: *„Provocare Deschisă: Agenți AI în Servicii Bancare”*.

> **Pe scurt**
> 1. Reprezentantul IMM-ului alege una din **6 categorii** de investiții agricole și dă **doar datele esențiale** pentru categoria lui.
> 2. Aplicația calculează **indicatorul verde** al investiției (apă, energie, motorină, metan sau hectare certificate) și îl compară cu **pragul verde**.
> 3. Dacă investiția e sub prag, aplicația îi arată **ce să schimbe** ca s-o facă verde.
> 4. IMM-ul primește **două variante**: **credit clasic** și **credit verde**, cu dobândă mai mică.
> 5. Ofițerul Raiffeisen primește un **dosar verde pre-verificat**, pe care banca îl poate finanța din **fondurile cu cerințe verzi** pe care le accesează (garanția FEI InvestEU, obligațiunile verzi cumpărate de BERD și IFC, Credit BIO).
>
> **Win-win:** IMM-ul plătește mai puțin și consumă mai puțin. Banca folosește banii și garanțiile verzi pe care le are, cu risc mai mic, și își atinge obiectivele de finanțare verde.

---

## Cuprins

1. [Problema și soluția](#1-problema-și-soluția)
2. [Structura aplicației](#2-structura-aplicației)
3. [Fondurile Raiffeisen cu cerințe verzi](#3-fondurile-raiffeisen-cu-cerințe-verzi)
4. [Cum calculăm creditul verde](#4-cum-calculăm-creditul-verde)
5. [Datele cerute de la orice IMM](#5-datele-cerute-de-la-orice-imm)
6. [Cele 6 categorii: ce cerem și ce calculăm](#6-cele-6-categorii-ce-cerem-și-ce-calculăm)
7. [Zona IMM: ce vede reprezentantul firmei](#7-zona-imm-ce-vede-reprezentantul-firmei)
8. [Zona ofițer: ce primește ofițerul Raiffeisen](#8-zona-ofițer-ce-primește-ofițerul-raiffeisen)
9. [Cum ajută banca: KPI-uri](#9-cum-ajută-banca-kpi-uri)
10. [Agenții AI](#10-agenții-ai)
11. [Arhitectura tehnică](#11-arhitectura-tehnică)
12. [Demo-ul](#12-demo-ul)
13. [Decizii pentru prototip](#13-decizii-pentru-prototip)
14. [Ipoteze de confirmat cu Raiffeisen](#14-ipoteze-de-confirmat-cu-raiffeisen)
15. [Surse](#15-surse)

---

## 1. Problema și soluția

### Problema

- **Raiffeisen are bani și garanții pentru credite verzi**, dar fiecare finanțator cere ca banca să **dovedească** pentru fiecare credit că investiția e verde și să **raporteze impactul** (vezi [§3](#3-fondurile-raiffeisen-cu-cerințe-verzi)).
- **Dovada se face manual**, prin analiză tehnică. Pe credite mici, pentru ferme mici, costă mai mult decât aduce, așa că multe credite care ar putea fi verzi rămân credite clasice, mai scumpe.
- **Fermierul nu are expertiză ESG.** Nu știe că ar putea primi dobândă mai mică, nici ce ar trebui să schimbe la investiție ca să fie eligibil.

### Soluția

GreenStruct Agro face automat analiza tehnică verde:

1. cere de la IMM **doar datele esențiale** pentru categoria lui și ia restul automat (ANAF, APIA, Open Banking, hărți);
2. **calculează** indicatorul verde al investiției, cu formule fixe, în cod;
3. dacă investiția e sub prag, **propune schimbarea** cea mai ieftină care o face verde;
4. construiește **creditul clasic** și **creditul verde** și arată diferența;
5. îi dă ofițerului un **dosar complet**: dovezi, impact și fondul pe care poate fi finanțat creditul;
6. **monitorizează** impactul după acordare, ca banca să-l poată raporta.

> **Regula de aur:** AI-ul citește documentele, alege pașii și scrie textele. **Toate cifrele le calculează codul** (motorul de calcul), niciodată AI-ul.

---

## 2. Structura aplicației

Aplicația are **două zone** care lucrează pe același dosar:

```
┌────────────────────────────┐          ┌────────────────────────────────┐
│        ZONA IMM            │          │       ZONA OFIȚER RAIFFEISEN   │
│  (reprezentantul firmei)   │          │                                │
│                            │          │                                │
│  1. CUI + 2 acorduri       │          │  • dosarul firmei + hartă      │
│  2. bifează parcelele      │          │  • pașii agenților, live       │
│  3. oferta → categoria     │          │  • calculele, cu sursa lor     │
│  4. documente esențiale    │          │  • clasic vs. verde            │
│  5. întrebări esențiale    │          │  • de ce dobânda e mai mică    │
│                            │          │  • raport verde + fond         │
│  6. vede: clasic vs. verde │          │  • Aprobă / Cere documente     │
│     + ce să schimbe        │          │                                │
└─────────────┬──────────────┘          └───────────────▲────────────────┘
              │                                         │
              ▼                                         │
┌───────────────────────────────────────────────────────┴────────────────┐
│                               BACKEND                                   │
│                                                                         │
│  AGENT 1  Auditor tehnic   → citește documentele, calculează indicatorul │
│                               verde, compară cu pragul, propune upgrade  │
│  AGENT 2  Structurare      → construiește creditul clasic și verde,     │
│                               calculează dobânda verde și ratele         │
│  AGENT 3  Underwriter      → DNSH, fondul potrivit, condiții, raport     │
│                                                                         │
│  MOTOR DE CALCUL (cod)     → toate formulele din acest document         │
│  DATE AUTOMATE             → ANAF (live) · APIA · ANSVSA · Open Banking  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxul unui dosar

| Pas | Ce se întâmplă | Unde se vede |
|---|---|---|
| 1 | IMM-ul introduce CUI-ul și dă acordul pentru APIA și Open Banking | zona IMM |
| 2 | Aplicația ia automat datele firmei, ale fermei și cashflow-ul | ambele zone |
| 3 | IMM-ul bifează parcelele și încarcă oferta (aplicația recunoaște singură categoria, 1–6), apoi restul documentelor, și răspunde la întrebări | zona IMM |
| 4 | **Agent 1** calculează indicatorul verde și îl compară cu pragul. Dacă e sub prag, propune upgrade-ul | ambele zone (live) |
| 5 | **Agent 2** construiește creditul clasic și creditul verde | ambele zone (live) |
| 6 | **Agent 3** verifică DNSH, alege fondul și scrie raportul | zona ofițer |
| 7 | IMM-ul vede cele două variante și ce trebuie să schimbe, apoi trimite cererea | zona IMM |
| 8 | Ofițerul aprobă sau cere documente | zona ofițer |
| 9 | După acordare: dovezile de implementare și impactul real la 12 luni | ambele zone |

---

## 3. Fondurile Raiffeisen cu cerințe verzi

Creditul verde e posibil pentru că Raiffeisen accesează **bani și garanții** care vin cu **cerințe verzi**. Fiecare credit verde din aplicație trebuie legat de una din aceste surse și trebuie să îndeplinească cerințele ei.

> ⚠️ Lista e construită din **surse publice** (vezi [§15](#15-surse)). Unele sunt mai vechi, iar **termenii actuali** (procentul de garanție, dobânzile, sumele disponibile, dacă un program mai e activ) **se confirmă cu Raiffeisen**. În aplicație, toate valorile stau în `config/funds.json`, nu în cod.

### 3.1 Sursele

| Cod | Sursa | Ce este (din surse publice) | Ce cere de la bancă | Ce primește IMM-ul |
|---|---|---|---|---|
| **F1** | **Garanția FEI InvestEU de sustenabilitate** (*Sustainability Guarantee*) | garanție de portofoliu de la Fondul European de Investiții. Raiffeisen a semnat-o în 2023, alături de alte 4 bănci din România (1 mld. EUR în total pentru cele 5; presa indică ~400 mil. EUR pentru cele două scheme Raiffeisen) | creditul finanțează o **investiție verde sau sustenabilă** (ex. energie regenerabilă, eficiență energetică); eligibilitatea trebuie documentată | potrivit FEI: **dobândă mai mică**, **garanții reduse** (deci fără ipotecă sau cu ipotecă mai mică), avans mai mic, maturitate mai lungă |
| **F2** | **Obligațiunile verzi și sustenabile Raiffeisen** | ~1 mld. EUR emise. Investitori printre care **BERD** (în prima obligațiune verde a băncii, 2021) și **IFC** (50,8 mil. EUR în 2023, inclusiv pentru *finanțare agricolă sustenabilă*) | banii se alocă **doar pe credite eligibile** din categoriile cadrului băncii: *Agriculture and forestry*, energie regenerabilă, eficiență energetică, transport curat, prevenirea poluării. Banca publică **rapoarte de alocare și de impact** | dobândă mai mică, pentru că banca are finanțare dedicată |
| **F3** | **Credit BIO** | produs Raiffeisen (din 2021) pentru teren **certificat ecologic sau în conversie**; banca l-a prezentat ca primul ei produs de creditare pentru IMM-uri care încurajează agricultura sustenabilă | certificare ecologică sau contract de conversie | condiții dedicate fermierilor bio |
| **F4** | **Finanțare pentru irigații cu FEI** (cu RWA Raiffeisen Agro) | finanțare pentru irigații, raportată la ~jumătate din costul standard, prin FEI (data și starea actuală nu sunt clare) | investiție în irigații | cost redus |
| **F5** | **Prefinanțarea subvențiilor APIA** | credit pe baza subvenției pe suprafață, cu analiză simplificată | cerere unică APIA | lichiditate până vine subvenția (nu e un fond verde, dar acoperă golurile de cashflow) |
| **F6** | **Granturi AFIR / PNS** (fonduri publice, nu ale băncii) | IMM-ul primește un grant nerambursabil, iar banca poate finanța **cofinanțarea** | contract de finanțare AFIR | o parte din investiție e acoperită de grant |

### 3.2 Ce cerințe acoperă aplicația, pentru fiecare fond

| Cerința | F1 FEI | F2 Obligațiuni | F3 Credit BIO | Cum o acoperă aplicația |
|---|:-:|:-:|:-:|---|
| Firma e **IMM** | ✅ | — | — | ANAF: angajați, cifră de afaceri, active |
| Investiția e într-o **categorie eligibilă** | ✅ | ✅ | ✅ | fiecare din cele 6 categorii e legată de o categorie a fondului |
| **Pragul tehnic** e atins, cu dovezi | ✅ | ✅ | — | motorul de calcul + documentele încărcate |
| Investiția **nu face rău mediului** (DNSH) | 🟡 | ✅ | — | hărți (Natura 2000, nitrați, stres hidric) + autorizații |
| **Impactul** e cuantificat (CO₂, MWh, m³) | ✅ | ✅ | 🟡 | motorul de calcul, pe fiecare credit |
| **Beneficiul** ajunge la client (dobândă, garanție) | ✅ | 🟡 | ✅ | comparația clasic vs. verde |
| **Raportare** periodică | ✅ | ✅ | 🟡 | monitorizarea la 12 luni + raportul de portofoliu |

✅ cerință clară · 🟡 probabilă, de confirmat · — nu se aplică

### 3.3 Ce fond se potrivește fiecărei categorii

| Categoria | Fond principal | Categoria din cadrul obligațiunilor verzi (F2) | Alternative |
|---|---|---|---|
| 💧 1. Irigații | F1 (sau F4, dacă e activ) | *Agriculture and forestry* | F6 |
| ☀️ 2. Energie la fermă | F1 | *Renewable energy* | F6 |
| 🚜 3. Utilaje & precizie | F1 | *Agriculture and forestry* / *Energy efficiency* | F6 |
| 🐄 4. Zootehnie & biogaz | F1 | *Renewable energy* / *Pollution prevention and control* | F6 |
| ❄️ 5. Post-recoltă | F1 | *Energy efficiency* | F6 |
| 🌱 6. Ecologic | F3 | *Agriculture and forestry* | F5 pentru lichiditate |

> Încadrarea pe categoriile F2 e propunerea noastră, după denumirile categoriilor din cadrul public al băncii. Încadrarea finală o face banca.

---

## 4. Cum calculăm creditul verde

Același proces pentru toate cele 6 categorii. Se schimbă doar **datele, formula indicatorului și pragul** (vezi [§6](#6-cele-6-categorii-ce-cerem-și-ce-calculăm)).

### Pasul 1 — Strângem datele
Automat (§5) + datele esențiale ale categoriei (§6).

### Pasul 2 — Calculăm indicatorul verde al investiției cerute
Fiecare categorie are **un indicator principal** (ex. % apă economisită) calculat cu formula categoriei.

### Pasul 3 — Îl comparăm cu pragul verde

| Rezultat | Ce urmează |
|---|---|
| **Peste prag** | investiția e verde așa cum e, deci trecem la pasul 5 |
| **Sub prag** | pasul 4: îl îndrumăm ce să schimbe |

### Pasul 4 — Îl îndrumăm ce să schimbe (re-ingineria investiției)
Aplicația caută în **catalogul de upgrade-uri** al categoriei (`data/catalog/<categorie>.json`) **cea mai ieftină combinație** care duce indicatorul peste prag. Recalculează indicatorul cu aceeași formulă și arată:
- **ce** să adauge sau să schimbe;
- **cât costă în plus**;
- **cu cât crește** indicatorul;
- **în cât timp** se recuperează costul suplimentar din economii: `cost upgrade / economie lunară suplimentară`.

### Pasul 5 — Construim cele două variante

| | **Credit clasic** | **Credit verde** |
|---|---|---|
| Investiția | cea cerută inițial | cea verde (inițială sau cu upgrade) |
| Sursa banilor | resurse obișnuite ale băncii | fondul potrivit (§3.3) |
| Garanție | de regulă ipotecă | garanția FEI (F1) în locul ipotecii sau alături de o ipotecă mai mică |
| Dobândă | `indice + marja clasică` | `indice + marja verde` (pasul 6) |
| Rambursare | rate lunare egale | **rate după calendarul încasărilor** (pasul 7) |
| Economii | cele ale investiției inițiale | cele ale investiției verzi (mai mari) |

### Pasul 6 — Calculăm dobânda verde

Dobânda verde e mai mică **pentru că, pentru bancă, creditul verde costă mai puțin.** Calculăm marja pe componente:

```
Dobânda = Indice (ROBOR 3M pentru lei / EURIBOR 3M pentru euro) + Marja

Marja = Cost de finanțare
      + Cost de risc       = PD × LGD × (1 − g)
      + Cost de capital    = RW_efectiv × rata de capital × costul capitalului
      + Cost operațional
      + Profit țintă
```

`PD` = probabilitatea ca firma să nu plătească · `LGD` = cât pierde banca dacă nu plătește · `g` = procentul acoperit de garanția FEI · `RW` = ponderea de risc

| Componentă | De ce e mai mică la creditul verde | Fondul care o produce |
|---|---|---|
| **Cost de finanțare** | banca finanțează creditul din obligațiuni verzi, cumpărate inclusiv de BERD și IFC | F2 |
| **Cost de risc — garanție** | FEI acoperă partea `g`, deci banca pierde mai puțin dacă firma nu plătește | F1 |
| **Cost de risc — client** | economiile de apă, energie sau motorină cresc banii disponibili pentru rată, deci DSCR-ul e mai bun și PD-ul mai mic | toate |
| **Cost de capital** | pe partea garantată, banca folosește ponderea de risc a garantului: `RW_efectiv = RW_client × (1 − g) + RW_FEI × g`. FEI e bancă multilaterală de dezvoltare cu pondere de risc 0% | F1 |
| **Cost operațional** | analiza tehnică e automată, nu manuală | aplicația |

**Exemplu ilustrativ.** Parametrii sunt aleși doar ca să arate mecanismul. Banca își pune parametrii reali în `config/pricing.json`.

| Componentă | Clasic | Verde | Diferență |
|---|---|---|---|
| Cost de risc: PD 3% → 2,5%, LGD 45%, garanție `g` = 70% | 3% × 45% = **1,35%** | 2,5% × 45% × 30% = **0,34%** | **−1,01 pp** |
| Cost de capital: RW 75%, rată de capital 12%, cost 12% | 75% × 12% × 12% = **1,08%** | 22,5% × 12% × 12% = **0,32%** | **−0,76 pp** |
| Cost de finanțare (finanțare verde dedicată) | | | **−0,30 pp** |
| Cost operațional (analiză automată) | | | **−0,15 pp** |
| Subvenție sau comision redus pe program (dacă există) | | | **−0,40 pp** |
| **Total** | | | **≈ −2,6 pp** |

Cu acești parametri, un credit clasic de **8,9%** devine un credit verde de **~6,3%**.

> **Propunere de produs (nu e un produs Raiffeisen existent):** *bonus de impact*. Dacă la 12 luni impactul real confirmă estimarea, marja mai scade o treaptă (ex. −0,25 pp). Așa banca are date de impact măsurate pentru raportarea obligațiunilor verzi, iar clientul e motivat să folosească investiția corect.

### Pasul 7 — Calculăm ratele și capacitatea de plată

| Calcul | Formula |
|---|---|
| Rata lunară (anuitate) | `PMT = P × r / (1 − (1 + r)^−n)`, cu `r = dobânda anuală / 12` și `n` = numărul de luni |
| Rate după calendarul încasărilor | perioadă de grație (doar dobândă) până la prima recoltă după investiție, apoi plăți concentrate în lunile cu încasări (detectate din Open Banking), cu **aceeași valoare actualizată** ca anuitatea |
| Economii lunare | `cantitatea economisită × prețul` (apă, kWh, litri, kg N) |
| Costul ipotecii (doar la creditul clasic) | `evaluare + notar + înscriere + asigurare anuală × ani` (config) |
| **DSCR** | `(cashflow operațional anual + economii anuale) / (rate + dobânzi pe an)` |
| **Avantajul net al creditului verde** pe toată durata | `(economii − plăți − costuri)_verde − (economii − plăți − costuri)_clasic` |

### Pasul 8 — Stabilim nivelul verde și recomandarea

| Nivel | Când | Ce primește IMM-ul |
|---|---|---|
| 🌳 **Verde Plus** | indicatorul depășește pragul cu ≥ 50% din prag (ex. 38% la un prag de 25%) și DNSH e complet | reducerea maximă de dobândă |
| 🌿 **Verde** | pragul e atins, iar DNSH e OK sau are condiții înainte de tragere | reducerea standard |
| 🌱 **Verde cu upgrade** | investiția cerută era sub prag, iar IMM-ul acceptă upgrade-ul propus | reducerea standard, pe investiția cu upgrade |
| ⚪ **Clasic** | sub prag, fără upgrade acceptat | doar creditul clasic, plus recomandarea de upgrade |

Creditul verde e **recomandat** doar dacă e eligibil **și** avantajul net e pozitiv.

---

## 5. Datele cerute de la orice IMM

### 5.1 Automat (IMM-ul doar confirmă)

| Ce | De unde | Ce aflăm | La ce folosește |
|---|---|---|---|
| **CUI** | ANAF / ONRC (date publice) | CAEN, angajați, cifră de afaceri, active, bilanț | statutul de IMM (F1), riscul de credit |
| **Acord APIA** | cererea unică de plată | parcele (pe hartă), hectare, culturi pe ultimii 3 ani, subvenții | suprafețe și culturi pentru calcule, localizare, venituri stabile |
| **Acord Open Banking** | contul bancar | încasări și plăți pe 12–24 luni | capacitatea de plată, **calendarul ratelor** |
| **Locația parcelelor** | hărți publice (Copernicus, Natura 2000, zone vulnerabile la nitrați, stres hidric) și date climatice | risc de secetă, grindină, inundații, zone protejate, evapotranspirație și ploi | **DNSH**, risc climatic, calculul apei |

### 5.2 Ce dă IMM-ul pentru orice categorie

| # | Ce | De ce e esențial |
|---|---|---|
| 1 | **Oferta / proforma + fișa tehnică** a investiției | prețul (suma creditului) și parametrii tehnici din care calculăm indicatorul |
| 2 | **Parcelele / locul investiției** (bifate pe hartă) | localizarea, DNSH și monitorizarea |
| 3 | **Ce faceți cu echipamentul vechi?** (reciclare autorizată / vânzare / păstrare) | DNSH: economie circulară |

### 5.3 După acordare (pentru orice categorie)

| Când | Ce | De ce |
|---|---|---|
| La tragere | factura finală, conformă cu investiția aprobată (inclusiv upgrade-ul) | dovada că s-a cumpărat investiția verde |
| După instalare | procesul-verbal de punere în funcțiune + poze geolocalizate | dovada că funcționează |
| La 12 luni | indicatorul real al categoriei | raportarea impactului către fonduri |

> Orice informație care lipsește devine **condiție înainte de tragere**, nu motiv de respingere.

---

## 6. Cele 6 categorii: ce cerem și ce calculăm

Pentru fiecare categorie:
- **A. Ce cerem**, în plus față de §5: ✅ esențial (fără el nu putem calcula) · ⚪ opțional (îmbunătățește precizia)
- **B. Ce calculăm**, pas cu pas
- **C. Pragul verde**
- **D. Cum îl îndrumăm** (upgrade-uri)
- **E. Creditul verde**: fondul și cerința pe care o acoperim
- **F. Ce câștigă banca**

**Constante comune** (`config/factors.json`, valori de pornire, de confirmat):

| Constantă | Valoare | Ce înseamnă |
|---|---|---|
| Factor de emisie, rețeaua electrică RO | 0,26 t CO₂ / MWh | de înlocuit cu valoarea folosită de bancă |
| Factor de emisie, gaz natural | 0,20 t CO₂ / MWh | ardere |
| Motorină | 2,68 kg CO₂ / litru | ardere |
| Îngrășământ cu azot | 4,29 kg CO₂e / kg N | emisii directe de N₂O: 1% din N aplicat (IPCC) × 44/28 × 273 (GWP N₂O) |
| Metan | GWP = 27 | IPCC AR6 |
| Energie de pompare | 0,002725 kWh / (m³ · m) | `ρ × g / 3.600.000` |

---

### 💧 Categoria 1 — Irigații

*Ferme de legume sau de culturi de câmp care irigă prin brazde sau aspersie clasică, sau care încep să irige.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | Sistemul de irigare actual (brazde / aspersie / niciunul) | întrebare | eficiența de bază |
| ✅ | Sursa apei (puț / râu / canal / rețea) și adâncimea sau înălțimea de pompare (m) | întrebare | energia de pompare |
| ✅ | Culturile și hectarele irigate | automat din APIA, confirmat | nevoia de apă |
| ✅ | **Autorizația de gospodărire a apelor** (ANAR) | document | legalitatea și DNSH-ul pentru apă |
| ⚪ | Consumul real de apă (contor) sau facturile de energie pentru pompare | document | verificarea estimării |

**B. Ce calculăm**

| # | Calcul | Formula |
|---|---|---|
| 1 | Nevoia netă de apă a culturilor (m³/an) | `NIR = Σ max(0, Kc × ET₀ − P_ef) × 10 × ha` (Kc pe cultură; ET₀ și ploaia efectivă P_ef, în mm, pe locație; 1 mm pe 1 ha = 10 m³) |
| 2 | Apa extrasă cu sistemul actual | `V_vechi = NIR / η_vechi` |
| 3 | Apa extrasă cu sistemul nou | `V_nou = NIR × (1 − s) / η_nou` (s = reducerea prin senzori de umiditate, 0 fără senzori) |
| 4 | **Economia de apă (indicatorul verde)** | `1 − V_nou / V_vechi` |
| 5 | Energia de pompare | `kWh = V × (H_ridicare + H_presiune) × 0,002725 / η_pompă` (H_presiune depinde de sistem, din config) |
| 6 | Economie în EUR / an | `(V_vechi − V_nou) × preț_apă + (kWh_vechi − kWh_nou) × preț_energie` |
| 7 | CO₂ evitat (t/an) | `(kWh_vechi − kWh_nou) / 1000 × 0,26` |

Eficiențe de pornire (config): brazde η = 0,60 · aspersie η = 0,75 · picurare η = 0,90 · senzori s = 10%.

**C. Pragul verde:** economie de apă **≥ 25%** față de sistemul actual. Pentru o fermă care începe să irige: sistem cu η ≥ 0,85, autorizație ANAR și fără stres hidric sever în zonă.

**D. Cum îl îndrumăm**

| Investiția | Economie de apă față de brazde | Rezultat |
|---|---|---|
| Aspersie clasică (cerută de IMM) | `1 − 0,60 / 0,75` = **20%** | ❌ sub prag |
| Picurare | `1 − 0,60 / 0,90` = **33%** | ✅ Verde |
| Picurare + senzori de umiditate | `1 − (1 − 0,10) × 0,60 / 0,90` = **40%** | ✅ Verde Plus (≥ 37,5%) |

Alte upgrade-uri din catalog: programare automată · pompă cu variator de turație · pompă solară (vezi categoria 2).

**E. Creditul verde:** **F1** (sau **F4**, dacă e activ). Acoperă cerința *investiție verde, cu impact cuantificat* (m³ apă, MWh). Eligibil în categoria *Agriculture and forestry* (**F2**). Rate cu grație până la prima recoltă irigată.

**F. Ce câștigă banca:** recolta irigată eficient e mai puțin expusă la secetă, deci veniturile sunt mai stabile și riscul de credit mai mic. Banca raportează m³ de apă economisiți, MWh și t CO₂ evitate.

---

### ☀️ Categoria 2 — Energie la fermă (panouri fotovoltaice, pompe solare, agrivoltaic)

*Ferme cu facturi mari la energie: pompare, depozite, ferme de animale.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | **Facturile de energie pe ultimele 12 luni** | document | consumul lunar, prețul plătit |
| ✅ | Locul montajului (acoperiș / teren) și suprafața disponibilă | întrebare | dimensionarea, DNSH |
| ✅ | Pompă solară: câți litri de motorină consumă pompa actuală pe an | întrebare | economia la diesel |
| ✅ | Ce parte din consum e ziua (aproximativ, ex. 55%) | întrebare | energia consumată direct din panouri |
| ⚪ | Avizul de racordare | document | dacă se vinde energie în rețea |

**B. Ce calculăm**

| # | Calcul | Formula |
|---|---|---|
| 1 | Producția anuală (kWh) | `E = kWp × producția specifică a zonei` (kWh/kWp/an, din config pe regiune) |
| 2 | Energia consumată direct | `E_auto = Σ_lună min(E_lună, consum_lună × pondere_zi)` (profilul lunar de producție, facturile lunare și ponderea consumului de zi, pentru că panourile produc doar ziua) |
| 3 | Energia vândută | `E_vândut = E − E_auto` |
| 4 | **Indicatorul verde** | `MWh regenerabili / an = E / 1000` și **gradul de acoperire** `E_auto / consum_anual` |
| 5 | Economie în EUR / an | `E_auto × preț_cumpărare + E_vândut × preț_vânzare` |
| 6 | CO₂ evitat (t/an) | `E / 1000 × 0,26` |
| 7 | Pompă solară în loc de diesel | `litri evitați × preț_motorină` și `litri × 2,68 / 1000` t CO₂ |

**C. Pragul verde:** **eligibil prin natura investiției** (energie regenerabilă). Verificăm doar: echipamente certificate, nu e în zonă Natura 2000 fără aviz și nu ocupă teren agricol productiv (acoperiș, teren neproductiv sau agrivoltaic).

**D. Cum îl îndrumăm:** dimensionare după consumul real (o instalație supradimensionată vinde ieftin în rețea) · baterie pentru pompare seara · invertor hibrid.

**E. Creditul verde:** **F1**. Acoperă cerința *energie regenerabilă* (exemplul dat explicit de FEI pentru garanția de sustenabilitate). Eligibil în categoria *Renewable energy* (**F2**).

**F. Ce câștigă banca:** economiile sunt foarte previzibile (producția solară variază puțin de la an la an), deci DSCR-ul e stabil. Banca raportează MWh regenerabili și t CO₂ evitate.

---

### 🚜 Categoria 3 — Utilaje & agricultură de precizie

*Ferme de culturi de câmp care înlocuiesc un tractor sau o combină, ori adaugă GPS, dozare variabilă sau semănătoare no-till.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | **Facturile de motorină pe ultimele 12 luni** | document | litri pe an |
| ✅ | Hectarele lucrate pe an | automat din APIA, confirmat | litri pe hectar |
| ✅ | Utilajul înlocuit: an de fabricație, putere | întrebare (sau talon) | situația de bază |
| ✅ dacă investiția e de precizie | **Facturile de îngrășăminte cu azot pe 12 luni** | document | kg N pe hectar |
| ⚪ | Metoda de lucru a solului (arătură / minimă / no-till) | întrebare | consumul de bază pe lucrări |

**B. Ce calculăm**

| # | Calcul | Formula |
|---|---|---|
| 1 | Motorină pe hectar acum | `l_ha_vechi = litri_pe_an / ha_lucrate` |
| 2 | Motorină pe hectar după | `l_ha_nou` din fișa tehnică sau din catalog (consum pe lucrare) |
| 3 | **Reducerea de motorină (indicator verde)** | `1 − l_ha_nou / l_ha_vechi` |
| 4 | **Reducerea de azot (indicator verde)** | `kgN_ha × reducere_dozare` (reducerea din catalog, pe tehnologie) |
| 5 | Economie în EUR / an | `Δl_ha × ha × preț_motorină + ΔkgN_ha × ha × preț_N` |
| 6 | CO₂e evitat (t/an) | `(Δlitri × 2,68 + ΔkgN × 4,29) / 1000` |

**C. Pragul verde:** reducere **≥ 20%** de motorină pe hectar **sau** de azot pe hectar. Motorul utilajului nou respectă **Stage V** (norma UE de emisii pentru utilaje).

**D. Cum îl îndrumăm:** pilot automat GPS (mai puține suprapuneri) · modul de dozare variabilă · semănătoare no-till sau strip-till · tractor de putere potrivită pentru suprafața lucrată.

**E. Creditul verde:** **F1**. Acoperă cerința *investiție verde, cu impact cuantificat* (litri, kg N, t CO₂e). Eligibil în *Agriculture and forestry* sau *Energy efficiency* (**F2**).

**F. Ce câștigă banca:** motorina și îngrășămintele sunt printre cele mai mari costuri ale unei ferme de câmp, deci economia crește direct DSCR-ul. Banca raportează litri economisiți, kg N evitați și t CO₂e.

---

### 🐄 Categoria 4 — Zootehnie & biogaz

*Ferme de vaci, porci sau păsări care vor un digestor anaerob sau o stocare acoperită a gunoiului de grajd.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | Numărul și specia animalelor | automat din registrul ANSVSA (cu acord), confirmat | cantitatea de gunoi și metanul |
| ✅ | Cum stocați acum gunoiul de grajd (platformă descoperită / acoperită / bazin) | întrebare | emisiile de bază |
| ✅ | **Autorizația de mediu** (sau cererea depusă) | document | legalitatea și DNSH-ul pentru poluare |
| ✅ | Ce faceți cu digestatul (îngrășământ pe câmp / vânzare) | întrebare | valorificarea, DNSH |
| ⚪ | Facturile de energie pe 12 luni | document | dacă biogazul produce energie pentru fermă |

**B. Ce calculăm**

| # | Calcul | Formula |
|---|---|---|
| 1 | Metanul din gunoi acum (kg/an) | `CH₄_vechi = capete × EF_CH₄(specie, sistem de stocare)` (factori IPCC Tier 1, din config) |
| 2 | Metanul după investiție | `CH₄_nou = CH₄_vechi × (1 − reducerea sistemului nou)` (din catalog) |
| 3 | **Reducerea de emisii (indicator verde)** | `1 − CH₄_nou / CH₄_vechi` |
| 4 | CO₂e evitat (t/an) | `(CH₄_vechi − CH₄_nou) × 27 / 1000` |
| 5 | Energie produsă (kWh/an) | `capete × kWh pe cap (specie)` (din config / fișa digestorului) |
| 6 | Economie în EUR / an | `kWh consumați la fermă × preț + kWh vânduți × preț_vânzare + kg N din digestat × preț_N` |

**C. Pragul verde:** reducere de emisii **≥ 50%** pe gestionarea gunoiului de grajd **și** gunoiul e valorificat (energie sau îngrășământ).

**D. Cum îl îndrumăm:** acoperirea bazinului de digestat · cogenerare (curent + căldură pentru adăposturi) · separator solid-lichid.

**E. Creditul verde:** **F1**. Acoperă cerința *investiție verde* (energie regenerabilă din biogaz). Eligibil în *Renewable energy* sau *Pollution prevention and control* (**F2**).

**F. Ce câștigă banca:** firma are venituri noi (energie) și costuri mai mici (energie, îngrășăminte), iar riscul de probleme de mediu (nitrați, mirosuri) scade. Banca raportează t CO₂e evitate și MWh produși.

---

### ❄️ Categoria 5 — Post-recoltă (depozite frigorifice, uscătoare, sere)

*Ferme care vor să depoziteze, să usuce sau să cultive mai eficient.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | **Facturile de energie (curent și/sau gaz) pe ultimele 12 luni** | document | consumul de bază |
| ✅ | Ce depozitați / uscați / cultivați și cât (tone pe an sau m² de seră) | întrebare | consumul pe unitate |
| ✅ | Câte luni pe an funcționează | întrebare | consumul anual |
| ⚪ | Fișa echipamentului vechi | document | precizie mai bună decât din facturi |

**B. Ce calculăm**

| # | Calcul | Formula |
|---|---|---|
| 1 | Consumul pe unitate acum | `I_vechi = kWh_pe_an / tone` (sau / m²) |
| 2 | Consumul pe unitate după | `I_nou` din fișa tehnică (consum specific, COP) |
| 3 | **Economia de energie (indicator verde)** | `1 − I_nou / I_vechi` |
| 4 | Economie în EUR / an | `(I_vechi − I_nou) × tone × preț` (separat pentru curent și gaz) |
| 5 | CO₂ evitat (t/an) | `ΔMWh_curent × 0,26 + ΔMWh_gaz × 0,20` |

**C. Pragul verde:** economie de energie **≥ 20%**. Dacă echipamentul folosește agent frigorific, acesta are potențial redus de încălzire globală (DNSH pentru poluare).

**D. Cum îl îndrumăm:** izolație mai bună · recuperare de căldură · agent frigorific natural (CO₂, propan) · motoare IE4 · ecrane termice la sere.

**E. Creditul verde:** **F1**. Acoperă cerința *eficiență energetică* (exemplul dat explicit de FEI). Eligibil în *Energy efficiency* (**F2**).

**F. Ce câștigă banca:** pe lângă economie, fermierul poate vinde recolta mai târziu, la preț mai bun, deci veniturile cresc. Banca raportează MWh economisiți și t CO₂ evitate.

---

### 🌱 Categoria 6 — Ecologic (conversie la agricultură ecologică)

*Ferme convenționale care trec la bio, sau ferme bio care se extind.*

**A. Ce cerem**

| | Ce | Tip | Folosit pentru |
|---|---|---|---|
| ✅ | **Contractul cu organismul de certificare** sau certificatul ecologic | document | eligibilitatea pentru F3 |
| ✅ | Câte hectare treceți la bio și din ce an | întrebare | perioada de conversie |
| ✅ | Câte îngrășăminte cu azot folosiți acum (kg N/ha) | întrebare (sau facturi) | azotul evitat |
| ⚪ | Planul de conversie | document | calendarul pe culturi |

**B. Ce calculăm**

Aici **nu există economie de energie**. Riscul principal e **lichiditatea în anii de conversie**: producția scade, iar prețul bio apare abia după certificare.

| # | Calcul | Formula |
|---|---|---|
| 1 | Venitul în fiecare an de conversie | `ha × producție_ha × (1 − scăderea de producție în anul respectiv) × preț_convențional` (config pe cultură) |
| 2 | Venitul după certificare | `ha × producție_bio_ha × preț_convențional × (1 + prima bio)` (config pe cultură) |
| 3 | Subvenții | plățile pentru agricultură ecologică și eco-schemele (APIA / config) |
| 4 | **Golul de lichiditate** | pe fiecare lună: `max(0, cheltuieli + rate − venituri − subvenții)`. Dimensionează **perioada de grație** și linia de lichiditate (F5) |
| 5 | **Indicatorul verde** | hectare certificate sau în conversie |
| 6 | Azot mineral evitat și CO₂e (t/an) | `kgN_ha × ha × 4,29 / 1000` |

> Carbonul din sol **nu îl calculăm**, pentru că nu se poate verifica credibil fără măsurători. Îl menționăm doar ca beneficiu calitativ.

**C. Pragul verde:** **certificare ecologică UE** sau contract de conversie cu un organism de certificare.

**D. Cum îl îndrumăm:** compară conversia integrală cu cea etapizată (parcelă cu parcelă): etapizarea micșorează golul din primul an, dar amână câștigul, așa că aplicația o recomandă doar dacă golul nu poate fi acoperit prin grație și prefinanțarea APIA · culturi cu primă bio mare · contracte de vânzare cu procesatori bio.

**E. Creditul verde:** **F3 (Credit BIO)**, cu grație pe anii de conversie, plus **F5** pentru golurile de lichiditate. Eligibil în *Agriculture and forestry* (**F2**).

**F. Ce câștigă banca:** dosarul arată de la început când apare golul de lichiditate, deci ratele se programează potrivit și riscul de neplată scade. Banca raportează hectare bio și kg N evitați.

---

### Rezumat: cele 6 categorii

| | 💧 Irigații | ☀️ Energie | 🚜 Utilaje | 🐄 Biogaz | ❄️ Post-recoltă | 🌱 Ecologic |
|---|---|---|---|---|---|---|
| **Documentul cheie** | autorizație ANAR | facturi energie 12 luni | facturi motorină 12 luni | autorizație de mediu | facturi energie 12 luni | contract de certificare |
| **Întrebări cheie** | sistem actual, sursă, adâncime | loc, suprafață | utilaj vechi | stocare gunoi, digestat | ce, cât, câte luni | ha, an, kg N |
| **Indicatorul verde** | % apă economisită | MWh regenerabili | % motorină sau N / ha | % metan evitat | % energie economisită | ha certificate |
| **Pragul** | ≥ 25% | eligibil direct | ≥ 20% | ≥ 50% | ≥ 20% | certificare |
| **Fondul** | F1 / F4 | F1 | F1 | F1 | F1 | F3 + F5 |
| **Categoria în F2** | Agriculture & forestry | Renewable energy | Agriculture & forestry / Energy efficiency | Renewable energy / Pollution prevention | Energy efficiency | Agriculture & forestry |
| **Impact raportat** | m³, MWh, t CO₂ | MWh, t CO₂ | litri, kg N, t CO₂e | t CO₂e, MWh | MWh, t CO₂ | ha, kg N |

---

## 7. Zona IMM: ce vede reprezentantul firmei

Limbaj simplu, fără jargon bancar sau ESG.

| Pas | Ecran | Ce face / ce vede |
|---|---|---|
| 1 | **Firma ta** | introduce CUI-ul, bifează acordurile APIA și Open Banking, confirmă datele afișate |
| 2 | **Ce vrei să faci?** | alege una din cele 6 categorii |
| 3 | **Unde?** | bifează parcelele pe hartă |
| 4 | **Documente** | încarcă doar documentele esențiale ale categoriei (lista din §6) |
| 5 | **Întrebări** | răspunde la întrebările esențiale ale categoriei, precompletate unde se poate |
| 6 | **Analiza** (live) | mesaje simple: *„Aspersia economisește 20% apă. Pentru creditul verde e nevoie de 25%. Cu picurare și senzori ajungi la 40%.”* |
| 7 | **Ofertele tale** | **Credit clasic** vs. **Credit verde**: suma, dobânda, garanția, rata, calendarul ratelor, economiile. Mesaj mare: **„Câștigi X EUR alegând creditul verde”** |
| 8 | **Ce să schimbi** | upgrade-ul propus, costul lui și în cât timp se recuperează |
| 9 | **Trimite cererea** | alege varianta și trimite la bancă |
| 10 | **După aprobare** | lista de dovezi cu termene, statusul cererii, impactul măsurat |

---

## 8. Zona ofițer: ce primește ofițerul Raiffeisen

Totul detaliat și verificabil, cu sursa fiecărei cifre.

| Panou | Ce conține |
|---|---|
| **1. Dosarul firmei** | date ANAF (statut IMM), APIA (parcele, culturi, subvenții), Open Banking (cashflow, sezonalitate) · **harta parcelelor** cu riscurile: secetă, Natura 2000, nitrați |
| **2. Pașii agenților** (live) | documentele citite, fiecare calcul cu datele de intrare și rezultatul, pragul trecut sau netrecut, upgrade-ul ales |
| **3. Analiza tehnică** | indicatorul verde: investiția cerută vs. investiția verde · impactul pe an (m³, MWh, litri, t CO₂e) |
| **4. Structurarea creditului** | clasic vs. verde · **descompunerea dobânzii verzi** (cost de risc, capital, finanțare, operațional) · calendarul ratelor · DSCR · avantajul net |
| **5. Raportul verde** | decizia și nivelul verde · criteriul și pragul folosit · tabelul DNSH · **fondul propus** (F1–F6) și cerințele lui bifate · **categoria din cadrul obligațiunilor verzi** · condițiile înainte de tragere · riscurile |
| **6. Acțiuni** | Aprobă · Cere documente · Descarcă raportul PDF |
| **7. Portofoliu** | totaluri: credite verzi pe categorii, sume pe fiecare fond, impactul total (t CO₂, MWh, m³) |

---

## 9. Cum ajută banca: KPI-uri

| KPI al băncii | Cum ajută aplicația |
|---|---|
| **Volumul de credite verzi** și ponderea lor în portofoliu | transformă credite care ar fi rămas clasice în credite verzi, prin upgrade-ul propus |
| **Folosirea garanției FEI InvestEU (F1)** | garanțiile au o perioadă de utilizare; aplicația produce dosare eligibile, deja documentate |
| **Creditele eligibile pentru obligațiunile verzi (F2)** | banii din obligațiuni trebuie alocați pe credite eligibile; fiecare credit primește automat categoria din cadrul băncii |
| **Raportul de impact pentru investitori** (BERD, IFC și ceilalți cumpărători ai obligațiunilor) | impact calculat la acordare și **măsurat la 12 luni**, pe fiecare credit |
| **Emisiile finanțate** (raportarea de sustenabilitate a băncii și a grupului) | date reale ale clientului (facturi, contoare) în locul mediilor pe sector |
| **Riscul climatic al portofoliului** | risc de secetă, grindină și inundații pe fiecare parcelă, plus investiții care îl reduc (irigații) |
| **Costul și durata analizei** | analiza tehnică devine automată |
| **Calitatea portofoliului** (credite neplătite) | DSCR mai bun datorită economiilor și rate potrivite cu încasările |

---

## 10. Agenții AI

### Ciclul de viață al unui dosar

```
CREAT → DATE AUTOMATE → AGENT 1 → AGENT 2 → AGENT 3 → OFERTE GATA → TRIMIS → APROBAT → MONITORIZARE
```

La fiecare pas, backend-ul trimite un **eveniment live (SSE)** către ambele zone.

| Agent | Primește | Face | Dă mai departe |
|---|---|---|---|
| 🔍 **Agent 1 — Auditor tehnic** | documentele, răspunsurile, categoria, datele automate | 1. extrage din documente doar valorile scrise acolo · 2. apelează formulele categoriei · 3. compară cu pragul · 4. dacă e sub prag, caută cel mai ieftin upgrade care îl trece · 5. verifică DNSH | investiția cerută și cea verde, cu indicatorii · DNSH · datele lipsă |
| 💰 **Agent 2 — Structurare credit** | rezultatul Agentului 1 + datele financiare | 1. alege fondul potrivit · 2. construiește creditul clasic și creditul verde · 3. calculează dobânda verde, ratele, DSCR-ul și avantajul net · 4. stabilește nivelul verde | cele două variante, descompunerea dobânzii, recomandarea, textul pentru IMM |
| 📋 **Agent 3 — Underwriter verde** | rezultatele Agenților 1 și 2 | 1. bifează cerințele fondului · 2. alege categoria din cadrul obligațiunilor verzi · 3. transformă datele lipsă în condiții înainte de tragere · 4. scrie raportul pentru ofițer | raportul verde |

**Cum ne asigurăm că rezultatul AI e corect:**
- fiecare agent își termină munca **obligatoriu** printr-un tool `submit_*` cu schemă JSON fixă (`contracts/schemas/`);
- dacă rezultatul nu respectă schema, agentul primește eroarea și se corectează;
- backend-ul **recalculează** toate cifrele cu motorul de calcul și le înlocuiește pe cele scrise de AI.

---

## 11. Arhitectura tehnică

### Stack

| Zonă | Tehnologie |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui · Leaflet (OpenStreetMap cu internet, parcele pe fundal simplu fără internet) · Recharts (grafice) |
| Backend | Java 21 + Spring Boot 3.5 (Maven), pipeline pe thread-uri virtuale |
| AI | AWS Bedrock, Converse API (AWS SDK for Java v2) cu Claude (citire PDF + tool use), regiune UE. **Opțional:** fără credențiale AWS, aplicația merge din rulările demo înregistrate |
| Date externe | **ANAF live** (API-urile publice de TVA și bilanț, fără cheie) pentru orice CUI real · mock-uri pentru APIA, ANSVSA, Open Banking, hărți de risc și pentru fermele demo |
| Fișiere | disc local (AWS S3 opțional) |
| Stocare | dosarele în memorie; fără bază de date |
| Autentificare | fără: cele două zone sunt rutele `/imm` și `/ofiter`, afișate în split-view, cu un selector de dosar demo |
| Live | Server-Sent Events (SSE) |
| Contract | `contracts/`: OpenAPI, JSON Schema pentru output-urile agenților, catalogul de evenimente, fixtures (contract-first; frontend-ul poate lucra pe mock-ul Prism) |
| Teste | JUnit 5 (backend) · validatoarele din `contracts/` (`npm run check`, `npm run validate:samples`) |

### Structura repo-ului

```
The-Sopranos-hakaton/  (branch B2B_Agro)
├── frontend/                   # React + Vite, ecrane statice cu date fictive (Busola + fluxul credit verde agro); detalii în frontend/README.md
├── backend/                    # Spring Boot
│   └── src/main/java/ro/greenstruct/agro/
│       ├── api/                # REST + SSE, erori în formatul din contract
│       ├── orchestration/      # mașina de stări a dosarului, evenimente
│       ├── tools/              # uneltele agenților (technical, funding, underwriting) → motor
│       ├── engine/             # MOTORUL DE CALCUL (BigDecimal, cu teste)
│       │   ├── finance/        # anuitate, rate sezoniere, comparație clasic vs. verde
│       │   ├── funding/        # grant, cofinanțare, punte, garanție, de minimis
│       │   ├── pricing/  greentier/  affordability/   # dobânda pe componente, nivelurile verzi, DSCR
│       │   ├── irrigation/  energy/  machinery/  livestock/  postharvest/  organic/   # câte un calculator pe categorie
│       │   ├── impact/  upgrade/  monitoring/  portfolio/  sme/
│       ├── agents/rules/       # agenții pe reguli (fără model): ultimul nivel al planului B, rulează tot offline
│       ├── bedrock/            # agenții Bedrock, bucla de unelte, reluare, cache, rulări înregistrate
│       ├── modules/            # încărcarea config-ului pe modul (categorie)
│       ├── external/           # porturi + ANAF live (anaf/) + mock-uri (mock/)
│       ├── farm/  storage/  demo/  config/
├── contracts/                  # openapi.yaml, schemas/, events.md, fixtures/, examples/
├── config/                     # modules/*.json, financing-lines.json, funding-programs.json, funds.json, pricing.json, monitoring.json, factors.json, prices.json
└── data/
    ├── catalog/                # upgrade-urile pe modul
    └── demo/                   # fermele demo, scenariile, documentele demo
```

### API

Definiția completă e în `contracts/openapi.yaml`.

| Endpoint | Ce face |
|---|---|
| `POST /api/classify` | categoria investiției, recunoscută din oferta încărcată |
| `GET /api/modules` | cele 6 module (categorii), cu documentele și întrebările fiecăruia |
| `GET /api/farms/{cui}` | profilul firmei: ANAF (live sau mock demo), parcele APIA, cashflow Open Banking |
| `POST /api/runs` | creează un dosar (multipart: CUI, modul, parcele, chestionar, documente) și întoarce `runId` |
| `POST /api/runs/demo/{scenario}` | încarcă dosarul demo (`irigatii` / `utilaje`) |
| `GET /api/runs/{id}` | starea completă a dosarului, cu cifrele rezolvate. `?view=sme` = ce vede IMM-ul (fără fonduri, fără raportul ofițerului) |
| `GET /api/runs/{id}/events` | evenimentele live (SSE, cu reluare prin `Last-Event-ID`) |
| `POST /api/runs/{id}/submit` | IMM-ul trimite varianta aleasă (`CLASIC` / `VERDE`): `GATA → TRIMIS` |
| `POST /api/runs/{id}/approve` · `/request-documents` | acțiunile ofițerului, doar din `TRIMIS` |
| `GET /api/runs/{id}/report.pdf` | raportul verde în PDF, după aprobare |
| `POST /api/runs/{id}/simulate-monitoring` | „Simulează 12 luni”: impact real față de estimat și bonusul de impact |
| `GET /api/portfolio` | credite verzi pe categorii, sume pe fonduri, impact total |
| `GET /api/health/bedrock` | starea Bedrock înainte de demo |

**Evenimente live:** `state.transition` · `agent.started` · `agent.thought` · `agent.tool_call` · `agent.tool_result` · `agent.completed` · `agent.degraded` · `run.completed` · `run.failed`

### Reguli pentru motorul de calcul

- toate formulele din §4 și §6 sunt **funcții pure, cu teste** pe valori fixe;
- nicio constantă în cod: totul vine din `config/` și fiecare valoare are sursa scrisă lângă ea;
- sumele se rotunjesc **doar la afișare**.

### Planul B pentru demo

| Nivel | Când | Ce se întâmplă |
|---|---|---|
| 1. Live | normal | AWS Bedrock real |
| 2. Reîncercare | AWS răspunde greu | reîncercare + model de rezervă |
| 3. Cache | timeout | rezultatul salvat de la o rulare anterioară cu aceleași documente |
| 4. Înregistrare | AWS indisponibil / fără internet | redăm o rulare reală înregistrată, cu același ritm |

Motorul de calcul **rulează mereu live**, pentru că e cod local. Până apar cheile AWS, aplicația pornește direct în modul offline (nivelul 4).

---

## 12. Demo-ul

| Moment | Ce arătăm | Durată |
|---|---|---|
| **Problema** | Raiffeisen are bani verzi, fermierii au nevoie de ei, dar verificarea manuală e prea scumpă | 20 sec |
| **Rularea principală (live)** | **Fermă de legume, 40 ha, sud-est.** Irigă prin brazde și cere aspersie clasică (20% economie de apă, sub prag) → aplicația propune picurare + senzori (40%, Verde Plus) → clasic vs. verde, cu descompunerea dobânzii și rate după recoltă → raportul ofițerului cu harta, fondul și categoria din cadrul obligațiunilor verzi | ~2 min |
| **A doua rulare (live)** | **Juriul alege una din celelalte 5 categorii**, iar noi rulăm pe loc ferma ei demo | ~30 sec |
| **Pentru bancă** | panoul de portofoliu: credite verzi, sume pe fiecare fond, impact | 20 sec |

### Demo-ul e gata când

- [ ] Ferma de legume trece live prin cei 3 agenți, în ambele zone
- [ ] Se vede momentul *„sub prag → upgrade → peste prag”*
- [ ] Se vede **de ce** dobânda verde e mai mică (descompunerea pe componente)
- [ ] Raportul ofițerului are fondul, cerințele bifate, DNSH, impactul și condițiile
- [ ] Toate cele 6 ferme demo trec complet, oricare ar alege juriul
- [ ] Toate cifrele vin din motorul de calcul și au teste
- [ ] Demo-ul merge **fără internet**

---

## 13. Decizii pentru prototip

Deciziile luate pentru versiunea de hackathon. Ce nu e scris aici urmează restul documentului.

### Produs

| Decizie | Detaliu |
|---|---|
| **Toate cele 6 categorii merg complet** | fiecare are fermă demo, documente, calcule, ofertă și raport |
| **6 ferme demo fictive** | legume (irigații) · fermă cu facturi mari la energie (fotovoltaice) · cereale (utilaje) · vaci (biogaz) · fructe (depozit frigorific) · fermă în conversie la bio. Fiecare are un buton „Dosar demo” pe cardul categoriei. Detaliile lor sunt în `data/demo/README.md` |
| **Date evident fictive** | nume fictive și CUI-uri numerice fictive (formatul cerut de ANAF), verificate că nu există la ANAF. Fermele demo din `data/demo/farms/` nu ajung niciodată la ANAF; orice alt CUI se caută live |
| **Momentul de îndrumare** | categoriile 1, 3, 4, 5 pornesc **sub prag** și arată upgrade-ul · categoria 2 (eligibilă direct) arată **redimensionarea** instalației · categoria 6 compară **conversia integrală cu cea etapizată** și arată golul de lichiditate din anii de conversie |
| **Zona IMM e self-service** | o folosește reprezentantul firmei, singur |
| **IMM-ul nu vede fondurile** | vede „Credit verde Raiffeisen” și beneficiul „fără ipotecă, datorită unei garanții europene”. Fondul și cerințele lui apar doar în zona ofițerului |
| **Două carduri: Clasic și Verde** | dacă investiția cerută e sub prag, alegerea cardului Verde înseamnă acceptarea upgrade-ului. Nu există „verde fără upgrade” |
| **Prețul upgrade-ului e estimat** | vine din catalog. Condiție înainte de tragere: oferta actualizată de la furnizor, iar suma se ajustează după ea |
| **„Aprobă”** | schimbă statusul în ambele zone și generează raportul PDF. Fără integrare cu sistemele băncii |
| **„Simulează 12 luni”** | buton în zona ofițerului: încarcă date de monitorizare simulate, arată impactul real față de cel estimat și bonusul de impact, actualizează portofoliul |
| **Moneda: EUR** | indice EURIBOR 3M. Moneda rămâne parametru în config |
| **Durata creditului** | 5 ani pentru irigații, utilaje, post-recoltă și ecologic · 7 ani pentru fotovoltaice și biogaz · grație de maximum 12 luni, până la prima recoltă după investiție (config pe categorie) |
| **Parametri demo** | pragurile și parametrii dobânzii sunt cei ilustrativi din acest document, marcați „parametri demo” în zona ofițerului, până răspund mentorii |
| **Limba** | interfața e în română; codul, variabilele și commit-urile sunt în engleză |
| **Branding** | „Raiffeisen” apare ca text, cu o temă de culori proprie. Logo-ul oficial se adaugă doar cu acordul organizatorilor |

### Tehnic

| Decizie | Detaliu |
|---|---|
| **Merge complet fără AWS** | fără chei, agenții rulează din rulările demo înregistrate (`data/demo/golden/`) sau, dacă nu există, din agenți pe reguli care cheamă aceleași unelte; cifrele se recalculează mereu live. Bedrock se activează punând cheile în `.env` |
| **ANAF live, restul mock-uri** | ANAF are API public: datele firmei (identitate, CAEN, TVA, stare fiscală, bilanț) vin live, cu cache și cu răspunsul anterior dacă ANAF pică. APIA, ANSVSA, Open Banking și hărțile de risc rămân mock-uri cu interfața serviciului real. `GREENSTRUCT_ANAF_ENABLED=false` oprește ANAF pentru demo-ul offline |
| **Fără login, fără bază de date** | vezi [§11](#11-arhitectura-tehnică) |
| **PDF-uri demo generate de un script** | din aceleași date JSON ca mock-urile, ca cifrele să fie mereu identice |
| **Demo local** | rulează pe laptopul de prezentare, fără hosting |

### Ordinea de construcție

În orice moment există o versiune care merge complet. Dacă nu ajunge timpul, se taie de la coadă.

| Pas | Ce | Dacă nu ajunge timpul |
|---|---|---|
| 1 | Categoria 1 cap-coadă, în ambele zone, inclusiv offline | nu se taie |
| 2 | Categoriile 2–6, cu fermele lor demo | nu se taie |
| 3 | Raportul PDF | nu se taie |
| 4 | Portofoliul și „Simulează 12 luni” | se taie al treilea |
| 5 | Agenții live pe Bedrock (doar dacă apar cheile AWS) | se taie al doilea |
| 6 | Polish vizual | se taie primul |

---

## 14. Ipoteze de confirmat cu Raiffeisen

### Ce am presupus

| Ipoteză | Unde se folosește | Unde se schimbă |
|---|---|---|
| Pragurile verzi: 25% apă, 20% motorină / azot / energie, 50% metan | §6, nivelurile verzi | `config/modules/*.json` |
| Procentul garanției FEI (70% în exemplu) și comisionul ei | dobânda verde | `config/funds.json` |
| Parametrii dobânzii (PD, LGD, ponderi de risc, cost de finanțare, subvenții) | dobânda verde | `config/pricing.json` |
| F4 (irigații cu FEI) e încă activ; banca finanțează cofinanțarea AFIR (F6) | fondurile propuse | `config/funds.json` |
| Încadrarea categoriilor pe categoriile din cadrul obligațiunilor verzi | raportul ofițerului | `config/funds.json` |
| Factorii de emisie și eficiențele | impactul | `config/factors.json` și `config/modules/*.json` |

### Întrebări pentru mentorii Raiffeisen

1. Ce praguri tehnice folosește banca pentru „verde” la irigații, utilaje, zootehnie și post-recoltă?
2. Ce procent acoperă garanția FEI InvestEU de sustenabilitate, are comision și ce beneficii se transmit clientului?
3. Care sunt condițiile actuale pentru Credit BIO și pentru finanțarea irigațiilor?
4. Banca finanțează cofinanțarea pentru granturi AFIR?
5. Ce indicatori de impact raportează banca investitorilor în obligațiunile verzi, pentru categoria *Agriculture and forestry*?
6. Ce interval de dobândă e realist pentru un credit agricol clasic și pentru unul verde?

---

## 15. Surse

- [Sustainalytics — Raiffeisen Bank Romania Sustainability Bond Framework, Second Party Opinion (2024)](https://www.sustainalytics.com/corporate-solutions/sustainable-finance-and-lending/published-projects/project/raiffeisen-bank-romania/raiffeisen-bank-romania-sustainability-bond-framework-second-party-opinion-(2024)/raiffeisen-bank-romania-sustainability-bond-framework-second-party-opinion-(2024))
- [Sustainalytics — RBRO Green Bond Framework, Second Party Opinion](https://mstar-sustops-cdn-mainwebsite-s3.s3.amazonaws.com/docs/default-source/spos/rbro-green-bond-framework-second-party-opinion.pdf)
- [EIF — EIF and leading Romanian banks join forces to empower SMEs for sustainable growth (2023)](https://www.eif.org/press/all/romania-eif-and-leading-romanian-banks-join-forces-to-empower-smes-for-sustainable-growth)
- [ZF English — European Investment Fund and Raiffeisen Bank Romania sign agreement for SMEs funding](https://www.zfenglish.com/banks-insurance/european-investment-fund-and-raiffeisen-bank-romania-sign-agreement-22169018)
- [Romania Insider — Over EUR 600 mln reach Romanian SMEs through InvestEU guarantee (2025)](https://www.romania-insider.com/romanian-smes-investeu-pnrr-july-2025)
- [EBRD project 52996 — Raiffeisen Bank green bond (prin Early Warning System)](https://ewsdata.rightsindevelopment.org/projects/EBRD-52996/)
- [IFC — IFC partners with Raiffeisen Bank to boost sustainable growth in Romania (2023)](https://www.ifc.org/en/pressroom/2023/ifc-partners-with-raiffeisen-bank-to-boost-sustainable-growth-in-romania)
- [Romania Insider — Raiffeisen Bank Romania lists third green bond](https://www.romania-insider.com/business/raiffeisen-bank-romania-third-green-bond)
- [BVB — Raiffeisen Bank, rezultate T1 2024 (obligațiuni verzi și sustenabile emise)](https://bvb.ro/infocont/infocont24/RBRO26_20240430151154_Q1-Results-2024-Raiffeisen-Bank---ENG.pdf)
- [Economedia — Raiffeisen Bank a lansat Credit BIO](https://economedia.ro/?p=22194)
- [Wall-Street.ro — Raiffeisen Bank oferă consultanță și soluții de finanțare fermierilor](https://www.wall-street.ro/articol/Finante-Banci/274978/raiffeisen-bank-ofera-consultanta-si-solutii-de-finantare-fermierilor.html)
- [Bursa — Raiffeisen Bank continuă finanțarea subvențiilor agricole APIA](https://www.bursa.ro/raiffeisen-bank-continua-finantarea-subventiilor-agricole-apia-44736932)
