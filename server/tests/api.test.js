import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";
import { migrate, json } from "../src/db.js";
import { seed } from "../src/seed.js";
import { SCREEN_FIELDS } from "../src/read-model.js";
import { testDatabase } from "./database.js";
import { afterEach, beforeEach, request, test } from "./runtime.js";

const original = JSON.parse(await readFile(new URL("./fixtures/frontend-baseline.json", import.meta.url), "utf8"));
const base = "/api/demo/v1";
let db, api, cleanup;
beforeEach(async () => { const fixture = await testDatabase(); db = fixture.pool; cleanup = fixture.cleanup; api = request(createApp(db)); });
afterEach(async () => { await cleanup?.(); });
const get = (slug = "pf", path = "") => api.get(`${base}/personas/${slug}${path}`);
const patch = (path, body, slug = "pf") => api.patch(`${base}/personas/${slug}${path}`).send(body);
const post = (path, body, slug = "pf") => api.post(`${base}/personas/${slug}${path}`).send(body);

for (const slug of ["pf", "student"]) {
  test(`${slug}: the complete API response exactly matches the original frontend`, async () => {
    const response = await get(slug);
    assert.equal(response.status, 200); assert.deepEqual(response.body, original.personas[slug]);
  });
  for (const [screen, fields] of Object.entries(SCREEN_FIELDS).filter(([screen]) => screen !== "products")) test(`${slug}: ${screen} preserves its screen's original data shape`, async () => {
    const response = await get(slug, `/${screen}`);
    const expected = Object.fromEntries(fields.filter((field) => field in original.personas[slug]).map((field) => [field, original.personas[slug][field]]));
    assert.equal(response.status, 200); assert.deepEqual(response.body, expected);
  });
}

test("the login and static catalog are served without personal hardcoded frontend modules", async () => {
  assert.deepEqual((await api.get(`${base}/accounts`)).body, original.accounts);
  const catalog = (await api.get(`${base}/catalog`)).body;
  assert.deepEqual(catalog.categories, original.categories); assert.deepEqual(catalog.legal, original.legal);
});

test("migrations and seed are idempotent and do not overwrite user edits", async () => {
  await patch("/transactions/t1", { name: "Cafea redenumită" });
  await migrate(db); await seed(db);
  const data = (await get()).body;
  assert.equal(data.days[0].items[0].name, "Cafea redenumită");
  assert.equal(data.days.flatMap((day) => day.items).length, 20);
});

test("excluding one coffee recalculates cycle, week and budget from transaction facts", async () => {
  const response = await patch("/transactions/t1", { excluded: true });
  assert.equal(response.status, 200);
  assert.equal(response.body.cycle.spent, 709); assert.equal(response.body.cycle.left, 1271);
  assert.equal(response.body.week.spent, 164);
  assert.equal(response.body.budgets.find((budget) => budget.id === "cafenele").used, 2);
  assert.equal((await get()).body.cycle.left, 1271);
});

test("recategorization resolves review and updates category amounts without changing transaction money", async () => {
  const data = (await patch("/transactions/t14", { category: "cumparaturi", name: "Cumpărături", note: "Test", tags: ["familie"] })).body;
  assert.equal(data.cycle.spent, 739); assert.equal(data.review, null); assert.equal(data.question, null);
  assert.equal(data.spending.parts.find((part) => part.id === "cumparaturi").lei, 120);
  assert.equal((await get("pf", "/transactions/t14")).body.note, "Test");
});

test("merchant rules apply only to the active persona", async () => {
  const data = (await patch("/transactions/t1", { name: "Cafeaua mea", category: "cafenele", rule: true })).body;
  assert.ok(data.days.flatMap((day) => day.items).filter((tx) => tx.merchant === "Boabe & Co").every((tx) => tx.name === "Cafeaua mea"));
  assert.deepEqual((await get("student")).body, original.personas.student);
});

test("split parts conserve every ban and update spending categories", async () => {
  const data = (await post("/transactions/t1/splits", { parts: [{ category: "alimente", amount_minor: 1000 }, { category: "cafenele", amount_minor: 2000 }] })).body;
  assert.equal(data.cycle.spent, 739);
  assert.equal(data.spending.parts.find((part) => part.id === "alimente").lei, 164);
  assert.equal(data.spending.parts.find((part) => part.id === "cafenele").lei, 145);
  const saved = await patch("/transactions/t1", { name: "Împărțită", category: "cafenele" });
  assert.equal(saved.body.days[0].items[0].splits.length, 2);
  const bad = await post("/transactions/t1/splits", { parts: [{ category: "alimente", amount_minor: 900 }, { category: "cafenele", amount_minor: 2000 }] });
  assert.equal(bad.status, 400);
  assert.equal((await get()).body.spending.total, 739);
});

