// One-time, reviewable extraction from the frozen pre-migration frontend fixture.
// The operational seed consumes scenarios.json, never the compatibility fixture.
import { readFileSync, writeFileSync } from "node:fs";
import { minor } from "../src/money.js";

const fixture = JSON.parse(
  readFileSync(new URL("../tests/fixtures/frontend-baseline.json", import.meta.url)),
);
const clone = (value) => structuredClone(value);
const without = (value, keys) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const catalog = {
  categories: fixture.categories,
  legal: fixture.legal,
  entry: fixture.personas.pf.entry,
  products: fixture.personas.pf.products,
  login: fixture.accounts.login,
};
const scenarios = {};
for (const [slug, original] of Object.entries(fixture.personas)) {
  const p = clone(original);
  const student = slug === "student";
  const templates = without(p, ["budgets", "chat", "questions", "days", "goal", "pots", "categories"]);
  templates.cycle = without(p.cycle, [
    "total",
    "fixed",
    "setAside",
    "spendable",
    "spent",
    "left",
    "perDay",
    "daysLeftLabel",
    "pace",
  ]);
  templates.week = without(p.week, ["spent", "daysSoFar", "guidePerDay", "days"]);
  templates.week.days = p.week.days.map((day) => without(day, ["lei", "today"]));
  templates.allocation = p.allocation.map((part) => without(part, ["lei"]));
  templates.spending = without(p.spending, ["total", "fixed", "parts", "period", "title"]);
  templates.spending.partIds = p.spending.parts.map((part) => part.id);
  templates.unbudgeted = { items: p.unbudgeted.items.map((item) => without(item, ["lei"])) };
  templates.profile = without(p.profile, ["income", "spending", "subscriptions", "permissions"]);
  templates.profile.spending = p.profile.spending.map((item) => without(item, ["lei"]));
  templates.apps = without(p.apps, ["items", "found"]);
  templates.services = without(p.services, ["on", "items"]);
  templates.statements = without(p.statements, ["files"]);
  templates.question = without(p.question, ["amount", "merchant", "date"]);
  templates.nextGoals = p.nextGoals.map((item) => ({
    ...without(item, ["amount"]),
    amount_minor: minor(item.amount),
  }));
  if (student) {
    templates.essentials = without(p.essentials, ["total"]);
    templates.essentials.items = p.essentials.items.map((item) => without(item, ["lei"]));
    templates.essentials.rest = without(p.essentials.rest, ["lei"]);
  }
  const transactions = p.days.flatMap((day, dayOrder) => {
    const date = `2026-11-${String(/\b(\d{1,2}) nov\./.exec(day.date)[1]).padStart(2, "0")}`;
    return day.items.map((tx, order) => ({
      legacy_id: tx.id,
      local_date: date,
      occurred_at: `${date}T${tx.time}:00+02:00`,
      amount_minor: minor(tx.lei),
      category: tx.category,
      merchant: tx.merchant,
      kind:
        tx.lei > 0
          ? "income"
          : tx.category === "economii"
            ? "saving"
            : ["locuinta", "abonamente", ...(student ? ["transport"] : [])].includes(tx.category)
              ? "fixed"
              : "variable",
      visible: true,
      sort_order: dayOrder * 100 + order,
      presentation: without(tx, ["lei", "category", "merchant"]),
      pot: !student && tx.id === "t18" ? "gifts" : null,
    }));
  });
  if (!student)
    for (const [index, amount] of [100, 100, 180].entries())
      transactions.push({
        legacy_id: `gift-${index + 1}`,
        local_date: `2026-11-${[6, 8, 11][index]}`.replace(/-(\d)$/, "-0$1"),
        occurred_at: `2026-11-${String([6, 8, 11][index]).padStart(2, "0")}T18:00:00+02:00`,
        amount_minor: -minor(amount),
        category: "cadouri",
        merchant: "Cadou demo",
        kind: "pot",
        pot: "gifts",
        visible: false,
        sort_order: 10000 + index,
        presentation: {},
      });
  for (const [index, amount] of (student ? [180, 210, 136] : [320, 410, 219]).entries())
    transactions.push({
      legacy_id: `october-${index}`,
      local_date: `2026-10-${String([1, 4, 10][index]).padStart(2, "0")}`,
      occurred_at: `2026-10-${String([1, 4, 10][index]).padStart(2, "0")}T18:00:00+03:00`,
      amount_minor: -minor(amount),
      category: ["alimente", "iesiri", "livrari"][index],
      merchant: ["Market Express", "Bistro Central", "LivrareRapidă"][index],
      kind: "variable",
      scope: "comparison",
      visible: false,
      sort_order: 20000 + index,
      presentation: {},
      pot: null,
    });
  const budgets = p.budgets.map((budget, index) => ({
    key: budget.id,
    category: budget.id === "camin" ? "locuinta" : budget.id,
    period: budget.kind === "count" ? "week" : "cycle",
    kind: budget.kind,
    limit_minor: budget.limit === undefined ? null : minor(budget.limit),
    count_limit: budget.max ?? null,
    warn_at_percent: budget.warn ? (student ? 100 : 60) : null,
    presentation: without(budget, ["used", "max", "spent", "limit", "warn"]),
    sort_order: index,
  }));
  const subscriptions = p.profile.subscriptions.map((sub, index) => {
    const app = p.apps.items.find((item) => item.name === sub.name);
    return {
      key: sub.name,
      amount_minor: minor(sub.lei),
      monitored: app?.on ?? false,
      profile: without(sub, ["lei"]),
      app: app ? without(app, ["lei", "on"]) : null,
      sort_order: index,
    };
  });
  const historical = [];
  for (let month = 0; month < (student ? 12 : 24); month++) {
    const date = new Date(Date.UTC(2026, 9 - month, 1)).toISOString().slice(0, 10);
    for (const [index, item] of p.profile.spending.entries())
      historical.push({ month: date, group: item.name, amount_minor: -minor(item.lei), sort_order: index });
  }
  const questions = p.questions.map((question, index) => ({
    key: question.id,
    sort_order: index,
    definition: {
      ...without(question, ["options", "fields"]),
      options: question.options.map((option) => without(option, ["selected"])),
      ...(question.fields ? { fields: question.fields.map((field) => without(field, ["value"])) } : {}),
    },
    answer: {
      selected: question.options.filter((option) => option.selected).map((option) => option.label),
      fields: Object.fromEntries((question.fields ?? []).map((field) => [field.label, field.value ?? ""])),
    },
  }));
  scenarios[slug] = {
    account: fixture.accounts.accounts.find((account) => account.id === slug),
    client: p.client,
    mode: student ? "student" : "salary",
    has_categories: "categories" in p,
    templates,
    cycle: {
      start: student ? "2026-11-01" : "2026-11-05",
      end: student ? "2026-11-30" : "2026-12-04",
      opening_minor: student ? 36100 : 0,
    },
    commitments: student
      ? []
      : [240000, 46000, 5500, 2500, 8000].map((amount, index) => ({
          amount_minor: amount,
          name: ["Chirie", "Utilități", "StreamFlix", "MuzicaPlus", "Alte obligații fixe"][index],
        })),
    transactions,
    budgets,
    subscriptions,
    historical,
    questions,
    permissions: p.profile.permissions,
    privacy: fixture.legal.screenPrivacy,
    services_on: p.services.on,
    services: p.services.items,
    chat: p.chat,
    documents: p.statements.files,
    goal: {
      presentation: {
        ...without(p.goal, ["saved", "amount", "plan", "funding"]),
        due: without(p.goal.due, ["date"]),
      },
      target_minor: minor(p.goal.amount),
      opening_minor: student ? 50000 : 0,
      schedule: p.goal.plan.map((item, index) => ({
        month: item.month,
        planned_minor: minor(item.add),
        occurs_on: new Date(Date.UTC(2026, (student ? 9 : 10) + index, student ? 1 : 5))
          .toISOString()
          .slice(0, 10),
      })),
      funding: p.goal.funding.map((item) => ({ name: item.name, amount_minor: minor(item.lei) })),
    },
    pots: p.pots.map((pot, index) => ({
      key: index ? "christmas" : "gifts",
      presentation: without(pot, ["lei"]),
      target_minor: 120000,
      planned: index > 0,
    })),
    gift_counts: student ? [2, 1] : [8, 2],
    idea_forecast: student
      ? { hourly_rate_minor: 5000, hours_per_week: 2, weeks_per_month: 4, starts_on: "2026-12-01" }
      : null,
  };
}
writeFileSync(new URL("../seed/catalog.json", import.meta.url), JSON.stringify(catalog, null, 2) + "\n");
writeFileSync(new URL("../seed/scenarios.json", import.meta.url), JSON.stringify(scenarios, null, 2) + "\n");
