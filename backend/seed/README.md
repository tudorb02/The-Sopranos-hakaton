# Date seed pentru asistentul financiar

Generator determinist pentru șase persoane fictive din București. Folosește exclusiv biblioteca standard Python, fără backend, acces la rețea sau date personale reale. Versiunea Python minimă este 3.11; este compatibil cu versiunea 3.12 propusă în proiect.

## Rulare

Din rădăcina repository-ului, într-un mediu virtual:

```sh
python -m pip install -e '.[test]'
python -m seed.generate --end-date 2026-10-31 --months 6 --seed 42 --out backend/seed/output
python -m pytest
```

Instalarea editabilă face pachetul din `backend/seed/` disponibil pentru comanda `python -m seed.generate` inclusiv din rădăcina repository-ului. Pentru generare fără instalare:

```sh
PYTHONPATH=backend python -m seed.generate --end-date 2026-10-31 --months 6 --seed 42 --out backend/seed/output
```

Sau, din `backend/`:

```sh
python -m seed.generate --end-date 2026-10-31 --months 6 --seed 42 --out seed/output
```

`--months` acceptă 1–120 luni calendaristice, inclusiv luna lui `--end-date`. Intervalul implicit al exemplului este **01.05.2026–31.10.2026**, inclusiv. Dacă data finală este în interiorul lunii, ultima lună este parțială: garanțiile lunare se aplică lunilor complete. Sub 90 de zile, `expected_patterns.json` rămâne gol pentru a respecta pornirea la rece; generatorul poate fi folosit și pentru asemenea teste. Calendarul include suplimentar luna următoare datei finale.

Aceiași parametri și aceeași versiune produc fișiere identice octet cu octet, inclusiv la rulări în procese diferite. Seed-ul aleator este derivat separat pentru fiecare persona prin SHA-256. Nu se folosesc data curentă, UUID-uri aleatoare, `hash()` Python sau căi absolute în ieșire. Formatul monetar nu depinde de locale. Tranzacțiile sunt calculate exclusiv în bani întregi; nu se folosesc `float` pentru sume. Regenerarea suprascrie cele șase fișiere ale fiecărei persona și manifestul.

## Persona-uri

| ID | Venit lunar | Particularitate | Tipare așteptate |
|---|---:|---|---|
| `end_of_month` | 5.500 lei, pe 10 | 48–52% cheltuit în primele 7 zile; sold 45–85 lei în ultimele 5 zile ale ciclului | `end_of_cycle_shortage` |
| `daily_coffee` | 6.500 lei | 20–22 cafele de 25–35 lei, în zile lucrătoare, 07:30–09:45; o cafenea alternativă/lună | `daily_habit`, `morning_spending` |
| `unused_gym` | 6.800 lei | 18GYM, 230 lei pe 15; utilizare în primele 6 săptămâni, absentă în ultimele 90 zile | `subscription`, `unused_subscription` |
| `birthday_month` | 8.000 lei | Istoric cu 1/4/1/5/2/1 aniversări și cheltuieli asociate; 10 aniversări luna următoare | `upcoming_spike` |
| `goal_2000` | 7.000 lei | Surplus lunar 220–380 lei; sală utilizată, disponibilitate de renunțare pentru bicicletă de 2.000 lei | `subscription` |
| `balanced` | 7.500 lei | Rezervă, distribuție orară proporțională cu orele active, comercianți discreționari variați | listă goală |

Fondul comun conține chirie, energie/gaz/telecom, aproximativ 12 vizite la supermarket/lună, transport, farmacie, livrări, cumpărături și streaming. Comercianții de supermarket și cafeneaua principală au alias-uri de tip `MEGA IMAGE 0123`, `MEGAIMAGE*456`, `Mega Image SRL`. Cafeneaua Orizont, barurile, restaurantele aniversare și persoanele sunt fictive.