test("a new budget removes its category from unbudgeted spending", async () => {
  const response = await post("/budgets", { category: "taxi", name: "Taxi", kind: "amount", limit_minor: 10000, period: "cycle" });
  assert.equal(response.status, 200);
  const budget = response.body.budgets.find((budget) => budget.name === "Taxi");
  assert.equal(budget.spent, 40); assert.equal(budget.limit, 100);
  assert.equal(response.body.unbudgeted.total, 274);
  const changed = await patch(`/budgets/${budget.id}`, { limit_minor: 12500 });
  assert.equal(changed.body.budgets.find((item) => item.id === budget.id).limit, 125);
});

test("new categories persist in the persona's picker and are isolated from Matei", async () => {
  const response = await post("/categories", { label: "Animale" });
  assert.equal(response.status, 200);
  const key = Object.keys(response.body.categories).find((id) => response.body.categories[id].label === "Animale");
  assert.ok(key); assert.ok(response.body.pickerCategories.includes(key));
  assert.equal((await patch("/transactions/t14", { category: key })).status, 200);
  assert.ok(!(await get("student")).body.categories);
});

test("profile edits update the displayed account name and are retained after a new read", async () => {
  const items = original.personas.pf.profile.about.map((item) => ({ label: item.label, value: item.label === "Prenume" ? "Ana" : item.value }));
  const response = await patch("/profile/about", { items });
  assert.equal(response.status, 200); assert.equal(response.body.client.firstName, "Ana");
  assert.equal((await api.get(`${base}/accounts`)).body.accounts[0].name, "Ana Ionescu");
});

test("permissions, privacy and service preferences persist", async () => {
  const data = (await patch("/preferences", { permissions: { contacts: false }, privacy: { "hide-amounts": true }, services_on: false })).body;
  assert.equal(data.profile.permissions.find((item) => item.id === "contacts").on, false); assert.equal(data.services.on, false);
  const preferences = (await get("pf", "/preferences")).body;
  assert.equal(preferences.privacy.find((item) => item.id === "hide-amounts").on, true);
});

test("app monitoring and gift forecasts use persisted choices", async () => {
  assert.equal((await patch(`/apps/${encodeURIComponent("FitZone Gym")}`, { on: false })).body.apps.items[0].on, false);
  const response = await patch("/calendar", { connected: "phone", gift_choices: ["50 lei", "100 lei"] });
  assert.equal(response.status, 200); assert.match(response.body.calendar.gift.result, /600 lei/);
  const custom = await patch("/calendar", { gift_choices: ["75,50 lei", "100 lei"] });
  assert.match(custom.body.calendar.gift.result, /804 lei/);
  assert.equal((await get("pf", "/preferences")).body.calendar_connected, "phone");
});

test("question answers are validated and persist independently for each persona", async () => {
  const question = original.personas.pf.questions[0];
  const body = { selected: [question.options[2].label], fields: { "Spune cu cuvintele tale": "Vreau să economisesc." } };
  const response = await api.put(`${base}/personas/pf/answers/${question.id}`).send(body);
  assert.equal(response.status, 200); assert.equal(response.body.questions[0].fields[0].value, "Vreau să economisesc.");
  assert.deepEqual((await get("student")).body.questions, original.personas.student.questions);
});

test("chat messages and proposal decisions are durable without inventing an AI reply", async () => {
  const count = original.personas.pf.chat.length;
  const response = await post("/chat/messages", { text: "Bună!" });
  assert.equal(response.body.chat.length, count + 1); assert.deepEqual(response.body.chat.at(-1), { type: "me", text: "Bună!" });
  const index = original.personas.pf.chat.findIndex((message) => message.actions);
  const answer = await post(`/chat/${index}/decision`, { action: "Da, amintește-mi" });
  assert.match(answer.body.chat[index].done, /Da, amintește-mi/);
  assert.equal((await get()).body.chat.length, count + 1);
});

test("service and idea decisions save intent without changing actual income", async () => {
  const action = original.personas.student.services.items[0].actions[1];
  const response = await patch("/services/savingbox", { action }, "student");
  assert.equal(response.body.services.items[0].decision, action);
  const idea = await post("/ideas/decision", { decision: "accepted" }, "student");
  assert.equal(idea.body.ideas.featured.decision, "accepted"); assert.equal(idea.body.cycle.total, 1861);
  assert.equal(idea.body.goal.due.date, "decembrie 2026");
  assert.equal(idea.body.goal.saved, 650);
});

test("document and receipt contents are stored in the database", async () => {
  const payload = { name: "extras.csv", mime: "text/csv", content_base64: Buffer.from("date;amount\n12.11.2026;1,00").toString("base64") };
  const response = await post("/statements", payload);
  assert.equal(response.status, 200); assert.equal(response.body.statements.files.at(-1).name, "extras.csv");
  const receipt = await post("/transactions/t1/receipt", { ...payload, name: "bon.pdf", mime: "application/pdf" });
  assert.equal(receipt.body.days[0].items[0].receipt.name, "bon.pdf");
  const stored = await db.query("SELECT content FROM documents WHERE name=$1", ["extras.csv"]);
  assert.equal(Buffer.from(stored.rows[0].content).toString(), "date;amount\n12.11.2026;1,00");
});

