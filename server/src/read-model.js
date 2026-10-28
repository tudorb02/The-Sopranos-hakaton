// Builds every personal screen from stored facts. Totals, counts, dates and the
// numbers inside sentences are computed here; the seed only holds facts and copy templates.
import { pattern, recurringGroups, completeCycles } from "./analysis.js";
import {
  count,
  dateRange,
  dayMonth,
  dayMonthShort,
  dayMonthYear,
  formatLei,
  interpolate,
  list,
  monthLong,
  monthRange,
  monthShort,
  monthSpans,
  monthYear,
  monthsBack,
  ordinal,
  relativeDay,
  roundedLei,
} from "./copy.js";
import { day, json } from "./db.js";
import { addDays, capitalize, dayLabels, daysBetween, label, monday } from "./dates.js";
import { ApiError } from "./errors.js";
import { cycleStart, nextCycleStart } from "./history.js";
import { lei, percent, ro, roundLei, safeInteger, sum } from "./money.js";
import { catalog } from "./seed.js";

export async function accountFor(db, slug) {
  const result = await db.query("SELECT * FROM demo_accounts WHERE slug=$1", [slug]);
  if (!result.rowCount) throw new ApiError(404, "Contul demo nu există.", "not_found");
  return result.rows[0];
}

const TABLES = [
  "merchants",
  "merchant_rules",
  "imports",
  "subscriptions",
  "usage_signals",
  "commitments",
  "expected_incomes",
  "budgets",
  "goals",
  "pots",
  "calendar_events",
  "questions",
  "user_memory",
  "messages",
  "services",
  "analysis_runs",
  "insights",
  "access_log",
  "decisions",
];
const JSON_COLUMNS = ["display", "splits", "notify", "rule", "schedule", "funding", "copy", "definition", "answer", "body", "payload", "steps"];
const DATE_COLUMNS = ["local_date", "period_from", "period_to", "expected_on", "paused_until", "starts_on", "planned_on", "event_month", "as_of", "birth_date"];
const BOOLEAN_COLUMNS = ["excluded", "has_app", "monitored", "certain", "on_home", "gifts", "has_categories"];
const MONEY_COLUMNS = ["amount_minor", "limit_minor", "target_minor", "opening_minor", "ledger_opening_minor"];
// PostgreSQL returns TIMESTAMPTZ as Date; SQLite returns the stored text. Both become ISO strings.
const instant = (value) => (value == null ? value : new Date(value).toISOString());
function normalize(row) {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (JSON_COLUMNS.includes(key)) result[key] = json(result[key]);
    else if (DATE_COLUMNS.includes(key)) result[key] = day(result[key]);
    else if (BOOLEAN_COLUMNS.includes(key)) result[key] = Boolean(result[key]);
    else if (MONEY_COLUMNS.includes(key) && result[key] != null) result[key] = safeInteger(result[key]);
    else if (/_at$/.test(key)) result[key] = instant(result[key]);
  }
  return result;
}

export async function loadModel(db, slug, lock = false) {
  const account = normalize(await accountFor(db, slug));
  const result = await db.query(
    `SELECT * FROM personas WHERE account_id=$1${lock && db.dialect !== "sqlite" ? " FOR UPDATE" : ""}`,
    [account.id],
  );
  if (!result.rowCount)
    throw new ApiError(410, "Coach-ul este dezactivat. Îl poți reactiva din Produse.", "coach_disabled");
  const persona = normalize(result.rows[0]);
  const model = {
    account: { ...account, client: json(account.client), presentation: json(account.presentation) },
    persona,
    templates: json(persona.templates),
    preferences: json(persona.preferences),
  };
  // Sequential on the same connection so transaction snapshots stay consistent.
  for (const table of TABLES)
    model[table] = (await db.query(`SELECT * FROM ${table} WHERE persona_id=$1`, [persona.id])).rows.map(normalize);
  model.documents = (
    await db.query(
      "SELECT id,kind,transaction_id,name,mime,size_bytes,status,error_code,created_at FROM documents WHERE persona_id=$1",
      [persona.id],
    )
  ).rows.map(normalize);
  const merchants = new Map(model.merchants.map((merchant) => [merchant.id, merchant.name]));
  model.transactions = (
    await db.query("SELECT * FROM transactions WHERE persona_id=$1", [persona.id])
  ).rows
    .map(normalize)
    .map((tx) => ({ ...tx, merchant: merchants.get(tx.merchant_id) }))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || b.legacy_id.localeCompare(a.legacy_id, "en", { numeric: true }));
  return model;
}

const bucharest = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" });
export const localTime = (instantValue) => bucharest.format(new Date(instantValue));
export const localDay = (instantValue) => localDate.format(new Date(instantValue));
const ordered = (rows) => [...rows].sort((a, b) => a.sort_order - b.sort_order);
const negative = (tx) => tx.amount_minor < 0 && !tx.excluded;
const expense = (tx) => negative(tx) && ["fixed", "variable"].includes(tx.kind);
const spent = (rows) => sum(rows.map((tx) => -tx.amount_minor));
const slugKey = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");
const pick = (obj, keys) => Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));
const latest = (rows, key) => [...rows].sort((a, b) => String(b[key]).localeCompare(String(a[key])))[0];
const between = (date, from, to) => date >= from && date <= to;
const AGE_BANDS = [[18, 24], [25, 34], [35, 44], [45, 54], [55, 64]];

// The coach reads the live current period and whatever the user imported.
export function ledgerView(model, today) {
  const start = cycleStart(today, model.persona.income_day);
  const available = model.transactions.filter(
    (tx) => tx.import_id || (tx.account_key === "current" && tx.local_date >= start),
  );
  return {
    rows: available,
    ledger: model.transactions.filter((tx) => tx.account_key === "current"),
    opening_minor: model.account.ledger_opening_minor,
  };
}

export function analysisFacts(model) {
  const signals = new Map();
  for (const signal of model.usage_signals) {
    if (!signals.has(signal.subscription_id)) signals.set(signal.subscription_id, []);
    signals.get(signal.subscription_id).push(localDay(signal.occurred_at));
  }
  const needs = needsTotal(model);
  return {
    income_day: model.persona.income_day,
    income_pattern: model.templates.income.merchant_pattern,
    config: model.preferences.analysis,
    subscriptions: model.subscriptions.map((sub) => ({ ...sub, signals: signals.get(sub.id) ?? [] })),
    events: model.calendar_events,
    needs_minor: needs || null,
  };
}

// Monthly needs: limits of the "necesare" envelopes, or the last payment of a paid one.
function needsTotal(model) {
  return sum(
    model.budgets
      .filter((budget) => budget.group_key === "necesare")
      .map((budget) => {
        if (budget.limit_minor) return budget.limit_minor;
        const last = latest(
          model.transactions.filter((tx) => tx.category === budget.category && tx.amount_minor < 0),
          "occurred_at",
        );
        return last ? -last.amount_minor : 0;
      }),
  );
}