Datele surprind coșuri și comportamente plauzibile, nu un catalog de prețuri sau tarife comerciale garantate pentru 2026. Ca reper de ordin de mărime, [18GYM publică planuri la patru săptămâni](https://18gym.ro/abonamente/); abonamentul **lunar de 230 lei din seed este un contract fictiv negociat**, ales pentru scenariul cerut. Facturile și coșurile variază; chiria și tarifele abonamentelor sunt stabile. Cumpărăturile mici din `daily_coffee` reprezintă accesorii sau consumabile.

## Fișiere și interpretare

În fiecare director de persona:

- `transactions.csv`: cele șase coloane din contract, UTF-8 fără BOM, separator `;`, zecimale `,`, newline LF, date `dd.mm.yyyy`. Exact unul dintre Debit/Credit este completat, cu valoare pozitivă și două zecimale.
- `profile.json`: exact câmpurile cerute; sume în bani, probleme și context în română. Contextul sălii precizează sursa conectată; absența semnalelor nu trebuie confundată cu absența integrării.
- `usage_signals.json`: utilizări ale sălii, cu offset ISO-8601 din `Europe/Bucharest`. `unused_gym` are doar semnale timpurii; `goal_2000` are utilizări recente. Celelalte liste sunt goale deoarece nu există abonamente cu utilizare monitorizată.
- `calendar_events.json`: evenimente istorice și viitoare pentru scenariul aniversărilor; liste goale în celelalte scenarii.
- `expected_patterns.json`: tipare și explicații; `min_confidence` este inclus doar pentru semnificația statistică verificabilă a cheltuielilor matinale. Nu se inventează un scor pentru detectorii fără formulă de confidence definită.
- `chat_scenarios.json`: 3–4 mesaje românești și numele tool-urilor din `CLAUDE.md` §8.2. Mesajele pentru tool-uri de modificare includ confirmarea explicită a utilizatorului.

`manifest.json` conține versiunea, parametrii, lista ordonată a persona-urilor și statistici în bani: sold inițial/final, încasări, cheltuieli și număr de tranzacții. Soldul inițial nu este o încasare și nu primește un rând artificial în CSV. Media lunară se calculează din totaluri împărțite la `months`; la o lună finală parțială, aceasta nu este o medie pe luni complete.

## Presupuneri despre Raiffeisen și integrare

Formatul real de export rămâne o decizie deschisă în proiect. CSV-ul implementează **contractul cerut pentru acest fixture**, fără a pretinde că reproduce toate exporturile băncii:

1. Rândurile sunt ordonate crescător după data înregistrării, apoi data și ora tranzacției și descriere. `Sold` este soldul contabil după fiecare rând, inclusiv la mai multe tranzacții în aceeași zi.
2. POS conține data tranzacției, ora opțională și comerciantul, apoi `BUCURESTI`. Aproximativ 10% din plățile cu cardul nu au oră. Ele trebuie importate cu precizie `day` și excluse din detectorii orari. Cafelele păstrează minimum 18 ore observabile pe lună completă.
3. Decalajul decontării este 0–2 zile lucrătoare, definite aici ca luni–vineri. Sărbătorile legale nu sunt modelate. Decontarea în aceeași zi este posibilă și în weekend; plățile de la marginea extrasului pot avea decontare imediată. Salariul din weekend se mută în vinerea anterioară.
4. Ora din POS este locală, fără offset în CSV; importerul trebuie să aplice `Europe/Bucharest` înainte de conversia UTC. JSON-urile includ offsetul corect, inclusiv schimbarea de oră din octombrie.
5. Nu există MCC, IBAN, valută străină, comisioane sau rând separat pentru soldul inițial. Moneda este RON. Debit/Credit pozitive în CSV devin sume negative/pozitive în modelul intern.
6. Pentru `end_of_month` se generează intern și ciclul salarial anterior începutului extrasului, pentru un sold inițial și o primă perioadă critică matematic corecte. Numai rândurile înregistrate în intervalul cerut se exportă. Șase luni calendaristice nu sunt șase cicluri salariale complete: testele verifică și finalul ciclului început înainte de extras.

La începerea implementării, `api/openapi.yaml` și detectorii backend nu existau în repository. Nu se introduce sau modifică un contract API. Fixture-urile și documentarea pragurilor sunt în zona Backend; echipele AI și Frontend consumă aceleași fișiere fără conversii suplimentare ale structurii JSON.

## Praguri și prevenirea rezultatelor false

Pragurile per detector aprobate pentru acest task sunt documentate în [pattern-recognition.md §8.1](../../docs/pattern-recognition.md): minimum 3 plăți pentru abonamente lunare, respectiv minimum 2 din ultimele 3 cicluri pentru lipsa banilor. Pragul generic de 8 apariții se păstrează pentru obiceiuri. Acestea sunt așteptări de integrare, nu modificări ale unor detectori existenți.

- Cafeaua zilnică este evaluată pe zile lucrătoare; weekendurile nu întrerup rutina. Ponderea de aproximativ 60% se referă la **numărul** plăților discreționare cu oră, conform exemplului detectorului, nu la valoarea în lei. Cafeneaua principală depășește suportul, durata și impactul minim; testul binomial folosește baseline 18%.
- În toate persona-urile, streamingul alternează între Netflix, Spotify și HBO Max, câte o lună fără reînnoire automată. Fiecare serviciu apare de două ori în șase luni, la circa 90 de zile. Prin urmare nu se așteaptă abonamente lunare sau abonamente nefolosite la streaming. Chiria și facturile sunt cheltuieli fixe, nu abonamente comerciale de optimizat.
- Sala este facturată lunar la sumă constantă; se verifică separat intervalul median, CV < 0,15 și disponibilitatea sursei de utilizare.
- Pentru aniversări, costul per eveniment se estimează din cadouri, flori și mese aniversare asociate datelor din calendar. Costul celor 10 evenimente depășește 25% din cheltuiala lunară istorică medie. Pragul de 25% este un criteriu de test pentru fixture; documentul detectorului nu stabilește încă un procent obligatoriu pentru `upcoming_spike`.
- Bugetele normale pe categorii au variație limitată și coșuri individuale variabile. Testele verifică absența unei anomalii pozitive în ultima lună (z-score robust > 3, impact ≥50 lei), conform §4.4. Lunile aniversare istorice sunt intenționat mai costisitoare și pot fi anomalii dacă sunt analizate retrospectiv ca „lună curentă”.
- Controlul negativ are maximum o vizită/lună la fiecare comerciant discreționar, fără suportul pentru obiceiuri. Distribuția orelor se compară cu baseline-ul 07–24 prin chi-pătrat; toate abonamentele la sală din scenariile pozitive au sursa explicită în context.

## Teste

Testele din `tests/` citesc CSV și JSON și nu importă detectori backend. Normalizarea comercianților, reconstruirea soldurilor, gruparea pe categorii și calculele statistice sunt independente de implementarea generatorului. Se verifică trei seed-uri (42, 7, 2026), generarea identică într-un proces nou și concordanța exactă cu fișierele versionate, plus margini de calendar (an bisect, schimbare de an, lună parțială, 12 luni) și argumente invalide.

Nu este suficient să treacă un detector implementat ulterior: la modificarea generatorului se rulează întâi aceste teste independente, apoi testele de integrare ale detectorilor. Fixture-urile se regenerează cu comanda de mai sus și se commit-uiesc împreună cu modificarea generatorului. Nu se corectează manual CSV-urile.

## Adăugarea unei persona

1. Creează `personas/<id>.py`, exportând `PERSONA = Persona(...)`; folosește bani întregi, nume fictive și 3–5 scenarii cu tool-uri existente.
2. Înregistrează configurația în `personas/__init__.py`. Ordinea explicită stabilizează manifestul; seed-ul fiecărei persona este independent de ordinea listei.
3. Pentru un comportament nou, adaugă o opțiune în `personas/base.py` și implementarea în `Builder`, păstrând generatorul comun de zgomot de fond.
4. Definește așteptările în `expected_patterns()`, cu suport, impact și istoric suficiente. Dacă ai nevoie de o excepție de prag, documenteaz-o înaintea implementării detectorului.
5. Adaugă teste independente pentru proprietatea promisă și absența alertelor colaterale. Actualizează lista de ID-uri a testelor, regenerează `output/` și rulează suita completă.