test("importing the same demo period is idempotent", async () => {
  const period = original.personas.pf.statements.periods[0];
  await post("/imports", { period }); await post("/imports", { period });
  assert.equal((await get()).body.days.flatMap((day) => day.items).length, 20);
  assert.equal((await db.query("SELECT * FROM decisions WHERE decision_key=$1", [`import:${period}`])).rowCount, 1);
});

test("idempotency keys prevent duplicate writes after a lost response", async () => {
  const path = `${base}/personas/pf/chat/messages`;
  await api.post(path).set("Idempotency-Key", "request-one").send({ text: "O singură dată" });
  const replay = await api.post(path).set("Idempotency-Key", "request-one").send({ text: "O singură dată" });
  assert.equal(replay.status, 200); assert.equal(replay.body.chat.filter((message) => message.text === "O singură dată").length, 1);
  assert.equal((await api.post(path).set("Idempotency-Key", "request-one").send({ text: "Alt mesaj" })).status, 409);
});

test("revision checks reject stale edits", async () => {
  const response = await api.patch(`${base}/personas/pf/transactions/t1`).set("If-Match", "999").send({ name: "vechi" });
  assert.equal(response.status, 409); assert.equal((await get()).body.days[0].items[0].name, "Cafea și covrig");
});

test("deactivation deletes the coach's data, restart does not resurrect it, and explicit activation restores the demo", async () => {
  const response = await api.delete(`${base}/personas/pf/coach`);
  assert.equal(response.status, 204); assert.equal((await get()).status, 410);
  const remaining = (await db.query("SELECT * FROM transactions")).rows;
  assert.equal(remaining.filter((row) => row.legacy_id === "t1").length, 0);
  await seed(db); assert.equal((await get()).status, 410);
  assert.equal((await get("pf", "/products")).status, 200);
  assert.equal((await api.get(`${base}/accounts`)).body.accounts.length, 2);
  assert.equal((await post("/coach", {})).status, 200);
  assert.deepEqual((await get()).body, original.personas.pf);
});

test("search and filters operate on the active persona", async () => {
  const response = await get("student", "/tracking?q=Campus&filter=expenses");
  assert.equal(response.status, 200);
  assert.ok(response.body.days.flatMap((day) => day.items).every((item) => item.merchant.includes("Campus")));
  assert.equal((await get("student", "/transactions/t1")).status, 404);
});

for (const [path, body] of [
  ["/transactions/t1", { amount_minor: -100 }], ["/transactions/t1", { category: "__proto__" }],
  ["/preferences", { permissions: { unknown: true } }], ["/preferences", { services_on: "false" }],
  ["/budgets", { category: "taxi", limit_minor: 12.5 }], ["/calendar", { gift_choices: ["bad", "100 lei"] }],
]) test(`reject invalid mutation ${path} ${JSON.stringify(body)}`, async () => {
  const response = path === "/budgets" ? await post(path, body) : await patch(path, body);
  assert.equal(response.status, 400); assert.ok(response.body.error.message);
  assert.deepEqual((await get()).body, original.personas.pf);
});

test("errors never expose SQL, raw descriptions or credentials", async () => {
  const broken = request(createApp({ async connect() { throw new Error("PRIVATE database password and bank description"); } }));
  const response = await broken.get(`${base}/personas/pf`);
  assert.equal(response.status, 500); assert.ok(!JSON.stringify(response.body).includes("PRIVATE"));
  assert.equal((await api.get("/api/v1/transactions")).status, 404);
  assert.equal((await get("unknown")).status, 404);
});

test("DEMO_TODAY changes the day and time-dependent calculations, never the host clock", async () => {
  const tomorrow = request(createApp(db, { today: "2026-11-13" }));
  const response = await tomorrow.get(`${base}/personas/pf`);
  assert.match(response.body.today.label, /13 noiembrie/); assert.equal(response.body.cycle.daysLeftLabel, "22 de zile");
  assert.equal(response.body.days[0].label, "Ieri"); assert.equal(response.body.cycle.left, 1241);
});

test("database stores financial facts in minor units, with no cached cycle or budget totals", async () => {
  const transaction = (await db.query("SELECT * FROM transactions WHERE legacy_id=$1", ["t1"])).rows[0];
  assert.equal(Number(transaction.amount_minor), -3000);
  const persona = (await db.query("SELECT * FROM personas WHERE mode=$1", ["salary"])).rows[0];
  assert.equal(json(persona.templates).cycle.left, undefined);
  assert.equal(json(persona.templates).spending.total, undefined);
  assert.ok((await db.query("SELECT * FROM budgets")).rows.every((budget) => !("spent" in json(budget.presentation))));
});

test("progress and percentages come from the server", async () => {
  const metric = (await get("student", "/metrics")).body;
  assert.equal(metric.budgets.iesiri, 100); assert.equal(metric.budgets.livrari, 86 / 120 * 100);
  assert.equal(metric.goal, 650 / 1200 * 100);
  assert.equal(metric.categories.alimente, Math.round(297 / 611 * 100));
});
