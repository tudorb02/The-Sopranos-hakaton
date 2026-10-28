# Pattern Recognition — plan tehnic

> Owner: **Backend** (Analytics Engine). Consumatori: **AI** (tool-urile agentului), **Business** (praguri, texte).
> Context general: vezi `CLAUDE.md` (§4 Arhitectura, §8 Agentul).

Legendă: ✅ = decis · 🟡 = propunere implicită, de confirmat · ❓ = decizie deschisă

---

## 1. Principiu ✅

**Detectarea tiparelor NU folosește LLM.** Este realizată de cod determinist (statistică + ML clasic), din următoarele motive:

| Motiv | Explicație |
|---|---|
| Reproductibil | Aceleași date → același rezultat. Testabil în CI. |
| Explicabil | Fiecare tipar vine cu dovezi concrete („47 din 76 de cheltuieli înainte de ora 10”). |
| Corect numeric | LLM-urile greșesc la agregarea a sute de tranzacții. |
| Ieftin și rapid | Rulează pe toți utilizatorii, noaptea, fără cost per token. |
| Confidențial | Tranzacțiile brute nu trebuie trimise unui LLM pentru analiză. |

LLM-ul intervine **doar după**: primește tiparul structurat (prin tool-uri) și îl formulează / discută cu utilizatorul.

```
Tranzacții ─► Preprocesare ─► Detectori ─► Validare statistică ─► Ranker ─► Pattern / Insight ─► Agent (LLM) formulează
```

---

## 2. Preprocesare (fundația tuturor detectorilor)

### 2.1 Normalizarea comercianților ✅
`CAFENEA X SRL BUC`, `CAFENEAX*1234`, `Cafenea X` → **același** `Merchant`.
- Curățare cu regex: eliminare sufixe (`SRL`, `SA`), coduri terminal, orașe, caractere speciale, ID-uri de tranzacție.
- Potrivire aproximativă cu `rapidfuzz` față de comercianții existenți (prag de similaritate 🟡 ≥ 90).
- Tabel de alias-uri editabil manual (`merchant_aliases`) pentru cazurile frecvente.

### 2.2 Extragerea orei ⚠️
Multe exporturi bancare au doar **data înregistrării** (booking date), nu ora plății. La plățile cu cardul, ora apare adesea în descriere (ex. `POS 12.10.2026 08:14 CAFENEA X`).
- Parser dedicat pentru descrierile Raiffeisen → câmp `occurred_at` (data + ora reală a plății).
- Dacă ora nu poate fi extrasă → `occurred_at_precision = "day"`; detectorii orari ignoră aceste tranzacții.
- ❓ **Acțiune imediată:** verificăm ce câmpuri conține exportul CSV Raiffeisen (dată, oră, MCC, descriere).

### 2.3 Categorizare
- Ordine: alias manual → regulă pe comerciant → cod MCC (dacă există) → fallback LLM (cu cache pe comerciant, rulat o singură dată per comerciant nou).
- Corecturile utilizatorului (`PATCH /transactions/{id}`) devin date de antrenare pentru clasificatorul din Stratul 3.

### 2.4 Clasificare fix vs. discreționar ✅
Fiecare categorie are un flag `spending_type`: `fixed` (chirie, utilități, rate, abonamente), `essential` (supermarket, transport, farmacie), `discretionary` (cafea, restaurante, livrări, haine, divertisment).
Detectorii de comportament impulsiv lucrează **doar pe `discretionary`**.

### 2.5 Detectarea salariului
Cea mai mare intrare recurentă (~lunară, sumă stabilă ±15%) → `salary_day` estimat. Utilizatorul poate suprascrie din `/me`.

---

## 3. Strategia pe straturi

| Strat | Ce conține | Când | Acoperire |
|---|---|---|---|
| **1. Statistică + reguli** | Agregări, teste statistice, analiză de intervale | MVP | ~80% din scenarii |
| **2. ML nesupervizat per utilizator** | Clustering, anomalii, reguli de asociere | V2 | Descoperă tipare neanticipate |
| **3. Modele antrenate pe toți utilizatorii** | Clasificare, comparații, predicții | Când există volum de date | Personalizare avansată |

---

## 4. Stratul 1 — Statistică și reguli (MVP)

Stack: Python, `pandas`/`polars`, `numpy`, `scipy.stats`, `ruptures`.

### 4.1 `TimeOfDayDetector` — „cumperi înainte de ora 10”
- Distribuția cheltuielilor discreționare pe **interval orar** (ex. 07–10, 10–14, 14–18, 18–22, 22–02).
- Comparație cu un **baseline**: inițial distribuția proporțională cu orele active; ulterior media populației.
- Test: `scipy.stats.binomtest` (pentru un interval) sau `chisquare` (pentru toată distribuția).
- Variante: zi a săptămânii (`DayOfWeekDetector`), weekend vs. zile lucrătoare.

```
pattern: morning_spending
evidence: { window: "07:00–10:00", count: 47, total: 76, share: 0.62, baseline: 0.18 }
confidence: 0.99   # din p-value < 0.001
monthly_impact_minor: 84000
```

