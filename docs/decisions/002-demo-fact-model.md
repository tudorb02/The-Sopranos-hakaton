# 002 — Modelul de date al demo-ului: fapte, nu texte de ecran

## Context

API-ul Node (`server/`) a fost construit pornind de la obiectele hardcodate ale
frontend-ului. Seed-ul păstra textele ecranelor cu cifre și date înghețate
(„3.020 lei”, „5 nov. – 4 dec.”, „Analizez ultimele 24 de luni”). Mai păstra și
stări simulate: un extras „Se procesează” blocat la 60%, o analiză la „1.362 din
1.946”, un badge „1 necitit”. Un fișier încărcat era salvat și marcat imediat
„Procesat”, fără să fie citit.

## Decizie

- **Seed-ul conține numai fapte**:
  - un istoric bancar de 12 luni, generat determinist din tipare (`server/src/history.js`);
  - tranzacțiile perioadei curente, obligații, venituri așteptate, bugete și obiective;
  - pușculițe, abonamente cu semnale de utilizare, evenimente de calendar;
  - memoria utilizatorului și mesaje cu dată.

  Textele care conțin cifre sunt șabloane `{{cheie}}`, completate în
  `read-model.js` din valori calculate. Un test verifică faptul că seed-ul nu mai
  conține cifre în afara șabloanelor; excepție fac doar termenii produselor
  băncii.
- **Starea inițială trece prin fluxul real.** Seed-ul rulează același import din
  cont și aceeași analiză (`server/src/coach.js`, `analysis.js`) ca API-ul, la data
  activării din scenariu (28.10.2026). Insight-urile salvate (`insights`) au
  payload numeric. Constatările, observațiile din Profil și pașii analizei sunt
  randate din ele.
- **Extrasele CSV sunt citite de backend-ul Python**, prin API-ul lui public
  (`POST /api/v1/accounts/import`, `GET /api/v1/transactions`). Fiecare persoană
  demo are un utilizator Python dedicat, creat de
  `backend/scripts/create_demo_users.py` (`make demo-users`). Rândurile sunt
  adăugate ca alt cont, deduplicate după id-ul Python. PDF/XLS sunt salvate și
  marcate onest „în demo citesc doar extrase CSV”. Dacă Python nu răspunde,
  importul devine `failed/parser_unavailable`.
- **Chat-ul nu inventează răspunsuri.** Mesajele se salvează cu dată, iar UI-ul
  arată explicit că demo-ul nu răspunde încă. Contorul de mesaje necitite vine
  din `messages.read_at`.
- **Fără ramuri pe persoană.** Comportamentul vine din date: `budget_method`,
  `note_style`, `group_key`, regulile obiectivelor și sursele agendei.

## Consecințe

- Migrația `002-realistic-model.sql` înlocuiește tabelele v1. Datele demo
  (fictive) se reîncarcă o singură dată, la seed-ul `facts-v2`.
- Unele cifre diferă de prototipul inițial, pentru că acum sunt calculate. De
  exemplu: 788 de plăți importate, nu 978; istoric de 12 luni, nu 24; 64% din
  cheltuieli în primele 10 zile, nu 55%. Testele fixează valorile pe care
  scenariul le definește (perioada, bugetele, constatările, obiectivele).
- Atinge zona Backend doar prin endpointuri existente și un script de dezvoltare.
  Contractul `api/openapi.yaml` nu se schimbă.
- Nu sunt modelate încă `Notification` persistente (mesajele regulilor se
  calculează la citire) și `UpcomingExpense` (costurile cadourilor se calculează
  din evenimente și alegerile utilizatorului).
