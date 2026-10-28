import { day, json } from "./db.js";
import { addDays, capitalize, dayLabels, daysBetween, label, longDate, monday } from "./dates.js";
import { ApiError } from "./errors.js";
import { lei, minor, percent, ro, roundLei, safeInteger, sum } from "./money.js";
import { catalog } from "./seed.js";

export async function accountFor(db, slug) {
  const result = await db.query("SELECT * FROM demo_accounts WHERE slug=$1", [slug]);
  if (!result.rowCount) throw new ApiError(404, "Contul demo nu există.", "not_found");
  return result.rows[0];
}

export async function loadModel(db, slug, lock = false) {
  const account = await accountFor(db, slug);
  const result = await db.query(
    `SELECT * FROM personas WHERE account_id=$1${lock && db.dialect !== "sqlite" ? " FOR UPDATE" : ""}`,
    [account.id],
  );
  if (!result.rowCount)
    throw new ApiError(410, "Coach-ul este dezactivat. Îl poți reactiva din Produse.", "coach_disabled");
  const persona = result.rows[0];
  const model = {
    account,
    persona,
    templates: json(persona.templates),
    preferences: json(persona.preferences),
  };
  const tables = [
    "cycles",
    "transactions",
    "commitments",
    "budgets",
    "goals",
    "pots",
    "subscriptions",
    "historical_spending",
    "questions",
    "messages",
    "documents",
    "services",
    "decisions",
  ];
  // Sequential on the same connection so transaction snapshots stay consistent.
  for (const table of tables)
    model[table] = (await db.query(`SELECT * FROM ${table} WHERE persona_id=$1`, [persona.id])).rows;
  return model;
}

const ordered = (rows) => [...rows].sort((a, b) => a.sort_order - b.sort_order);
const negative = (tx) => safeInteger(tx.amount_minor) < 0 && !tx.excluded;
const expense = (tx) => negative(tx) && ["fixed", "variable"].includes(tx.kind);
const amount = (rows) => sum(rows.map((tx) => -safeInteger(tx.amount_minor)));
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));