### 4.2 `RecurringDetector` — obiceiuri și abonamente
Pe fiecare comerciant normalizat:
- intervalele dintre tranzacții → **mediana** și **coeficientul de variație** (CV = σ / μ);
- variația sumei.

| Interval median | CV interval | Sumă | Clasificare |
|---|---|---|---|
| ~28–31 zile | mic (< 0.15) | constantă (±5%) | `subscription` |
| ~7 zile | mic | variabilă | `weekly_habit` |
| ~1 zi (zile lucrătoare) | mic | mică, relativ constantă | `daily_habit` |
| neregulat dar frecvent | mare | — | `frequent_merchant` |

### 4.3 `PaydayCycleDetector` — „rămâi fără bani la final de lună”
Fiecare ciclu se aliniază la ziua salariului (ziua 0, 1, 2 … N).
- **Curba medie a soldului** pe ciclu.
- **Viteza de cheltuire:** % din venit cheltuit în primele 7 / 10 zile.
- **Zile critice:** numărul de zile cu sold sub prag (🟡 implicit 10% din venit sau 100 lei).
- **Consistență:** în câte din ultimele N cicluri apare problema.

```
pattern: end_of_cycle_shortage
evidence: { cycles_affected: 3, cycles_total: 4, avg_critical_days: 5,
            spent_first_7_days_share: 0.48 }
```

### 4.4 `CategoryAnomalyDetector` — luni neobișnuite
- Pe fiecare categorie: valoarea lunii curente vs. istoric.
- **Z-score robust:** `(x − mediană) / (1.4826 × MAD)`; prag 🟡 > 3.
- Se folosește mediana (nu media) pentru că o singură cheltuială mare distorsionează media.

### 4.5 `ChangePointDetector` — schimbări de stil de viață
- Serie săptămânală pe categorie → `ruptures` (algoritm PELT).
- Exemplu: „din septembrie cheltui cu 40% mai mult pe livrări”.

### 4.6 `UnusedSubscriptionDetector`
- Pentru fiecare `Subscription` activ: semnale de utilizare (`UsageSignal`) în ultimele 30 de zile.
- 0 semnale + cost lunar → pattern `unused_subscription` cu cost per utilizare.
- Dacă nu există sursă de utilizare conectată → agentul întreabă utilizatorul (nu se presupune neutilizare).

### 4.7 `UpcomingSpendingForecaster` — cheltuieli viitoare
Fără modele complexe în MVP:
```
prognoza_lunii = Σ media categoriilor (ultimele 3–6 luni)
               + abonamente cunoscute
               + evenimente din calendar × cost estimat (din istoric sau setat de utilizator)
               + ajustare sezonieră simplă (ex. decembrie, septembrie)
```
Folosit de `simulate_goal` pentru a recomanda luna optimă a unei achiziții.

---

## 5. Stratul 2 — ML nesupervizat per utilizator (V2)

Scop: descoperirea de tipare **neanticipate**. Rezultatele sunt doar **candidați** — fiecare trece prin validarea statistică din §7 înainte de a ajunge la utilizator (datele unui singur utilizator sunt puține).

| Tehnică | Ce găsește | Bibliotecă |
|---|---|---|
| **HDBSCAN** pe (oră, zi a săptămânii, sumă log, categorie) | „Clustere de obiceiuri” (ex. *seri de weekend, 80–150 lei, baruri + taxi*) | `hdbscan`, `scikit-learn` |
| **Isolation Forest** | Tranzacții individuale neobișnuite | `scikit-learn` |
| **FP-Growth / PrefixSpan** | Asocieri și secvențe („la 2 zile după salariu → haine”, „bar → taxi”) | `mlxtend`, `prefixspan` |

---

## 6. Stratul 3 — Modele antrenate pe toți utilizatorii (la scară)

| Model | Scop | Abordare |
|---|---|---|
| Clasificator de categorii | Înlocuiește treptat fallback-ul LLM | TF-IDF pe descriere + regresie logistică / LightGBM, antrenat pe corecturile utilizatorilor |
| Comparații între utilizatori similari | „Cei cu venit similar cheltuie cu 30% mai puțin pe livrări” | Segmentare pe venit / context + percentile |
| Predicția riscului de final de lună | Avertizare la jumătatea lunii | Gradient boosting pe features de ciclu |

⚠️ Comparațiile între utilizatori necesită date agregate și anonimizate — de validat cu Business (GDPR).

---

## 7. Structura codului

### 7.1 Interfața comună ✅
Fiecare tipar este un **detector independent**, cu aceeași interfață. Detectorii se pot testa individual și se adaugă fără a modifica restul sistemului.

```python
@dataclass
class Pattern:
    type: str                  # "morning_spending", "daily_habit", "subscription", ...
    evidence: dict             # cifre concrete: counts, procente, merchant, interval orar
    support: int               # numărul de apariții
    confidence: float          # 0–1, din testul statistic / consistență
    monthly_impact_minor: int  # impact estimat, în bani / lună
    period: tuple[date, date]
    detector_version: str

class Detector(Protocol):
    name: str
    min_history_days: int
    def detect(self, txs: pd.DataFrame, profile: UserProfile) -> list[Pattern]: ...

DETECTORS: list[Detector] = [
    TimeOfDayDetector(),
    RecurringDetector(),
    PaydayCycleDetector(),
    CategoryAnomalyDetector(),
    ChangePointDetector(),
    UnusedSubscriptionDetector(),
]
```

