# Documente de test: cele 6 ferme demo

Un set de prezentare **separat** de datele pe care le citește backend-ul (`data/demo/farms/`, `data/demo/scenarios/`, `data/demo/docs/`). Fișierele de aici nu sunt încărcate automat de aplicație.

6 ferme **fictive**, câte una pentru fiecare categorie. Pentru fiecare: ce documente încarcă IMM-ul, ce răspunde la întrebări și ce trebuie să calculeze aplicația.

> ⚠️ Toate numele, CUI-urile (`DEMO-0001` … `DEMO-0006`), furnizorii, autoritățile și cifrele sunt **inventate**. Fiecare PDF are banda „DOCUMENT DE TEST · FICTIV” și filigranul „DEMO”.

## Fișiere

| Unde | Ce |
|---|---|
| `farms/DEMO-000X.json` | toate datele unei ferme: mock-urile ANAF / APIA / ANSVSA / Open Banking, locația și riscurile, răspunsurile la întrebări, investiția cerută, rezultatele așteptate și conținutul documentelor |
| `pdf/DEMO-000X/*.pdf` | documentele de încărcat în aplicație, generate din JSON |
| `reference/upgrades.json` | upgrade-urile propuse |
| `reference/constants.json` | factori de emisie, eficiențe, prețuri (valori demo, folosite doar de acest set) |

## Regenerare și verificare

```bash
cd scripts/demo-docs && npm install && npm run generate
```

`npm run generate` rulează întâi `verify.mjs`, care recalculează **fiecare** rezultat așteptat din datele brute, cu formulele din README-ul principal (§6). Verifică și că facturile și ofertele adună exact cât scrie în date. Dacă o cifră nu se potrivește, PDF-urile nu se generează.

---

## 💧 DEMO-0001 — Legume Bărăgan Demo SRL (Irigații)

40 ha de legume în Călărași (tomate 16 ha, ardei 14 ha, varză 10 ha), irigate acum prin brazde dintr-un puț.

| Încarcă | Răspunde |
|---|---|
| `01_oferta_aspersie.pdf`: aspersie cu tambur, 52.000 EUR · `02_autorizatie_gospodarire_ape.pdf` · `03_facturi_energie_pompare.pdf` (opțional, 5 luni) | sistem actual: brazde · sursa: puț forat · înălțime de pompare: 35 m · culturile vin din APIA · pompa veche: reciclare autorizată |

| Rezultat așteptat | Cerut (aspersie) | Verde (picurare + senzori) |
|---|---|---|
| Apă extrasă (acum 243.500 m³) | 194.800 m³ | 146.100 m³ |
| **Economie de apă** (prag 25%) | **20% ❌** | **40% ✅ Verde Plus** |
| Energie de pompare (acum 35.729 kWh) | 57.166 kWh (crește: presiune mai mare) | 30.625 kWh |
| Investiție | 52.000 EUR | 74.500 EUR (+22.500) |

## ☀️ DEMO-0002 — Avicola Dealul Verde Demo SRL (Energie)

Fermă de păsări în Prahova, 215.000 kWh/an, cu acoperiș de 2.600 m².

| Încarcă | Răspunde |
|---|---|
| `01_oferta_fotovoltaice_300kWp.pdf`: 300 kWp, 210.000 EUR · `02_facturi_energie_12_luni.pdf` | montaj: acoperiș hale · suprafață: 2.600 m² · consum propriu, surplusul se vinde · ponderea consumului ziua: 55% |

| Rezultat așteptat | Cerut (300 kWp) | Verde (100 kWp) |
|---|---|---|
| Producție | 375.000 kWh | 125.000 kWh |
| Consumată la fermă / vândută | 118.250 / 256.750 kWh | 100.375 / 24.625 kWh |
| **Pondere vândută în rețea** (regula: max. 30%) | **68%** | **20% ✅ Verde** |
| Economie anuală | 37.873 EUR | 20.549 EUR |
| Recuperarea investiției | 5,5 ani | 3,5 ani |
| Investiție | 210.000 EUR | 72.000 EUR |

Eligibilă direct. Îndrumarea e **redimensionarea**: credit mai mic, investiție care se recuperează mai repede.

## 🚜 DEMO-0003 — Cereale Câmpia Demo SRL (Utilaje)

600 ha în Ialomița (grâu, porumb, floarea-soarelui), cu tractor din 2004.

| Încarcă | Răspunde |
|---|---|
| `01_oferta_tractor.pdf`: 300 CP, Stage V, 185.000 EUR, 68 l/ha · `02_facturi_motorina_12_luni.pdf` (46.800 l) · `03_facturi_ingrasaminte.pdf` (84.020 kg N) · `04_fisa_tractor_vechi.pdf` | utilaj înlocuit: tractor 2004, 240 CP · 600 ha lucrate · arătură · 140 kg N/ha · tractorul vechi se vinde |