export function present(model, today) {
  const p = structuredClone(model.templates);
  const student = model.persona.mode === "student";
  const cycle = model.cycles[0];
  const start = day(cycle.starts_on),
    end = day(cycle.ends_on);
  const txs = ordered(model.transactions).map((tx) => ({
    ...tx,
    local_date: day(tx.local_date),
    amount_minor: safeInteger(tx.amount_minor),
    presentation: json(tx.presentation),
    splits: json(tx.splits),
  }));
  const current = txs.filter(
    (tx) =>
      tx.scope === "current" && tx.local_date >= start && tx.local_date <= today && tx.local_date <= end,
  );
  const visible = current.filter((tx) => tx.visible);
  const variable = current.filter((tx) => negative(tx) && tx.kind === "variable");
  const paidFixed = current.filter((tx) => negative(tx) && tx.kind === "fixed");
  const incoming = sum(current.filter((tx) => tx.kind === "income").map((tx) => tx.amount_minor));
  const saved = amount(current.filter((tx) => tx.amount_minor < 0 && tx.kind === "saving"));
  const plannedFixed = sum(model.commitments.map((item) => item.amount_minor));
  const total = sum([safeInteger(cycle.opening_minor), incoming]);
  const spendable = total - saved - (student ? 0 : plannedFixed);
  const spent = amount(student ? current.filter(expense) : variable);
  const left = spendable - spent;
  const daysLeft = Math.max(1, daysBetween(today, end) + 1);
  const perDay = roundLei(Math.max(0, left), daysLeft);
  const firstMonday = monday(today);
  const weekdays = Array.from({ length: 7 }, (_, index) => addDays(firstMonday, index));
  const categoryOf = (label) =>
    Object.entries(catalog.categories).find(([, category]) => category.label === label)?.[0];
  const categoryAmounts = (rows) => {
    const values = {};
    for (const tx of rows) {
      const entries = tx.splits.length
        ? tx.splits
        : [{ category: tx.category, amount_minor: -tx.amount_minor }];
      for (const entry of entries)
        values[entry.category] = sum([values[entry.category] ?? 0, safeInteger(entry.amount_minor)]);
    }
    return values;
  };
  const variableByCategory = categoryAmounts(variable);
  const allByCategory = categoryAmounts(
    current.filter((tx) => expense(tx) || (negative(tx) && tx.kind === "pot")),
  );
  p.today = { label: capitalize(label(today, { weekday: "long", day: "numeric", month: "long" })) };
  p.client = json(model.account.client);
  if (model.persona.has_categories || model.preferences.categories)
    p.categories = { ...catalog.categories, ...(model.preferences.categories ?? {}) };
  p.cycle = {
    ...p.cycle,
    total: lei(total),
    ...(student ? {} : { fixed: lei(plannedFixed), setAside: lei(saved) }),
    spendable: lei(spendable),
    spent: lei(spent),
    left: lei(left),
    perDay,
    daysLeftLabel: `${daysLeft}${daysLeft >= 20 ? " de" : ""} zile`,
  };
  if (!student)
    p.insight.figure = `${percent(amount(variable.filter((tx) => tx.local_date < addDays(start, 4))), spendable)}%`;
  if (student) {
    const completed = Math.max(1, daysBetween(start, today));
    const pace = roundLei(amount(variable.filter((tx) => tx.local_date < today)), completed);
    const lasts = pace > 0 ? addDays(today, Math.floor(Math.max(0, left) / (pace * 100))) : end;
    p.cycle.pace = `La ritmul de până acum, circa ${pace} lei pe zi, banii îți ajung până pe ${longDate(lasts)}.`;
  }
  p.allocation = p.allocation.map((item) => ({
    ...item,
    lei: lei(
      item.id === "aside"
        ? saved
        : item.id === "fixed"
          ? plannedFixed
          : item.id === "needs"
            ? sum(
                model.budgets
                  .filter((b) => json(b.presentation).group === "necesare")
                  .map((b) => b.limit_minor ?? allByCategory[b.category] ?? 0),
              )
            : spendable -
              (student
                ? sum(
                    model.budgets
                      .filter((b) => json(b.presentation).group === "necesare")
                      .map((b) => b.limit_minor ?? allByCategory[b.category] ?? 0),
                  )
                : 0),
    ),
  }));
  p.week = {
    ...p.week,
    spent: lei(amount(variable.filter((tx) => tx.local_date >= firstMonday))),
    daysSoFar: Math.min(7, Math.max(0, daysBetween(firstMonday, today) + 1)),
    guidePerDay: perDay,
    days: p.week.days.map((item, index) => ({
      ...item,
      ...(weekdays[index] <= today
        ? { lei: lei(amount(variable.filter((tx) => tx.local_date === weekdays[index]))) }
        : {}),
      ...(weekdays[index] === today ? { today: true } : {}),
    })),
  };
  p.budgets = ordered(model.budgets).map((b) => {
    const base = structuredClone(json(b.presentation));
    const rows = current.filter(
      (tx) =>
        negative(tx) && tx.category === b.category && (b.period !== "week" || tx.local_date >= firstMonday),
    );
    const cost = sum(
      current
        .filter((tx) => negative(tx) && (b.period !== "week" || tx.local_date >= firstMonday))
        .flatMap((tx) =>
          tx.splits.length
            ? tx.splits.filter((entry) => entry.category === b.category).map((entry) => entry.amount_minor)
            : tx.category === b.category
              ? [-tx.amount_minor]
              : [],
        ),
    );
    const count = rows.length;
    if (b.kind === "count") {
      base.used = count;
      base.max = b.count_limit;
      base.note = `${count} din ${b.count_limit} săptămâna aceasta · următoarea, de luni`;
    } else if (["amount", "paid", "protected"].includes(b.kind)) base.spent = lei(cost);
    if (b.kind === "amount") base.limit = lei(b.limit_minor);
    if (b.warn_at_percent && percent(cost, b.limit_minor) >= b.warn_at_percent) base.warn = true;
    if (!student && b.budget_key === "iesiri")
      base.note = `${percent(cost, b.limit_minor)}% din buget, în primele ${daysBetween(start, today) + 1} zile ale perioadei`;
    if (!student && b.budget_key === "cadouri")
      base.note = `${rows.length} din ${sum(model.preferences.gift_counts)} ocazii, din banii puși deoparte`;
    if (student && b.budget_key === "cafenele") base.note = `${count} cafele luna aceasta`;
    if (student && b.budget_key === "livrari") base.note = `${count} comenzi luna aceasta`;
    return base;
  });
  if (student) {
    const remaining = (key) => {
      const budget = model.budgets.find((b) => b.budget_key === key);
      return Math.max(0, safeInteger(budget.limit_minor) - (allByCategory[budget.category] ?? 0));
    };
    const costs = {
      Alimente: remaining("alimente"),
      Studii: remaining("studii"),
      "Telefon și internet": remaining("telefon"),
    };
    const essentialTotal = sum(Object.values(costs));
    p.essentials.total = lei(essentialTotal);
    p.essentials.items = p.essentials.items.map((item) => ({
      ...item,
      ...(!item.status ? { lei: lei(costs[item.name]) } : {}),
      ...(item.name === "Alimente" ? { note: `Circa ${roundLei(costs.Alimente, daysLeft)} lei pe zi` } : {}),
    }));
    p.budgets = p.budgets.map((budget) =>
      budget.id === "alimente"
        ? {
            ...budget,
            note: `Circa ${roundLei(costs.Alimente, daysLeft)} lei pe zi până pe ${longDate(end)}`,
          }
        : budget,
    );
    p.essentials.rest.lei = lei(left - essentialTotal);
    p.budgetGroups = p.budgetGroups.map((group) =>
      group.id === "optionale" ? { ...group, note: `mai ai ${ro(lei(left - essentialTotal))} lei` } : group,
    );
  }
  const uncovered = categoryAmounts(
    (student ? current.filter(expense) : variable).filter(
      (tx) => !model.budgets.some((budget) => budget.category === tx.category),
    ),
  );
  const originalUnbudgeted = p.unbudgeted.items;
  const categoryCatalog = { ...catalog.categories, ...(model.preferences.categories ?? {}) };
  const uncoveredIds = [
    ...originalUnbudgeted.map((item) => categoryOf(item.name)).filter((id) => id in uncovered),
    ...Object.keys(uncovered).filter(
      (id) => !originalUnbudgeted.some((item) => categoryOf(item.name) === id),
    ),
  ];
  p.unbudgeted.items = uncoveredIds.map((id) => ({
    ...(originalUnbudgeted.find((item) => categoryOf(item.name) === id) ?? {
      name: categoryCatalog[id].label,
      icon: categoryCatalog[id].icon,
    }),
    lei: lei(uncovered[id]),
  }));
  p.unbudgeted.total = lei(sum(Object.values(uncovered)));
  const toTx = (tx) => ({
    ...tx.presentation,
    category: tx.category,
    merchant: tx.merchant,
    lei: lei(tx.amount_minor),
    ...(tx.excluded ? { excluded: true } : {}),
    ...(tx.splits.length
      ? { splits: tx.splits.map((part) => ({ category: part.category, lei: lei(part.amount_minor) })) }
      : {}),
  });
  p.days = [...new Set(visible.map((tx) => tx.local_date))]
    .sort()
    .reverse()
    .map((date) => ({
      ...dayLabels(date, today),
      total: lei(amount(visible.filter((tx) => tx.local_date === date && expense(tx)))),
      items: visible.filter((tx) => tx.local_date === date).map(toTx),
    }));
  p.spending.total = lei(amount(variable));
  p.spending.fixed = lei(amount(paidFixed));
  p.spending.parts = p.spending.partIds.map((id) => ({ id, lei: lei(variableByCategory[id] ?? 0) }));
  for (const id of Object.keys(variableByCategory))
    if (!p.spending.partIds.includes(id)) p.spending.parts.push({ id, lei: lei(variableByCategory[id]) });
  delete p.spending.partIds;
  p.spending.period = `${Number(start.slice(-2))} – ${longDate(today)}`;
  p.spending.title = `Cheltuieli variabile din ${longDate(start)}`;
  const previous = amount(
    txs.filter(
      (tx) =>
        tx.scope === "comparison" &&
        negative(tx) &&
        Number(tx.local_date.slice(-2)) <= Number(today.slice(-2)),
    ),
  );
  const diff = amount(variable) - previous;
  p.spending.compare = `Cu ${ro(lei(Math.abs(diff)))} lei mai ${diff > 0 ? "mult" : "puțin"} față de aceeași perioadă din octombrie`;
  const review = visible.find((tx) => tx.presentation.needsReview);
  if (review) {
    const count = visible.filter((tx) => tx.presentation.needsReview).length;
    p.review = {
      id: review.legacy_id,
      title: `${count} ${count === 1 ? "plată" : "plăți"} de verificat`,
      text: `${review.merchant} · ${ro(lei(Math.abs(review.amount_minor)))} lei · ${label(review.local_date, { weekday: "long", day: "numeric", month: "short" })}`,
    };
    p.question = {
      ...p.question,
      txId: review.legacy_id,
      amount: lei(Math.abs(review.amount_minor)),
      merchant: review.merchant,
      date: longDate(review.local_date),
    };
  } else {
    p.review = null;
    p.question = null;
  }
  const goal = model.goals[0];
  const idea = model.decisions.find((decision) => decision.decision_key === "idea");
  const extraIncome =
    student && idea && json(idea.payload).decision === "accepted"
      ? safeInteger(
          BigInt(model.preferences.idea_forecast.hourly_rate_minor) *
            BigInt(model.preferences.idea_forecast.hours_per_week) *
            BigInt(model.preferences.idea_forecast.weeks_per_month),
        )
      : 0;
  let cumulative = 0;
  let dueDate;
  p.goal = {
    ...json(goal.presentation),
    saved: lei(safeInteger(goal.opening_minor) + (student ? saved : 0)),
    amount: lei(goal.target_minor),
    plan: json(goal.schedule).map((entry) => {
      const planned = sum([
        entry.planned_minor,
        extraIncome && entry.occurs_on >= model.preferences.idea_forecast.starts_on ? extraIncome : 0,
      ]);
      const add = Math.min(planned, Math.max(0, safeInteger(goal.target_minor) - cumulative));
      cumulative += add;
      if (!dueDate && cumulative >= safeInteger(goal.target_minor)) dueDate = entry.occurs_on;
      return { month: entry.month, add: lei(add), total: lei(cumulative) };
    }),
    funding: json(goal.funding).map((item) => ({ name: item.name, lei: lei(item.amount_minor) })),
  };
  p.goal.due.date = dueDate
    ? label(dueDate, { ...(student ? {} : { day: "numeric" }), month: "long", year: "numeric" })
    : "După perioada planificată";
  p.nextGoals = p.nextGoals.map(({ amount_minor, ...rest }) => ({ ...rest, amount: lei(amount_minor) }));
  p.pots = ordered(model.pots).map((pot) => ({
    ...json(pot.presentation),
    lei: pot.planned
      ? lei(pot.target_minor)
      : lei(
          sum(
            current
              .filter((tx) => tx.pot_key === pot.pot_key)
              .map((tx) => (tx.kind === "saving" ? -tx.amount_minor : tx.amount_minor)),
          ),
        ),
  }));
  p.profile.income = lei(incoming);
  p.profile.spending = p.profile.spending.map((item) => {
    const rows = model.historical_spending.filter((row) => row.group_name === item.name);
    return { ...item, lei: lei(Number(BigInt(amount(rows)) / BigInt(Math.max(1, rows.length)))) };
  });
  p.profile.permissions = model.preferences.permissions;
  p.profile.subscriptions = ordered(model.subscriptions).map((sub) => ({
    ...json(sub.profile),
    lei: lei(sub.amount_minor),
  }));
  p.apps.found = `Am găsit ${model.subscriptions.length} abonamente în extrase.`;
  p.apps.items = ordered(model.subscriptions)
    .filter((sub) => sub.app)
    .map((sub) => ({ ...json(sub.app), lei: lei(sub.amount_minor), on: Boolean(sub.monitored) }));
  p.services.on = model.preferences.services_on;
  p.services.items = ordered(model.services).map((service) => ({
    ...json(service.payload),
    ...(service.decision ? { decision: service.decision } : {}),
  }));
  p.chat = [...model.messages]
    .sort((a, b) => a.position - b.position)
    .map((message) => json(message.payload));
  p.statements.files = ordered(model.documents)
    .filter((doc) => doc.kind === "statement")
    .map((doc) => json(doc.presentation));
  p.questions = ordered(model.questions).map((question) => {
    const definition = structuredClone(json(question.definition)),
      answer = json(question.answer);
    return {
      ...definition,
      options: definition.options.map((option) => ({
        ...option,
        ...(answer.selected.includes(option.label) ? { selected: true } : {}),
      })),
      ...(definition.fields
        ? {
            fields: definition.fields.map((field) => ({ ...field, value: answer.fields[field.label] ?? "" })),
          }
        : {}),
    };
  });
  if (model.preferences.gift_choices)
    p.calendar.gift.groups = p.calendar.gift.groups.map((group, index) => ({
      ...group,
      selected: model.preferences.gift_choices[index] ?? group.selected,
    }));
  const giftCost = sum(
    p.calendar.gift.groups.map(
      (group, index) => minor(group.selected.replace(/ lei$/, "")) * model.preferences.gift_counts[index],
    ),
  );
  p.calendar.gift.result = `Pentru cele ${sum(model.preferences.gift_counts)} zile de naștere din ${student ? "decembrie" : "noiembrie"}: aproximativ ${ro(lei(giftCost))} lei.`;
  if (p.ideas && idea) p.ideas.featured.decision = json(idea.payload).decision;
  return p;
}

export const SCREEN_FIELDS = {
  products: ["client", "entry", "products"],
  summary: ["today", "cycle", "week", "lastMessage", "insight", "budgets", "agenda", "essentials"],
  tracking: [
    "spending",
    "filters",
    "review",
    "days",
    "categories",
    "pickerCategories",
    "tagSuggestions",
    "categoryNotes",
  ],
  budgets: ["allocation", "budgetGroups", "budgets", "cycle", "question", "unbudgeted"],
  goals: ["goal", "pots", "nextGoals", "reserve", "services"],
  ideas: ["ideas"],
  profile: ["profile", "services"],
  chat: ["chat", "services"],
  activation: ["intro", "statements", "calendar", "apps", "questions", "analysis", "findings"],
};
export const screenData = (data, screen) => pick(data, SCREEN_FIELDS[screen]);