### 7.2 Organizarea fișierelor 🟡
```
backend/app/analytics/
├── preprocessing/
│   ├── merchants.py        # normalizare + alias-uri + fuzzy matching
│   ├── timestamps.py       # extragerea orei din descriere
│   ├── categorize.py
│   └── salary.py
├── detectors/
│   ├── base.py             # Pattern, Detector
│   ├── time_of_day.py
│   ├── recurring.py
│   ├── payday_cycle.py
│   ├── category_anomaly.py
│   ├── change_point.py
│   └── unused_subscription.py
├── forecasting.py
├── validation.py           # praguri minime, teste statistice
├── ranker.py
└── pipeline.py             # rulare completă / incrementală
```

---

## 8. Validare și praguri (anti-zgomot) 🟡

Un tipar ajunge la utilizator doar dacă îndeplinește **toate** condițiile:

| Condiție | Prag implicit |
|---|---|
| Suport minim | ≥ 8 apariții |
| Răspândire în timp | pe ≥ 3 săptămâni diferite |
| Semnificație | p < 0.05 **sau** consistență în ≥ 2 din ultimele 3 luni |
| Impact | ≥ 50 lei / lună (`monthly_impact_minor ≥ 5000`) |
| Istoric minim | ≥ `min_history_days` al detectorului (implicit 60–90 zile) |

Pragurile sunt configurabile per detector și vor fi ajustate împreună cu Business pe baza feedback-ului.

**Pornire la rece:** sub ~3 luni de istoric, sistemul comunică explicit „mai am nevoie de date pentru X” în loc să afișeze tipare slabe.

---

## 9. Ranker

Alege ce tipare devin `Insight` și în ce ordine:

```
scor = impact_lunar × confidence × noutate × relevanță
```

| Factor | Sursă |
|---|---|
| `impact_lunar` | `monthly_impact_minor` normalizat |
| `confidence` | din detector |
| `noutate` | scade dacă tiparul a fost deja arătat (`seen`) sau respins (`dismissed`) |
| `relevanță` | crește dacă tiparul se leagă de o problemă declarată în `UserMemory` (ex. „nu știu unde se duc banii” → prioritate pentru obiceiuri) |

Limită: 🟡 maximum 3–5 insight-uri noi pe săptămână per utilizator.

---

## 10. Rulare

| Mod | Declanșator | Ce face |
|---|---|---|
| **Complet** | Job de noapte (EventBridge) + după fiecare import | Rulează toți detectorii pe tot istoricul, actualizează `Pattern` / `Insight` |
| **Incremental** | Eveniment `transaction.created` | Actualizează contoarele regulilor, recurențele afectate, soldul curent |

Rezultatele se salvează în DB (`patterns`, `insights`); tool-urile agentului citesc din aceste tabele, nu recalculează la fiecare mesaj.

---

## 11. Testare ✅

- Fiecare detector are teste unitare pe **persona seed** (vezi `CLAUDE.md` §9):
  - persona „Cafeaua zilnică” → `RecurringDetector` găsește `daily_habit`, `TimeOfDayDetector` găsește `morning_spending`;
  - persona „Finalul de lună” → `PaydayCycleDetector` găsește `end_of_cycle_shortage`;
  - persona „Sala nefolosită” → `UnusedSubscriptionDetector` găsește `unused_subscription`.
- **Teste negative:** o persona „echilibrată” fără probleme → nu trebuie să genereze tipare (verifică pragurile anti-zgomot).
- Detectorii sunt funcții pure (input: DataFrame + profil → output: listă de `Pattern`) — fără acces la DB în logica de detectare.

---

## 12. Plan de implementare

| Pas | Livrabil | Dependențe |
|---|---|---|
| 1 | Verificarea formatului CSV Raiffeisen (oră, MCC, descriere) | — |
| 2 | Generator de date seed cu persona-urile | Business validează persona-urile |
| 3 | Preprocesare: comercianți, oră, categorii, fix/discreționar, salariu | 1 |
| 4 | `base.py` + `RecurringDetector` + `PaydayCycleDetector` + teste | 2, 3 |
| 5 | `TimeOfDayDetector` + `UnusedSubscriptionDetector` + teste | 4 |
| 6 | Validare + ranker + salvare în `insights` | 4 |
| 7 | Expunere prin tool-uri pentru agent și endpointuri `/analytics/*` | 6, AI |
| 8 | `CategoryAnomalyDetector`, `ChangePointDetector`, forecasting | 6 |
| 9 | Stratul 2 (clustering, anomalii, asocieri) | V2 |

---

## 13. Decizii deschise ❓
- Formatul exact al exportului Raiffeisen (există ora? MCC?).
- Baseline-ul pentru tiparele orare înainte de a avea date de populație.
- Valorile finale ale pragurilor (împreună cu Business).
- pandas vs. polars (performanță vs. familiaritatea echipei).
