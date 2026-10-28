import { readFile } from "node:fs/promises";
import { insert, transaction, uid } from "./db.js";

export const scenarios = JSON.parse(await readFile(new URL("../seed/scenarios.json", import.meta.url), "utf8"));
export const catalog = JSON.parse(await readFile(new URL("../seed/catalog.json", import.meta.url), "utf8"));
const encoded = JSON.stringify;

export async function seedPersona(client, account, scenario) {
  const persona = uid();
  await insert(client, "personas", { id: persona, account_id: account.id, mode: scenario.mode,
    has_categories: scenario.has_categories, templates: encoded(scenario.templates),
    preferences: encoded({ permissions: scenario.permissions, privacy: scenario.privacy,
      services_on: scenario.services_on, calendar_connected: "google", gift_counts: scenario.gift_counts, idea_forecast: scenario.idea_forecast }) });
  await insert(client, "cycles", { persona_id: persona, starts_on: scenario.cycle.start, ends_on: scenario.cycle.end, opening_minor: scenario.cycle.opening_minor });
  const add = async (table, data) => insert(client, table, { id: uid(), persona_id: persona, ...data });
  for (const row of scenario.transactions) await add("transactions", {
    legacy_id: row.legacy_id, scope: row.scope ?? "current", occurred_at: row.occurred_at,
    local_date: row.local_date, amount_minor: row.amount_minor, category: row.category,
    merchant: row.merchant, kind: row.kind, visible: row.visible, sort_order: row.sort_order,
    pot_key: row.pot, presentation: encoded(row.presentation),
  });
  for (const row of scenario.commitments) await add("commitments", row);
  for (const row of scenario.budgets) await add("budgets", {
    budget_key: row.key, category: row.category, kind: row.kind, period: row.period,
    limit_minor: row.limit_minor, count_limit: row.count_limit, warn_at_percent: row.warn_at_percent,
    presentation: encoded(row.presentation), sort_order: row.sort_order,
  });
  await add("goals", { target_minor: scenario.goal.target_minor, opening_minor: scenario.goal.opening_minor,
    presentation: encoded(scenario.goal.presentation), schedule: encoded(scenario.goal.schedule), funding: encoded(scenario.goal.funding) });
  for (const [sort_order, row] of scenario.pots.entries()) await add("pots", { pot_key: row.key, target_minor: row.target_minor, planned: row.planned, sort_order, presentation: encoded(row.presentation) });
  for (const row of scenario.subscriptions) await add("subscriptions", { subscription_key: row.key, amount_minor: row.amount_minor,
    monitored: row.monitored, profile: encoded(row.profile), app: row.app ? encoded(row.app) : null, sort_order: row.sort_order });
  for (const row of scenario.historical) await add("historical_spending", { month: row.month, group_name: row.group, amount_minor: row.amount_minor, sort_order: row.sort_order });
  for (const row of scenario.questions) await add("questions", { question_key: row.key, definition: encoded(row.definition), answer: encoded(row.answer), sort_order: row.sort_order });
  for (const [position, payload] of scenario.chat.entries()) await add("messages", { position, payload: encoded(payload) });
  for (const [position, payload] of scenario.documents.entries()) await add("documents", { name: payload.name,
    kind: "statement", mime: payload.name.endsWith(".pdf") ? "application/pdf" : "text/csv", content: Buffer.from("Fictional statement fixture"), presentation: encoded(payload), sort_order: position });
  for (const [position, payload] of scenario.services.entries()) await add("services", { service_key: payload.id, payload: encoded(payload), sort_order: position });
  return persona;
}

export async function seed(pool) {
  await transaction(pool, async (client) => {
    if (pool.dialect !== "sqlite") await client.query("SELECT pg_advisory_xact_lock(83107202)");
    const existing = await client.query("SELECT version FROM seed_runs WHERE version=$1", ["frontend-v1"]);
    if (existing.rowCount) return;
    for (const [slug, scenario] of Object.entries(scenarios)) {
      const account = { id: uid(), slug, presentation: encoded(scenario.account), client: encoded(scenario.client) };
      await insert(client, "demo_accounts", account);
      await seedPersona(client, account, scenario);
    }
    await insert(client, "seed_runs", { version: "frontend-v1" });
  });
}
