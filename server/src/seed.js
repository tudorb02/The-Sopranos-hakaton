import { readFile } from "node:fs/promises";
import { insert, insertMany, transaction, uid } from "./db.js";
import { generateLedger } from "./history.js";

export const scenarios = JSON.parse(
  await readFile(new URL("../seed/scenarios.json", import.meta.url), "utf8"),
);
export const catalog = JSON.parse(await readFile(new URL("../seed/catalog.json", import.meta.url), "utf8"));
export const SEED_VERSION = "facts-v2";
const encoded = JSON.stringify;

export function kindOf(persona, category, amount, potKey) {
  if (amount > 0) return "income";
  if (category === "economii") return "saving";
  if (potKey) return "pot";
  return persona.preferences.fixed_categories.includes(category) ? "fixed" : "variable";
}

export async function merchantId(client, personaId, name, category, cache) {
  if (cache?.has(name)) return cache.get(name);
  const existing = await client.query("SELECT id FROM merchants WHERE persona_id=$1 AND name=$2", [personaId, name]);
  const id = existing.rows[0]?.id ?? uid();
  if (!existing.rowCount)
    await insert(client, "merchants", { id, persona_id: personaId, name, category_default: category });
  cache?.set(name, id);
  return id;
}

// Fictional personal data for one demo account. `activate` replays the activation the
// scenario describes (import + analysis); a reactivated coach starts without it.
export async function seedPersona(client, account, scenario, { activate = true, createdAt } = {}) {
  const persona = uid();
  const preferences = {
    permissions: scenario.permissions,
    privacy: scenario.privacy,
    services_on: scenario.services_on,
    calendar_connected: activate ? "google" : null,
    gift_choices_minor: scenario.gift_choices_minor,
    idea_forecast: scenario.idea_forecast,
    fixed_categories: scenario.fixed_categories,
    analysis: scenario.analysis,
  };
  await insert(client, "personas", {
    id: persona,
    account_id: account.id,
    budget_method: scenario.budget_method,
    income_day: scenario.income_day,
    has_categories: scenario.has_categories,
    templates: encoded(scenario.templates),
    preferences: encoded(preferences),
    created_at: createdAt ?? scenario.activation.imported_at,
  });
  const model = { persona: { id: persona }, preferences };
  const add = (table, data) => insert(client, table, { id: uid(), persona_id: persona, ...data });
  const merchants = new Map();
  const merchant = (name, category) => merchantId(client, persona, name, category, merchants);

  const history = generateLedger(account.slug, scenario.ledger).rows;
  const rows = [];
  for (const [index, row] of history.entries())
    rows.push({
      id: uid(),
      persona_id: persona,
      legacy_id: `h${index + 1}`,
      external_id: row.external_id,
      account_key: "current",
      merchant_id: await merchant(row.merchant, row.category),
      occurred_at: row.occurred_at,
      local_date: row.local_date,
      amount_minor: row.amount_minor,
      category: row.category,
      kind: kindOf(model, row.category, row.amount_minor, null),
      status: "booked",
      description_raw: row.description_raw,
      display: encoded(row.name === row.merchant ? {} : { name: row.name }),
    });
  for (const row of scenario.transactions)
    rows.push({
      id: uid(),
      persona_id: persona,
      legacy_id: row.legacy_id,
      external_id: `${account.slug}-${row.legacy_id}`,
      account_key: "current",
      merchant_id: await merchant(row.merchant, row.category),
      occurred_at: row.occurred_at,
      local_date: row.local_date,
      amount_minor: row.amount_minor,
      category: row.category,
      kind: kindOf(model, row.category, row.amount_minor, row.pot_key),
      status: row.status,
      description_raw: row.description_raw,
      pot_key: row.pot_key,
      display: encoded(row.display),
    });
  await insertMany(client, "transactions", rows);

  for (const rule of scenario.merchant_rules)
    await add("merchant_rules", {
      merchant_id: await merchant(rule.merchant, rule.category),
      category: rule.category,
      display_name: rule.display_name,
      created_at: rule.created_at,
    });
  const subscriptions = new Map();
  for (const [sort_order, row] of scenario.subscriptions.entries()) {
    const id = uid();
    subscriptions.set(row.key, id);
    await insert(client, "subscriptions", {
      id,
      persona_id: persona,
      subscription_key: row.key,
      merchant_id: await merchant(row.merchant, "abonamente"),
      name: row.name,
      amount_minor: row.amount_minor,
      has_app: row.has_app,
      app_label: row.app_label,
      monitored: row.monitored,
      plan_note: row.plan_note,
      sort_order,
    });
  }
  await insertMany(
    client,
    "usage_signals",
    scenario.usage_signals.map((row) => ({
      id: uid(),
      persona_id: persona,
      subscription_id: subscriptions.get(row.subscription),
      source: "screen_time",
      occurred_at: row.occurred_at,
    })),
  );
  for (const [sort_order, row] of scenario.commitments.entries())
    await add("commitments", {
      name: row.name,
      category: row.category,
      amount_minor: row.amount_minor,
      due_day: row.due_day,
      subscription_id: row.subscription ? subscriptions.get(row.subscription) : null,
      sort_order,
    });
  for (const row of scenario.expected_incomes) await add("expected_incomes", row);
  for (const row of scenario.budgets)
    await add("budgets", {
      budget_key: row.key,
      category: row.category,
      name: row.name,
      icon: row.icon,
      kind: row.kind,
      period: row.period,
      limit_minor: row.limit_minor,
      count_limit: row.count_limit,
      warn_at_percent: row.warn_at_percent,
      group_key: row.group,
      on_home: row.on_home,
      note_style: row.note_style,
      description: row.description,
      paused_until: row.paused_until,
      notify: row.notify ? encoded(row.notify) : null,
      sort_order: row.sort_order,
      created_at: scenario.activation.analysed_at,
    });
  for (const [sort_order, row] of scenario.goals.entries())
    await add("goals", {
      goal_key: row.key,
      status: row.status,
      name: row.name,
      icon: row.icon,
      target_minor: row.target_minor,
      opening_minor: row.opening_minor,
      starts_on: row.starts_on ?? null,
      rule: row.rule ? encoded(row.rule) : null,
      schedule: encoded(row.schedule),
      funding: encoded(row.funding),
      copy: encoded(row.copy),
      sort_order,
      created_at: scenario.activation.analysed_at,
    });
  for (const [sort_order, row] of scenario.pots.entries())
    await add("pots", {
      pot_key: row.key,
      icon: row.icon,
      target_minor: row.target_minor,
      planned_on: row.planned_on,
      event_month: row.event_month,
      copy: encoded(row.copy),
      sort_order,
    });
  for (const row of scenario.calendar_events) await add("calendar_events", row);
  for (const row of scenario.questions)
    await add("questions", {
      question_key: row.key,
      definition: encoded(row.definition),
      answer: encoded(activate ? row.answer : { selected: [], fields: {} }),
      sort_order: row.sort_order,
    });
  if (activate) {
    for (const row of scenario.memory)
      await add("user_memory", {
        memory_key: row.key,
        kind: row.kind,
        content: row.content,
        amount_minor: row.amount_minor ?? null,
        created_at: row.created_at,
      });
    for (const [position, row] of scenario.messages.entries())
      await add("messages", {
        position,
        role: row.role,
        kind: row.kind,
        body: encoded(row.body),
        decision: row.decision,
        decided_at: row.decided_at,
        read_at: row.created_at,
        created_at: row.created_at,
      });
    for (const row of scenario.access_log) await add("access_log", row);
  }
  for (const [sort_order, payload] of scenario.services.entries())
    await add("services", { service_key: payload.id, payload: encoded(payload), sort_order });
  if (activate) {
    // Imported here to avoid a module cycle: coach.js reads the catalog exported above.
    const { importAccount, runAnalysis } = await import("./coach.js");
    const { loadModel } = await import("./read-model.js");
    const at = scenario.activation;
    await importAccount(client, await loadModel(client, account.slug), at.period_months, at.imported_at);
    await runAnalysis(client, await loadModel(client, account.slug), at.analysed_at);
  }
  return persona;
}

export async function seed(pool) {
  await transaction(pool, async (client) => {
    if (pool.dialect !== "sqlite") await client.query("SELECT pg_advisory_xact_lock(83107202)");
    const existing = await client.query("SELECT version FROM seed_runs WHERE version=$1", [SEED_VERSION]);
    if (existing.rowCount) return;
    for (const [slug, scenario] of Object.entries(scenarios)) {
      const account = {
        id: uid(),
        slug,
        iban_masked: scenario.iban_masked,
        birth_date: scenario.birth_date,
        presentation: encoded(scenario.account),
        client: encoded(scenario.client),
        ledger_opening_minor: scenario.ledger.opening_minor,
      };
      await insert(client, "demo_accounts", account);
      await seedPersona(client, account, scenario);
    }
    await insert(client, "seed_runs", { version: SEED_VERSION });
  });
}