| Rezultat așteptat | Cerut (tractor) | Verde (tractor + GPS RTK) |
|---|---|---|
| Motorină (acum 78 l/ha) | 68 l/ha | 61,88 l/ha |
| **Reducere motorină** (prag 20%) | **12,8% ❌** | **20,7% ✅ Verde** |
| Economisit pe an | — | 9.672 l motorină + 4.201 kg N |
| CO₂e evitat | — | 43,94 t/an |
| Investiție | 185.000 EUR | 201.000 EUR (+16.000) |

## 🐄 DEMO-0004 — Ferma de Lapte Valea Demo SRL (Zootehnie & biogaz)

150 de vaci de lapte în Bistrița-Năsăud, în zonă vulnerabilă la nitrați.

| Încarcă | Răspunde |
|---|---|
| `01_oferta_digestor.pdf`: 30 kWe, 270.000 EUR, −45% metan · `02_autorizatie_mediu.pdf` · `03_facturi_energie_12_luni.pdf` (120.000 kWh) | numărul de animale vine din ANSVSA · stocare: platformă + bazin descoperite · digestat: îngrășământ pe pajiști |

| Rezultat așteptat | Cerut (digestor) | Verde (digestor + bazin acoperit) |
|---|---|---|
| Metan din dejecții (acum 3.300 kg/an) | −45% | −85% |
| **Prag 50%** | **❌** | **✅ Verde** |
| CO₂e evitat | 40,1 t/an | 75,74 t/an |
| Energie produsă | 225.000 kWh/an | 225.000 kWh/an |
| Investiție | 270.000 EUR | 296.000 EUR (+26.000) |

## ❄️ DEMO-0005 — Livezile Argeș Demo SRL (Post-recoltă)

35 ha de meri în Argeș, depozit frigorific de 650 t, cu agregat din 2006.

| Încarcă | Răspunde |
|---|---|
| `01_oferta_agregat_frigorific.pdf`: R404A, 118.000 EUR, 115 kWh/t · `02_facturi_energie_12_luni.pdf` (85.000 kWh, contor separat) · `03_fisa_echipament_vechi.pdf` | produs: mere · 650 t/an · 7 luni de funcționare · agregatul vechi: reciclare cu recuperarea agentului |

| Rezultat așteptat | Cerut (agregat R404A) | Verde (R290 + panouri noi) |
|---|---|---|
| Consum specific (acum 130,77 kWh/t) | 115 kWh/t | 92 kWh/t |
| **Economie de energie** (prag 20%) | **12,1% ❌** | **29,6% ✅ Verde** |
| Agent frigorific (DNSH poluare) | R404A, GWP 3.922 ⚠️ | R290, GWP 3 ✅ |
| Economisit / CO₂ | — | 25.200 kWh/an · 6,55 t CO₂/an |
| Investiție | 118.000 EUR | 142.000 EUR (+24.000) |

## 🌱 DEMO-0006 — Ferma Bio Mureș Demo SRL (Ecologic)

120 ha în Mureș (grâu, porumb, soia), care intră în conversie de la 1 ianuarie 2027.

| Încarcă | Răspunde |
|---|---|
| `01_oferta_utilaje_bio.pdf`: prășitoare + grapă, 78.000 EUR · `02_contract_certificare.pdf` · `03_plan_conversie.pdf` · `04_facturi_ingrasaminte.pdf` (15.640 kg N) | 120 ha din 2027 · rotație + culturi de acoperire pe 40 ha · 130 kg N/ha |

**Eligibilă** prin contractul de certificare → Credit BIO. Marja față de agricultura convențională (45.800 EUR/an):

| An | Conversie integrală (120 ha) | Conversie etapizată (60 + 60 ha) |
|---|---|---|
| 2027 | −27.540 EUR | −13.770 EUR |
| 2028 | −19.550 EUR | −23.545 EUR |
| 2029 | +43.568 EUR | +12.009 EUR |
| 2030 | +43.568 EUR | +43.568 EUR |
| **Total pe 4 ani** | **+40.046 EUR** | **+18.262 EUR** |

Concluzia corectă pentru aceste date: **conversia integrală câștigă mai mult**. Golul din 2027–2028 (−47.090 EUR în total) se acoperă cu grația de 12 luni pentru 2027 și cu prefinanțarea APIA pentru 2028. Etapizarea are sens doar dacă banca nu poate acoperi golul.

Impact: 15.640 kg N mineral evitat pe an · 67,1 t CO₂e/an.