export function present(model, today, { strict = false } = {}) {
  const t = structuredClone(model.templates);
  const p = {};
  const envelopes = model.persona.budget_method === "envelopes";
  const incomeDay = model.persona.income_day;
  const start = cycleStart(today, incomeDay);
  const end = addDays(nextCycleStart(start, incomeDay), -1);
  const previousStart = cycleStart(addDays(start, -1), incomeDay);
  const view = ledgerView(model, today);
  const txs = view.rows;
  const current = txs.filter((tx) => tx.account_key === "current" && between(tx.local_date, start, today) && tx.local_date <= end);
  const categories = { ...catalog.categories, ...(model.preferences.categories ?? {}) };
  const variable = current.filter((tx) => negative(tx) && tx.kind === "variable");
  const paidFixed = current.filter((tx) => negative(tx) && tx.kind === "fixed");
  const incomeRows = current.filter((tx) => tx.kind === "income");
  const incoming = sum(incomeRows.map((tx) => tx.amount_minor));
  const saved = spent(current.filter((tx) => tx.amount_minor < 0 && tx.kind === "saving"));
  const plannedFixed = sum(model.commitments.map((item) => item.amount_minor));
  const opening = sum([model.account.ledger_opening_minor, ...view.ledger.filter((tx) => tx.local_date < start).map((tx) => tx.amount_minor)]);
  const total = sum([opening, incoming]);
  const spendable = total - saved - (envelopes ? 0 : plannedFixed);
  const spentTotal = spent(envelopes ? current.filter(expense) : variable);
  const left = spendable - spentTotal;
  const daysLeft = Math.max(1, daysBetween(today, end) + 1);
  const perDay = roundLei(Math.max(0, left), daysLeft);
  const firstMonday = monday(today);
  const weekdays = Array.from({ length: 7 }, (_, index) => addDays(firstMonday, index));
  const categoryAmounts = (rows) => {
    const values = {};
    for (const tx of rows) {
      const entries = tx.splits.length ? tx.splits : [{ category: tx.category, amount_minor: -tx.amount_minor }];
      for (const entry of entries)
        values[entry.category] = sum([values[entry.category] ?? 0, safeInteger(entry.amount_minor)]);
    }
    return values;
  };
  const variableByCategory = categoryAmounts(variable);
  const allByCategory = categoryAmounts(current.filter((tx) => expense(tx) || (negative(tx) && tx.kind === "pot")));
  const runs = [...model.analysis_runs].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const run = runs.at(-1);
  const insights = run ? model.insights.filter((item) => item.run_id === run.id) : [];
  const insight = (type) => insights.find((item) => item.type === type)?.payload;
  const accountImports = model.imports.filter((item) => item.source === "account" && item.status === "done");
  const lastImport = latest(accountImports, "created_at");
  const imported = txs.filter((tx) => tx.import_id);
  const historyMonths = [...new Set(imported.filter((tx) => tx.account_key === "current").map((tx) => tx.local_date.slice(0, 7)))].sort();
  const coverageEnd = lastImport?.period_to ?? null;
  const fullCycles = coverageEnd
    ? completeCycles(imported.filter((tx) => tx.account_key === "current"), incomeDay, addDays(coverageEnd, 1))
    : [];
  const periodRows = (cycle) => txs.filter((tx) => tx.account_key === "current" && between(tx.local_date, cycle.start, cycle.end));
  const answers = Object.fromEntries(model.questions.map((question) => [question.question_key, question.answer]));
  const memory = Object.fromEntries(model.user_memory.map((item) => [item.memory_key, item]));
  const before = txs.filter((tx) => tx.account_key === "current" && tx.local_date < start);
  const recurringPatterns = new Set(
    recurringGroups(before, completeCycles(before, incomeDay, start)).map((group) => group.pattern),
  );

  // Shared values for copy templates.
  const v = {};
  const mainIncome = latest(
    txs.filter((tx) => tx.kind === "income" && pattern(tx.description_raw).startsWith(t.income.merchant_pattern)),
    "occurred_at",
  );
  const incomeHistory = fullCycles
    .map((cycle) => periodRows(cycle).find((tx) => tx.kind === "income" && pattern(tx.description_raw).startsWith(t.income.merchant_pattern)))
    .filter(Boolean);
  const nextIncome = [...model.expected_incomes]
    .filter((item) => item.certain && item.expected_on > today)
    .sort((a, b) => a.expected_on.localeCompare(b.expected_on))[0];
  Object.assign(v, {
    "income.label": t.income.label,
    "income.noun": t.income.noun,
    "income.kind": t.income.kind,
    "income.day": incomeDay,
    "income.next_date": dayMonth(nextIncome?.expected_on ?? addDays(end, 1)),
    "income.amount": mainIncome ? formatLei(mainIncome.amount_minor) : null,
    "income.average": incomeHistory.length
      ? roundedLei(sum(incomeHistory.map((tx) => tx.amount_minor)) / incomeHistory.length, 100)
      : null,
    "cycle.total": formatLei(total),
    "cycle.incoming": formatLei(incoming),
    "cycle.opening": formatLei(opening),
    "cycle.month": monthLong(start),
    "cycle.previous_month": monthLong(previousStart),
    "cycle.income_date": incomeRows[0] ? dayMonth(incomeRows[0].local_date) : null,
    "cycle.ends_on": dayMonth(end),
    "cycle.end_day": Number(end.slice(8)),
    "cycle.weekly": roundedLei((spendable * 7) / (daysBetween(start, end) + 1), 10),
    "fixed.monthly": formatLei(plannedFixed),
    "needs.total": formatLei(needsTotal(model)),
    "client.first_name": model.account.client.firstName,
    "history.label": historyMonths.length
      ? `${count(historyMonths.length, "lună", "luni")}, ${monthRange(`${historyMonths[0]}-01`, `${historyMonths.at(-1)}-01`)}`
      : null,
  });
  const age = Number(today.slice(0, 4)) - Number(model.account.birth_date.slice(0, 4)) - (today.slice(5) < model.account.birth_date.slice(5) ? 1 : 0);
  const band = AGE_BANDS.find(([from, to]) => age >= from && age <= to);
  v["client.age_band"] = band ? `${band[0]}–${band[1]}` : null;
  for (const [key, item] of Object.entries(memory)) {
    v[`memory.${key}`] = item.amount_minor != null ? formatLei(item.amount_minor) : item.content;
    v[`memory.${key}.date`] = dayMonth(localDay(item.created_at));
  }
  for (const [key, answer] of Object.entries(answers)) {
    v[`answer.${key}`] = answer.selected.length ? answer.selected.join(", ") : null;
    for (const [field, value] of Object.entries(answer.fields)) v[`answer.${key}.${field}`] = value || null;
  }
  for (const budget of model.budgets)
    v[`budget.${budget.budget_key}.limit`] = budget.count_limit ?? (budget.limit_minor ? formatLei(budget.limit_minor) : null);
  for (const sub of model.subscriptions) v[`subscription.${slugKey(sub.subscription_key)}.amount`] = formatLei(sub.amount_minor);
  const shortage = insight("end_of_month_shortage");
  if (shortage)
    Object.assign(v, {
      "insight.shortage.hit": shortage.hit,
      "insight.shortage.total": shortage.total,
      "insight.shortage.threshold": formatLei(shortage.threshold_minor),
      "insight.shortage.from_day": shortage.from_day,
    });
  const render = (value, local = {}) => interpolate(value, { ...v, ...local }, { soft: !strict });

  p.today = { label: capitalize(label(today, { weekday: "long", day: "numeric", month: "long" })) };
  const client = model.account.client;
  p.client = {
    firstName: client.firstName,
    name: `${client.firstName} ${client.lastName}`,
    initial: client.firstName[0],
    segment: client.segment,
    card: client.card,
  };
  if (model.persona.has_categories || model.preferences.categories) p.categories = categories;

  p.cycle = {
    label: dateRange(start, end),
    endsOn: dayMonth(end),
    ...render(t.cycle),
    total: lei(total),
    ...(envelopes ? {} : { fixed: lei(plannedFixed), setAside: lei(saved) }),
    spendable: lei(spendable),
    spent: lei(spentTotal),
    left: lei(left),
    perDay,
    daysLeftLabel: count(daysLeft, "zi", "zile"),
  };
  if (envelopes) {
    const completed = Math.max(1, daysBetween(start, today));
    const pace = roundLei(spent(variable.filter((tx) => tx.local_date < today)), completed);
    const lasts = pace > 0 ? addDays(today, Math.floor(Math.max(0, left) / (pace * 100))) : end;
    p.cycle.pace = `La ritmul de până acum, circa ${pace} lei pe zi, banii îți ajung până pe ${dayMonth(lasts)}.`;
  }

  // Summary headline: computed now from the ledger, or from the last analysis.
  if (t.insight.kind === "front_loading") {
    const window = t.insight.window_days;
    const share = (from, rows, base) => percent(spent(rows.filter((tx) => negative(tx) && tx.kind === "variable" && tx.local_date < addDays(from, window))), base);
    const previous = txs.filter((tx) => tx.account_key === "current" && between(tx.local_date, previousStart, addDays(start, -1)));
    const previousOpening = sum([model.account.ledger_opening_minor, ...view.ledger.filter((tx) => tx.local_date < previousStart).map((tx) => tx.amount_minor)]);
    const previousBase =
      previousOpening +
      sum(previous.filter((tx) => tx.kind === "income").map((tx) => tx.amount_minor)) -
      spent(previous.filter((tx) => tx.amount_minor < 0 && tx.kind === "saving")) -
      plannedFixed;
    p.insight = previous.length
      ? render({ figure: t.insight.figure, text: t.insight.text }, {
          "insight.share": share(start, current, spendable),
          "insight.window_days": window,
          "insight.previous_month": monthLong(previousStart),
          "insight.previous_share": share(previousStart, previous, previousBase),
        })
      : null;
  } else {
    const ranOut = insight("ran_out");
    p.insight = ranOut
      ? render({ figure: t.insight.figure, text: t.insight.text }, {
          "insight.short_days": ranOut.avg_days,
          "insight.months_span":
            ranOut.months.length > 1
              ? `din ${monthLong(`${ranOut.months[0]}-01`)} până în ${monthLong(`${ranOut.months.at(-1)}-01`)}`
              : `în ${monthLong(`${ranOut.months[0]}-01`)}`,
        })
      : null;
  }

  // Budgets and their notes.
  const birthdaysIn = (from, to) => model.calendar_events.filter((event) => event.type === "birthday" && between(event.starts_on, from, to));
  const budgetCost = (budget) => {
    const rows = current.filter((tx) => negative(tx) && (budget.period !== "week" || tx.local_date >= firstMonday));
    const amount = sum(
      rows.flatMap((tx) =>
        tx.splits.length
          ? tx.splits.filter((entry) => entry.category === budget.category).map((entry) => entry.amount_minor)
          : tx.category === budget.category
            ? [-tx.amount_minor]
            : [],
      ),
    );
    return { rows: rows.filter((tx) => tx.category === budget.category), amount };
  };
  const dueDate = (category) => {
    const item = model.commitments.find((commitment) => commitment.category === category && commitment.due_day);
    if (!item) return null;
    let date = `${start.slice(0, 8)}${String(item.due_day).padStart(2, "0")}`;
    if (date < start) date = `${addDays(end, 1).slice(0, 8)}${String(item.due_day).padStart(2, "0")}`;
    return date;
  };
  const remainingOf = (budget) => Math.max(0, safeInteger(budget.limit_minor ?? 0) - (allByCategory[budget.category] ?? 0));
  const budgetNote = (budget, used, cost, short = false) => {
    const [one, many] = (budget.description ?? "|").split("|");
    switch (budget.note_style) {
      case "count":
        return budget.kind === "count"
          ? `${used} din ${budget.count_limit} ${budget.period === "week" ? "săptămâna aceasta · următoarea, de luni" : "în această perioadă"}`
          : `${count(used, one, many)} luna aceasta`;
      case "pace":
        return `${percent(cost, budget.limit_minor)}% din buget, în primele ${daysBetween(start, today) + 1} zile ale perioadei`;
      case "occasions":
        return `${used} din ${birthdaysIn(start, end).length} ocazii, din banii puși deoparte`;
      case "per_day": {
        const amount = `Circa ${roundLei(remainingOf(budget), daysLeft)} lei pe zi`;
        return short ? amount : `${amount} până pe ${dayMonth(end)}`;
      }
      case "limit":
        return cost >= budget.limit_minor ? "Limita lunii atinsă" : `Mai ai ${formatLei(budget.limit_minor - cost)} lei`;
      case "paid": {
        const last = latest(current.filter((tx) => tx.category === budget.category && tx.amount_minor < 0), "occurred_at");
        if (!last) return "Încă neplătit în această perioadă";
        return `${budget.description ? `${budget.description}, plătit` : "Plătit"} pe ${dayMonth(last.local_date)}`;
      }
      case "due": {
        const date = dueDate(budget.category);
        return date ? (short ? `Pe ${dayMonth(date)}` : `Se plătește pe ${dayMonth(date)}`) : null;
      }
      case "description":
        return budget.description;
      case "agreed":
        return `Pauză până în ${monthLong(budget.paused_until)}, cum am stabilit`;
      default:
        return "Stabilit de tine";
    }
  };
  p.budgets = ordered(model.budgets).map((budget) => {
    const { rows, amount } = budgetCost(budget);
    const item = {
      id: budget.budget_key,
      ...(budget.group_key ? { group: budget.group_key } : {}),
      name: budget.name,
      icon: budget.icon,
      kind: budget.kind,
    };
    if (budget.kind === "count") Object.assign(item, { used: rows.length, max: budget.count_limit });
    else if (["amount", "paid", "protected"].includes(budget.kind)) item.spent = lei(amount);
    if (budget.kind === "amount") item.limit = lei(budget.limit_minor);
    if (budget.warn_at_percent && percent(amount, budget.limit_minor) >= budget.warn_at_percent) item.warn = true;
    item.note = budgetNote(budget, rows.length, amount);
    if (budget.on_home) item.onHome = true;
    return item;
  });
  p.allocation = t.allocation.map((item) => {
    const needs = sum(model.budgets.filter((b) => b.group_key === "necesare").map((b) => b.limit_minor ?? allByCategory[b.category] ?? 0));
    const amount =
      item.id === "aside" ? saved : item.id === "fixed" ? plannedFixed : item.id === "needs" ? needs : spendable - (envelopes ? needs : 0);
    return { ...item, lei: lei(amount) };
  });
  if (t.essentials) {
    const byKey = Object.fromEntries(model.budgets.map((budget) => [budget.budget_key, budget]));
    let essentialTotal = 0;
    const items = t.essentials.items.map((entry) => {
      const budgets = entry.budgets.map((key) => byKey[key]);
      const base = { name: entry.name, icon: entry.icon };
      if (budgets.every((budget) => budget.kind === "paid")) {
        const paid = budgets.map((budget) => latest(current.filter((tx) => tx.category === budget.category && tx.amount_minor < 0), "occurred_at"));
        if (paid.every(Boolean))
          return { ...base, note: `${formatLei(spent(paid))} lei, plătite pe ${dayMonth(latest(paid, "occurred_at").local_date)}`, status: "Plătite" };
        return { ...base, note: "Urmează să le plătești" };
      }
      const remaining = sum(budgets.map(remainingOf));
      essentialTotal += remaining;
      return { ...base, note: budgetNote(budgets[0], 0, 0, true), lei: lei(remaining) };
    });
    const pending = model.expected_incomes.find((item) => !item.certain && between(item.expected_on, today, end));
    v["essentials.rest"] = formatLei(left - essentialTotal);
    p.essentials = {
      title: render(t.essentials.title),
      total: lei(essentialTotal),
      items,
      rest: { ...t.essentials.rest, lei: lei(left - essentialTotal) },
      ...(pending
        ? {
            pending: render(t.essentials.pending, {
              "pending.name": pending.name,
              "pending.amount": formatLei(pending.amount_minor),
              "pending.date": dayMonth(pending.expected_on),
            }),
          }
        : {}),
    };
  }
  p.budgetGroups = render(t.budgetGroups);

  // Rule-engine messages, newest first: a count budget reaching its limit, or a saving rule applied.
  const notifications = [];
  for (const budget of model.budgets.filter((item) => item.notify && item.kind === "count")) {
    const weekRows = current.filter((tx) => negative(tx) && tx.category === budget.category && tx.local_date >= firstMonday);
    if (weekRows.length < budget.count_limit) continue;
    const trigger = weekRows[budget.count_limit - 1];
    const habitRows = fullCycles.slice(-3).flatMap((cycle) => periodRows(cycle).filter((tx) => negative(tx) && tx.category === budget.category));
    const weeks = fullCycles.length ? daysBetween(fullCycles.slice(-3)[0].start, fullCycles.at(-1).end) / 7 : 1;
    const price = habitRows.length ? spent(habitRows) / habitRows.length : 0;
    const saving = Math.max(0, (habitRows.length / weeks - budget.count_limit) * price);
    notifications.push({
      at: trigger.occurred_at,
      icon: budget.notify.icon,
      label: budget.name,
      ...interpolate({ title: budget.notify.title, text: budget.notify.text }, { ordinal: ordinal(budget.count_limit), saving: roundedLei(saving, 10) }),
    });
  }
  for (const goal of model.goals.filter((item) => item.rule && item.copy.notify)) {
    const savings = txs.filter((tx) => tx.pot_key === goal.goal_key && tx.kind === "saving");
    const last = savings.at(-1);
    if (!last) continue;
    const source = latest(txs.filter((tx) => tx.kind === "income" && tx.occurred_at <= last.occurred_at && tx.amount_minor >= goal.rule.min_income_minor), "occurred_at");
    const before = goal.opening_minor + spent(savings.filter((tx) => tx.occurred_at <= last.occurred_at));
    notifications.push({
      at: last.occurred_at,
      icon: goal.copy.notify.icon,
      label: goal.name,
      ...interpolate({ title: goal.copy.notify.title, text: goal.copy.notify.text }, {
        amount: formatLei(-last.amount_minor),
        percent: goal.rule.percent,
        income: source ? formatLei(source.amount_minor) : "",
        income_name: source ? (source.display.name ?? source.merchant).toLocaleLowerCase("ro-RO") : "",
        saved: formatLei(before),
        target: formatLei(goal.target_minor),
      }),
    });
  }
  const message = notifications.sort((a, b) => b.at.localeCompare(a.at))[0];
  p.lastMessage = message
    ? { icon: message.icon, meta: `${relativeDay(localDay(message.at), today)}, ${localTime(message.at)} · ${message.label}`, title: message.title, text: message.text }
    : null;

  p.week = {
    spent: lei(spent(variable.filter((tx) => tx.local_date >= firstMonday))),
    daysSoFar: Math.min(7, Math.max(0, daysBetween(firstMonday, today) + 1)),
    guidePerDay: perDay,
    days: t.week.days.map((item, index) => ({
      ...item,
      ...(weekdays[index] <= today ? { lei: lei(spent(variable.filter((tx) => tx.local_date === weekdays[index]))) } : {}),
      ...(weekdays[index] === today ? { today: true } : {}),
    })),
  };
  p.week.scaleMax = Math.ceil((Math.max(perDay, ...p.week.days.map((item) => item.lei ?? 0)) * 1.4) / 10) * 10;

  // What is coming up: calendar groups, expected income and bills, as the persona's agenda lists them.
  const choices = model.preferences.gift_choices_minor;
  const groups = t.calendar.gift.groups;
  const giftCost = (events) =>
    sum(events.map((event) => choices[Math.max(0, groups.findIndex((group) => group.audience === event.audience))] ?? 0));
  const agenda = [];
  if (t.agenda.sources.includes("calendar")) {
    const days = new Map();
    for (const event of model.calendar_events.filter((item) => item.starts_on > today && ["birthday", "holiday"].includes(item.type))) {
      if (!days.has(event.starts_on)) days.set(event.starts_on, []);
      days.get(event.starts_on).push(event);
    }
    for (const [date, events] of days) {
      const birthdays = events.filter((event) => event.type === "birthday");
      if (birthdays.length)
        agenda.push({ date, birthdays: true, title: count(birthdays.length, "zi de naștere", "zile de naștere"), note: `${formatLei(giftCost(birthdays))} lei din bugetul de cadouri` });
      for (const holiday of events.filter((event) => event.type === "holiday"))
        agenda.push({ date, title: holiday.title, note: holiday.note ?? (holiday.gifts ? "Sărbătoare cu cadouri" : "Sărbătoare") });
    }
  }
  if (t.agenda.sources.includes("income"))
    for (const item of model.expected_incomes.filter((income) => income.expected_on > today)) {
      if (!item.certain) {
        agenda.push({ date: item.expected_on, title: `${item.name}, circa ${formatLei(item.amount_minor)} lei`, note: "Estimat: o adaug în buget când intră" });
        continue;
      }
      const pot = model.pots.find((entry) => entry.planned_on === item.expected_on);
      const goal = model.goals.find((entry) => entry.rule && entry.copy.agenda_note && item.amount_minor >= entry.rule.min_income_minor);
      agenda.push({
        date: item.expected_on,
        title: item.name,
        note: pot
          ? `${formatLei(pot.target_minor)} lei deoparte pentru ${render(pot.copy.name)}`
          : goal
            ? interpolate(goal.copy.agenda_note, { amount: formatLei(item.amount_minor), saving: formatLei((item.amount_minor * goal.rule.percent) / 100) })
            : null,
      });
    }
  if (t.agenda.sources.includes("bills"))
    for (const bill of model.commitments) {
      const date = dueDate(bill.category);
      if (!date || date <= today) continue;
      const group = model.budgets.find((budget) => budget.category === bill.category)?.group_key;
      const title = t.budgetGroups.find((entry) => entry.id === group)?.title;
      agenda.push({ date, title: bill.name, note: `${formatLei(bill.amount_minor)} lei${title ? `, din ${title.toLocaleLowerCase("ro-RO")}` : ""}` });
    }
  // The agenda is a glance: only the next day with birthdays, then the other kinds of events.
  const firstBirthday = agenda.filter((item) => item.birthdays).sort((a, b) => a.date.localeCompare(b.date))[0];
  p.agenda = agenda
    .filter((item) => !item.birthdays || item === firstBirthday)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, t.agenda.limit)
    .map(({ date, birthdays, ...item }) => ({ day: String(Number(date.slice(8))), month: monthShort(date), ...item }));

  // Spending not covered by a budget, "nesortat" last.
  const uncovered = categoryAmounts((envelopes ? current.filter(expense) : variable).filter((tx) => !model.budgets.some((budget) => budget.category === tx.category)));
  const order = Object.keys(categories);
  const uncoveredIds = Object.keys(uncovered).sort((a, b) => (a === "nesortat") - (b === "nesortat") || order.indexOf(a) - order.indexOf(b));
  p.unbudgeted = {
    total: lei(sum(Object.values(uncovered))),
    items: uncoveredIds.map((id) => {
      const rows = current.filter((tx) => tx.category === id && negative(tx));
      const note =
        id === "nesortat"
          ? `${rows.length === 1 ? "O plată" : count(rows.length, "plată", "plăți")} de clarificat`
          : t.unbudgeted.notes[id] ??
            (rows.length && rows.every((tx) => recurringPatterns.has(pattern(tx.description_raw))) ? list([...new Set(rows.toReversed().map((tx) => tx.display.name ?? tx.merchant))]) : null);
      return { name: categories[id].label, icon: categories[id].icon, lei: lei(uncovered[id]), ...(note ? { note } : {}) };
    }),
  };

  // Transactions of the current period, as listed in Cheltuieli.
  const receipts = new Map(model.documents.filter((doc) => doc.kind === "receipt").map((doc) => [doc.transaction_id, doc]));
  const ruled = new Set(model.merchant_rules.map((rule) => rule.merchant_id));
  const merchantHistory = (merchantId) => {
    const recent = fullCycles.slice(-3);
    if (!recent.length) return {};
    const rows = txs.filter((tx) => tx.merchant_id === merchantId && negative(tx) && between(tx.local_date, recent[0].start, recent.at(-1).end));
    return rows.length ? { history: `Ultimele ${count(recent.length, "lună", "luni")}: ${count(rows.length, "plată", "plăți")}, ${formatLei(spent(rows))} lei` } : {};
  };
  const toTx = (tx) => {
    const receipt = receipts.get(tx.id);
    return {
      id: tx.legacy_id,
      time: localTime(tx.occurred_at),
      name: tx.display.name ?? tx.merchant,
      raw: tx.description_raw,
      status: tx.status === "pending" ? "În așteptare" : "Finalizată",
      state: tx.status,
      ...(recurringPatterns.has(pattern(tx.description_raw)) || tx.display.scheduled ? { recurring: true } : {}),
      ...pick(tx.display, ["tags", "note", "needsReview", "suggestion"]),
      ...(tx.display.name && tx.display.name !== tx.merchant ? { renamed: true } : {}),
      ...(ruled.has(tx.merchant_id) ? { rule: true, ...merchantHistory(tx.merchant_id) } : {}),
      ...(receipt ? { receipt: { name: receipt.name, size: receipt.size_bytes } } : {}),
      category: tx.category,
      merchant: tx.merchant,
      lei: lei(tx.amount_minor),
      ...(tx.excluded ? { excluded: true } : {}),
      ...(tx.splits.length ? { splits: tx.splits.map((part) => ({ category: part.category, lei: lei(part.amount_minor) })) } : {}),
    };
  };
  const listed = current.toReversed();
  p.days = [...new Set(listed.map((tx) => tx.local_date))].map((date) => ({
    ...dayLabels(date, today),
    total: lei(spent(listed.filter((tx) => tx.local_date === date && expense(tx)))),
    items: listed.filter((tx) => tx.local_date === date).map(toTx),
  }));
  const previous = spent(
    txs.filter((tx) => tx.account_key === "current" && negative(tx) && tx.kind === "variable" && between(tx.local_date, previousStart, addDays(previousStart, daysBetween(start, today)))),
  );
  const diff = spent(variable) - previous;
  p.spending = {
    period: `${Number(start.slice(8))} – ${dayMonth(today)}`,
    title: `Cheltuieli variabile din ${dayMonth(start)}`,
    total: lei(spent(variable)),
    fixed: lei(spent(paidFixed)),
    fixedNote: t.spending.fixedNote,
    ...(previous ? { compare: `Cu ${formatLei(Math.abs(diff))} lei mai ${diff > 0 ? "mult" : "puțin"} față de aceeași perioadă din ${monthLong(previousStart)}` } : {}),
    parts: [...t.spending.partIds, ...Object.keys(variableByCategory).filter((id) => !t.spending.partIds.includes(id))].map((id) => ({ id, lei: lei(variableByCategory[id] ?? 0) })),
  };
  const reviews = current.filter((tx) => tx.display.needsReview);
  const review = reviews[0];
  v["tracking.uncategorized"] = current.filter((tx) => tx.category === "nesortat").length;
  p.filters = render(t.filters).map((filter, index) => (index === 0 ? { ...filter, selected: true } : filter));
  if (review) {
    p.review = {
      id: review.legacy_id,
      title: count(reviews.length, "plată de verificat", "plăți de verificat"),
      text: `${review.merchant} · ${formatLei(Math.abs(review.amount_minor))} lei · ${label(review.local_date, { weekday: "long", day: "numeric", month: "short" })}`,
    };
    p.question = { options: t.question.options, txId: review.legacy_id, amount: lei(Math.abs(review.amount_minor)), merchant: review.merchant, date: dayMonth(review.local_date) };
  } else {
    p.review = null;
    p.question = null;
  }

  // Goals: the active one, the planned ones and pots.
  const idea = model.decisions.find((decision) => decision.decision_key === "idea");
  const forecast = model.preferences.idea_forecast;
  const extraIncome = forecast
    ? safeInteger(BigInt(forecast.hourly_rate_minor) * BigInt(forecast.hours_per_week) * BigInt(forecast.weeks_per_month))
    : 0;
  const ideaAccepted = idea?.payload.decision === "accepted";
  const plan = (goal, extra) => {
    let cumulative = 0;
    let dueOn = null;
    const entries = goal.schedule.map((entry) => {
      const planned = sum([entry.planned_minor, extra && entry.occurs_on >= forecast.starts_on ? extra : 0]);
      const add = Math.min(planned, Math.max(0, goal.target_minor - cumulative));
      cumulative += add;
      if (!dueOn && cumulative >= goal.target_minor) dueOn = entry.occurs_on;
      return { ...entry, planned, add, total: cumulative, overflow: planned - add };
    });
    return { entries, dueOn };
  };
  const goalSaved = (goal) => goal.opening_minor + spent(txs.filter((tx) => tx.pot_key === goal.goal_key && tx.kind === "saving"));
  const goals = ordered(model.goals);
  for (const goal of goals) {
    const deposits = goal.schedule.filter((entry) => entry.planned_minor > 0 && entry.planned_minor !== goal.opening_minor);
    const groupsByAmount = [];
    for (const entry of deposits) {
      const last = groupsByAmount.at(-1);
      if (last && last.amount === entry.planned_minor) last.dates.push(entry.occurs_on);
      else groupsByAmount.push({ amount: entry.planned_minor, dates: [entry.occurs_on] });
    }
    Object.assign(v, {
      [`goal.${goal.goal_key}.saved`]: formatLei(goalSaved(goal)),
      [`goal.${goal.goal_key}.target`]: formatLei(goal.target_minor),
      [`goal.${goal.goal_key}.opening`]: formatLei(goal.opening_minor),
      [`goal.${goal.goal_key}.first_deposit`]: deposits[0] ? dayMonth(deposits[0].occurs_on) : null,
      [`goal.${goal.goal_key}.first_month`]: deposits[0] ? monthLong(deposits[0].occurs_on) : null,
      [`goal.${goal.goal_key}.funding_months`]: deposits.length ? `${monthShort(deposits[0].occurs_on)}–${monthShort(deposits.at(-1).occurs_on)}` : null,
      [`goal.${goal.goal_key}.schedule_text`]: groupsByAmount
        .map((group) => `${formatLei(group.amount)} lei ${group.dates.map((date) => `pe ${dayMonth(date)}`).join(" și ")}`)
        .join(", apoi "),
    });
    if (goal.rule && goal.status === "active")
      Object.assign(v, {
        "goal.rule_percent": goal.rule.percent,
        "goal.rule_min": formatLei(goal.rule.min_income_minor),
        "goal.rule_example": mainIncome ? formatLei((mainIncome.amount_minor * goal.rule.percent) / 100) : null,
      });
  }
  const active = goals.find((goal) => goal.status === "active");
  const planned = goals.filter((goal) => goal.status === "planned");
  if (active && forecast) {
    const withIdea = plan(active, extraIncome);
    const without = plan(active, 0);
    let course = null;
    if (planned[0]) {
      let collected = 0;
      for (const entry of withIdea.entries) {
        collected += entry.overflow;
        if (collected >= planned[0].target_minor) { course = entry.occurs_on; break; }
      }
    }
    Object.assign(v, {
      "idea.hours": forecast.hours_per_week,
      "idea.rate": formatLei(forecast.hourly_rate_minor),
      "idea.monthly": formatLei(extraIncome),
      "idea.goal_month": withIdea.dueOn ? monthLong(withIdea.dueOn) : null,
      "idea.goal_month_without": without.dueOn ? monthLong(without.dueOn) : null,
      "idea.next_goal_month": course ? monthLong(course) : null,
      "idea.next_summer": Number(today.slice(0, 4)) + (today.slice(5, 7) > "08" ? 1 : 0),
      "idea.summer_monthly": memory.summer_job && memory.course_months ? roundedLei(memory.summer_job.amount_minor / Number(memory.course_months.content), 10) : null,
    });
  }
  if (active) {
    const { entries, dueOn } = plan(active, ideaAccepted ? extraIncome : 0);
    p.goal = {
      name: active.name,
      icon: active.icon,
      note: active.copy.note,
      saved: lei(goalSaved(active)),
      amount: lei(active.target_minor),
      due: {
        label: active.copy.due_label,
        date: dueOn ? (active.copy.due_format === "day" ? dayMonthYear(dueOn) : monthYear(dueOn)) : "După perioada planificată",
        note: render(active.copy.due_note),
      },
      plan: entries.map((entry) => ({ month: monthShort(entry.occurs_on), add: lei(entry.add), total: lei(entry.total) })),
      reason: render(active.copy.reason),
      fundingLabel: render(active.copy.fundingLabel),
      funding: active.funding.map((item) => ({ name: render(item.name), lei: lei(item.amount_minor) })),
      storage: active.copy.storage,
      ...(active.copy.suggestion ? { suggestion: active.copy.suggestion } : {}),
    };
  } else p.goal = null;
  p.nextGoals = planned.map((goal) => ({
    name: goal.name,
    icon: goal.icon,
    amount: lei(goal.target_minor),
    ...render(goal.copy, { "goal.starts": goal.starts_on ? monthYear(goal.starts_on) : null }),
  }));
  p.pots = ordered(model.pots).map((pot) => {
    const local = {
      "pot.month": monthLong(pot.event_month),
      "pot.target": formatLei(pot.target_minor),
      "pot.planned_on": pot.planned_on ? dayMonth(pot.planned_on) : null,
      "pot.remaining_events": birthdaysIn(addDays(today, 1), addDays(nextCycleStart(pot.event_month, 1), -1)).length,
    };
    v[`pot.${pot.pot_key}.target`] = local["pot.target"];
    const amount = pot.planned_on && pot.planned_on > today
      ? pot.target_minor
      : sum(txs.filter((tx) => tx.pot_key === pot.pot_key).map((tx) => (tx.kind === "saving" ? -tx.amount_minor : tx.amount_minor)));
    return { ...render(pot.copy, local), icon: pot.icon, lei: lei(amount) };
  });
  p.reserve = t.reserve;

  // Subscriptions: usage from the monitored app, payments from the ledger.
  const signalsOf = (sub) => model.usage_signals.filter((signal) => signal.subscription_id === sub.id).map((signal) => localDay(signal.occurred_at)).sort();
  const payments = (sub) => txs.filter((tx) => tx.merchant_id === sub.merchant_id && tx.amount_minor < 0);
  const previousMonth = addDays(`${today.slice(0, 8)}01`, -1).slice(0, 7);
  p.profile = {};
  const subscriptions = ordered(model.subscriptions);
  p.profile.subscriptions = subscriptions.map((sub) => {
    const signals = signalsOf(sub);
    const last = signals.at(-1);
    let note = null;
    if (sub.monitored && last && daysBetween(last, today) > 30)
      note = `Aplicația ${sub.app_label ? `${sub.app_label} ` : ""}nedeschisă din ${monthLong(last)} · ${formatLei(spent(payments(sub).filter((tx) => tx.local_date > last)))} lei plătiți de atunci`;
    else if (sub.monitored && payments(sub).length)
      note = `Aplicația deschisă de ${signals.filter((date) => date.startsWith(previousMonth)).length} ori în ${monthLong(`${previousMonth}-01`)} · ${formatLei(spent(payments(sub)))} lei plătiți din ${monthLong(payments(sub)[0].local_date)}`;
    return { name: sub.name, lei: lei(sub.amount_minor), ...(note ? { note } : {}), ...(sub.plan_note ? { status: sub.plan_note } : {}) };
  });
  v["apps.monitored"] = list(subscriptions.filter((sub) => sub.monitored).map((sub) => sub.name)) || null;
  p.apps = {
    ...t.apps,
    found: `Am găsit ${count(subscriptions.length, "abonament", "abonamente")} în extrase.`,
    items: subscriptions
      .filter((sub) => sub.has_app)
      .map((sub) => {
        const first = payments(sub)[0];
        const recent = first && historyMonths.length && first.local_date.slice(0, 7) > historyMonths[0];
        return { name: sub.name, lei: lei(sub.amount_minor), note: recent ? `Plătit lunar din ${monthLong(first.local_date)}` : "Plătit lunar", on: sub.monitored };
      }),
  };

  // Statements and imports, with real states.
  const statementFiles = [...model.documents].filter((doc) => doc.kind === "statement").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const importOf = (doc) => model.imports.find((item) => item.document_id === doc.id);
  const processed = statementFiles.filter((doc) => doc.status === "processed");
  const statementRows = txs.filter((tx) => tx.account_key !== "current");
  v["statements.permission_hint"] = [
    `Contul curent${processed.length ? ` și ${count(processed.length, "extras atașat", "extrase atașate")}` : ""}`,
    historyMonths.length ? count(historyMonths.length, "lună", "luni") : "fără istoric importat",
  ].join(" · ");
  const ERRORS = {
    invalid_csv: "Nu am putut citi fișierul. Folosește extrasul CSV exportat din bancă.",
    parser_unavailable: "Serviciul care citește extrasele nu răspunde. Încearcă din nou mai târziu.",
    import_failed: "Importul nu a reușit. Încearcă din nou.",
  };
  const fileMeta = (doc) => {
    const job = importOf(doc);
    if (doc.status === "processed")
      return `${count(job.rows_imported, "plată nouă", "plăți noi")}${job.rows_duplicate ? ` · ${count(job.rows_duplicate, "plată existentă", "plăți existente")}` : ""}`;
    if (doc.status === "failed") return ERRORS[doc.error_code] ?? ERRORS.import_failed;
    if (doc.status === "unsupported") return "Salvat · în demo citesc doar extrase CSV";
    return "Salvat";
  };
  const months = (rows) => [...new Set(rows.map((tx) => tx.local_date.slice(0, 7)))].sort();
  // "Ultimele 12 luni" = the current month and the 11 before it, up to today.
  const periodLabel = (length) => monthRange(monthsBack(today, length - 1), today);
  p.statements = {
    lead: t.statements.lead,
    account: { name: "Cont curent RON", iban: model.account.iban_masked },
    periods: t.statements.period_months.map((m) => ({ months: m, label: `Ultimele ${m} luni (${periodLabel(m)})` })),
    imported: lastImport
      ? (() => {
          const rows = txs.filter((tx) => tx.import_id && tx.account_key === "current");
          const span = months(rows);
          return {
            title: count(span.length, "extras lunar importat", "extrase lunare importate"),
            meta: span.length ? `${monthRange(`${span[0]}-01`, `${span.at(-1)}-01`)} · ${count(rows.length, "plată", "plăți")} · se actualizează lunar` : "Nicio plată în perioada aleasă",
            at: lastImport.created_at,
          };
        })()
      : null,
    attachHint: t.statements.attachHint,
    formats: t.statements.formats,
    files: statementFiles.map((doc) => ({
      id: doc.id,
      name: doc.name,
      meta: fileMeta(doc),
      state: doc.status === "processed" ? "done" : doc.status === "failed" ? "failed" : "stored",
    })),
    howTo: t.statements.howTo,
    privacy: t.statements.privacy,
  };
  p.profile.statements = [
    ...(lastImport
      ? [{ icon: "card", name: "Cont curent RON", note: `${p.statements.imported.meta.split(" · ")[0]}, importat din aplicație · se actualizează lunar`, status: "Importat" }]
      : []),
    ...(processed.length
      ? [{ icon: "file", name: "Extrase atașate", note: `${count(processed.length, "fișier", "fișiere")} · ${count(statementRows.length, "plată", "plăți")}`, status: "Procesate" }]
      : []),
  ];

  // Profile: computed facts, the user's answers and corrections.
  const corrections = Object.fromEntries(
    model.user_memory.filter((item) => item.kind === "correction").map((item) => [item.memory_key.slice("profile.".length), item.content]),
  );
  const rows = (section) =>
    render(t.profile[section])
      .map((row) => (corrections[`${section}.${row.id}`] !== undefined ? { ...row, value: corrections[`${section}.${row.id}`], ...(row.src ? { src: "said" } : {}) } : row))
      .filter((row) => row.value != null && row.label != null);
  p.profile.about = rows("about");
  p.profile.money = rows("money");
  p.profile.talk = rows("talk");
  p.profile.unknown = t.profile.unknown;
  p.profile.income = lei(incoming);
  p.profile.spending = t.profile.spending.map(({ categories: ids, ...item }) => {
    const amount = fullCycles.length
      ? Math.round(sum(fullCycles.map((cycle) => spent(periodRows(cycle).filter((tx) => negative(tx) && ids.includes(tx.category))))) / fullCycles.length)
      : 0;
    return { ...item, lei: lei(Math.round(amount / 100) * 100) };
  });
  const observedText = {
    end_of_month_shortage: (x) => `Sub ${formatLei(x.threshold_minor)} lei în cont între ${x.from_day} și ${incomeDay} ale lunii, în ${x.hit} din ultimele ${x.total} luni`,
    front_loading: (x) => `${x.share}% din cheltuieli în primele ${x.days} zile după salariu`,
    recurring_expense: (x) => `${x.merchant}, circa ${roundedLei(x.avg_minor)} lei, ${x.per_week_min === x.per_week_max ? x.per_week_min : `${x.per_week_min}–${x.per_week_max}`} ${x.to_time < "12:00" ? "dimineți" : "zile"} pe săptămână`,
    ran_out: (x) => `În ${list(x.months.map((month) => monthLong(`${month}-01`)))}, fără bursă, banii s-au terminat cu ${Math.min(...x.days)}–${Math.max(...x.days)} zile înainte de ${incomeDay}`,
    irregular_income: (x) => `Bursa a intrat în ${monthSpans(x.months, " și în ")}, în jur de ${x.day} ale lunii`,
    side_income: (x, entry) => `${entry.name}: ${x.min_count === x.max_count ? x.min_count : `${x.min_count}–${x.max_count}`} plăți pe lună, de la aceleași persoane`,
  };
  p.profile.observed = t.profile.observed
    .map((entry) => {
      const payload = insight(entry.type);
      if (!payload) return null;
      const quote = entry.quote ? render(entry.quote) : null;
      return { text: observedText[entry.type](payload, entry), ...(quote ? { quote } : {}), src: entry.src ?? "obs" };
    })
    .filter(Boolean);
  p.profile.permissions = render(model.preferences.permissions);

  // Analysis run and its findings.
  const steps = t.analysis.steps;
  const stale = run && model.imports.some((item) => item.status === "done" && item.created_at > run.started_at);
  if (run) {
    const s = run.steps;
    const vars = {
      "step.day": s.income?.day,
      "step.hit": s.income?.hit,
      "step.total": s.income?.total ?? s.categories.total,
      "step.recurring": s.recurring ? count(s.recurring.count, "plată recurentă", "plăți recurente") : null,
      "step.subscriptions": s.recurring ? count(s.recurring.subscriptions, "abonament", "abonamente") : null,
      "step.payments": count(s.categories.total, "plată", "plăți"),
      "step.done": ro(s.categories.done),
      "step.observations": count(s.habits.observations, "observație găsită", "observații găsite"),
    };
    const runMonths = months(txs.filter((tx) => tx.import_id && tx.local_date <= run.as_of && tx.account_key === "current"));
    p.analysis = {
      status: stale ? "stale" : run.status,
      title: `Am analizat ${runMonths.length ? `ultimele ${count(runMonths.length, "lună", "luni")}` : "datele disponibile"}`,
      lead: `${count(runMonths.length, "lună importată", "luni importate")} din contul curent${processed.length ? ` și ${count(processed.length, "extras atașat", "extrase atașate")}` : ""}.`,
      items: steps.map((step) => {
        const note = interpolate(step.note, { ...v, ...vars }, { soft: true });
        return {
          label: interpolate(step.label, { ...v, ...vars }, { soft: true }),
          state: "done",
          note: step.key === "categories" ? `${ro(s.categories.done)} din ${ro(s.categories.total)}` : note ?? "Nu am găsit destule date",
        };
      }),
      at: run.finished_at,
    };
  } else
    p.analysis = {
      status: "none",
      title: "Analiza nu a pornit încă",
      lead: lastImport ? "Am extrasele. Pornesc analiza când ajungi la acest pas." : "Importă mai întâi extrasele, ca să am ce analiza.",
      items: steps.map((step) => ({ label: interpolate(step.label, { "step.payments": "plăți" }, { soft: true }) ?? step.key, state: "waiting", note: "Urmează" })),
    };
  const nextIncomeAfter = (date) => {
    const anchor = cycleStart(date, incomeDay);
    return anchor === date ? date : nextCycleStart(anchor, incomeDay);
  };
  const findingText = {
    end_of_month_shortage: (x) => ({ text: `Între ${x.from_day} și ${incomeDay} ale lunii ai sub ${formatLei(x.threshold_minor)} lei în cont, în ${x.hit} din ultimele ${x.total} luni.` }),
    recurring_expense: (x) => ({
      text: `${x.per_week_min >= 4 && x.to_time < "12:00" ? "Aproape în fiecare dimineață plătești" : `De ${x.per_week_min}–${x.per_week_max} ori pe săptămână plătești`} circa ${roundedLei(x.avg_minor)} lei la ${x.merchant}: aproximativ ${roundedLei(x.monthly_minor, 10)} lei pe lună.`,
      note: "Te întreb despre asta în discuție.",
    }),
    subscription_usage: (x) =>
      x.unused
        ? { text: `${x.name}: ${formatLei(x.amount_minor)} lei pe lună, iar aplicația ${x.app_label ? `${x.app_label} ` : ""}n-a mai fost deschisă din ${monthLong(x.last_signal)}.` }
        : { text: `${x.name}: ${formatLei(x.amount_minor)} lei pe lună, iar aplicația a fost deschisă de ${x.opens_in_month} ori în ${monthLong(`${x.month}-01`)}.`, note: "Te întreb despre asta în discuție." },
    upcoming_spike: (x) => ({ text: `În ${monthLong(`${x.month}-01`)} ai ${count(x.birthdays, "zi de naștere", "zile de naștere")}.`, label: "din calendar" }),
    deadline: (x) => ({ text: `Pe ${dayMonth(x.date)} ai ${x.phrase ?? x.title.toLocaleLowerCase("ro-RO")}.`, label: "din calendar" }),
    ran_out: (x) => ({ text: `În ${list(x.months.map((month) => monthLong(`${month}-01`)))}, fără bursă, banii s-au terminat cu ${Math.min(...x.days)}–${Math.max(...x.days)} zile înainte de ${incomeDay}.` }),
    needs_cover: (x) => ({
      text:
        Math.abs(x.needs_minor - x.income_minor) <= x.income_minor * 0.05
          ? `Necesarele tale costă circa ${formatLei(x.needs_minor)} lei pe lună, cât primești de la familie.`
          : `Necesarele tale costă circa ${formatLei(x.needs_minor)} lei pe lună, iar de la familie primești ${formatLei(x.income_minor)} lei.`,
      src: "est",
    }),
  };
  p.findings = run
    ? {
        lead: `Din ${count(months(txs.filter((tx) => tx.import_id && tx.local_date <= run.as_of)).length, "lună", "luni")} de extrase, din calendar și din răspunsurile tale.`,
        items: t.findings.types
          .map((type) => {
            const payload = insight(type);
            return payload ? { src: "obs", ...findingText[type](payload) } : null;
          })
          .filter(Boolean),
        firstStep: render(t.findings.firstStep, { "analysis.next_income_date": dayMonth(nextIncomeAfter(run.as_of)) }),
      }
    : { lead: "Analiza nu a rulat încă.", items: [], firstStep: null };

  // Conversation: day separators come from the message timestamps.
  p.chat = [];
  let lastDay = null;
  for (const message of [...model.messages].sort((a, b) => a.position - b.position)) {
    const date = localDay(message.created_at);
    if (date !== lastDay) {
      p.chat.push({ type: "divider", text: date === today ? "Azi" : date === addDays(today, -1) ? "Ieri" : dayMonth(date) });
      lastDay = date;
    }
    const item =
      message.kind === "proposal"
        ? { type: "proposal", position: message.position, ...message.body }
        : message.kind === "service"
          ? { type: "service", ...message.body }
          : { type: message.role === "user" ? "me" : "coach", ...message.body };
    if (message.kind === "proposal" && message.decision) {
      item.done = `${message.decision} · ${dayMonth(localDay(message.decided_at))}`;
      delete item.actions;
    }
    p.chat.push(item);
  }
  p.chatStatus = {
    unread: model.messages.filter((message) => message.role === "coach" && !message.read_at).length,
    coachReplies: false,
  };

  // Calendar summary for the months ahead.
  const source = model.preferences.calendar_connected === "phone" ? "Din calendarul telefonului" : "Din contactele tale Google";
  const found = [];
  const fromMonth = `${today.slice(0, 8)}01`;
  const upcoming = model.calendar_events.filter((event) => event.starts_on >= fromMonth && daysBetween(today, event.starts_on) <= 366).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const byMonth = (type, filter = () => true) => {
    const groupsOf = new Map();
    for (const event of upcoming.filter((item) => item.type === type && filter(item))) {
      const key = event.starts_on.slice(0, 7);
      if (!groupsOf.has(key)) groupsOf.set(key, []);
      groupsOf.get(key).push(event);
    }
    return groupsOf;
  };
  for (const [month, events] of byMonth("birthday"))
    found.push({ date: events[0].starts_on, day: monthShort(`${month}-01`), month: month.slice(0, 4), title: count(events.length, "zi de naștere", "zile de naștere"), note: source });
  for (const [month, events] of byMonth("holiday", (event) => event.gifts))
    found.push({ date: events[0].starts_on, day: monthShort(`${month}-01`), month: month.slice(0, 4), title: events.map((event) => event.title).join(", "), note: "Sărbători cu cadouri" });
  for (const event of upcoming.filter((item) => ["marked", "deadline"].includes(item.type)))
    found.push({
      date: event.starts_on,
      day: String(Number(event.starts_on.slice(8))),
      month: monthShort(event.starts_on),
      title: event.title,
      note: `Eveniment marcat de tine${event.starts_on.slice(0, 4) !== today.slice(0, 4) && event.starts_on.slice(0, 7) > addDays(today, 120).slice(0, 7) ? `, în ${event.starts_on.slice(0, 4)}` : ""}`,
    });
  const birthdayMonth = [...byMonth("birthday")][0];
  p.calendar = {
    options: t.calendar.options,
    reads: t.calendar.reads,
    doesNotRead: t.calendar.doesNotRead,
    found: found.sort((a, b) => a.date.localeCompare(b.date)).map(({ date, ...item }) => item),
    gift: {
      question: t.calendar.gift.question,
      groups: groups.map((group, index) => ({
        label: group.label,
        options: [...group.options_minor.map((amount) => `${formatLei(amount)} lei`), "Altă sumă"],
        selected: `${formatLei(choices[index])} lei`,
        selected_minor: choices[index],
      })),
      result: birthdayMonth
        ? `Pentru cele ${count(birthdayMonth[1].length, "zi de naștere", "zile de naștere")} din ${monthLong(`${birthdayMonth[0]}-01`)}: aproximativ ${formatLei(giftCost(birthdayMonth[1]))} lei.`
        : "Nu am găsit zile de naștere în lunile următoare.",
    },
  };

  // Services, ideas and the rest of the static copy.
  const deadline = model.calendar_events.filter((event) => event.type === "deadline" && event.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
  if (deadline) Object.assign(v, { "deadline.date": dayMonth(deadline.starts_on), "deadline.reminder": dayMonth(addDays(deadline.starts_on, -7)) });
  if (fullCycles.length) {
    const cardMonthly = sum(fullCycles.map((cycle) => spent(periodRows(cycle).filter(expense)))) / fullCycles.length;
    Object.assign(v, {
      "card.monthly": roundedLei(cardMonthly, 100),
      "card.one_percent": roundedLei(cardMonthly / 100),
      "card.one_percent_left": roundedLei(Math.max(0, left) / 100),
    });
  }
  p.services = {
    ...t.services,
    on: model.preferences.services_on,
    items: ordered(model.services).map((service) => ({ ...render(service.payload), ...(service.decision ? { decision: service.decision } : {}) })),
  };
  if (t.ideas) {
    p.ideas = render(t.ideas);
    if (idea) p.ideas.featured.decision = idea.payload.decision;
  }
  p.questions = ordered(model.questions).map((question) => ({
    ...question.definition,
    options: question.definition.options.map((option) => ({ ...option, ...(question.answer.selected.includes(option.label) ? { selected: true } : {}) })),
    ...(question.definition.fields ? { fields: question.definition.fields.map((field) => ({ ...field, value: question.answer.fields[field.label] ?? "" })) } : {}),
  }));
  p.accessLog = [...model.access_log]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 5)
    .map((entry) => ({
      who: entry.actor === "coach" ? "Coach-ul" : "Tu",
      what: entry.action,
      when: `${relativeDay(localDay(entry.occurred_at), today)}, ${localTime(entry.occurred_at)}`,
    }));
  for (const key of ["intro", "pages", "pickerCategories", "tagSuggestions", "entry", "products"]) p[key] = t[key];
  p.categoryNotes = render(t.categoryNotes);
  return p;
}

export const SCREEN_FIELDS = {
  products: ["client", "entry", "products"],
  summary: ["today", "cycle", "week", "lastMessage", "insight", "budgets", "agenda", "essentials"],
  tracking: ["spending", "filters", "review", "days", "categories", "pickerCategories", "tagSuggestions", "categoryNotes"],
  budgets: ["allocation", "budgetGroups", "budgets", "cycle", "question", "unbudgeted"],
  goals: ["goal", "pots", "nextGoals", "reserve", "services"],
  ideas: ["ideas"],
  profile: ["profile", "services"],
  chat: ["chat", "chatStatus", "services"],
  activation: ["intro", "statements", "calendar", "apps", "questions", "analysis", "findings"],
};
export const screenData = (data, screen) => pick(data, SCREEN_FIELDS[screen]);
