import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../src/app.js";
import { generateLedger } from "../src/history.js";
import { migrate, json } from "../src/db.js";
import { scenarios, seed } from "../src/seed.js";
import { loadModel, present, SCREEN_FIELDS } from "../src/read-model.js";
import { testDatabase } from "./database.js";
import { afterEach, beforeEach, request, test } from "./runtime.js";

const original = JSON.parse(await readFile(new URL("./fixtures/frontend-baseline.json", import.meta.url), "utf8"));
const base = "/api/demo/v1";
let db, api, cleanup;
beforeEach(async () => {
  const fixture = await testDatabase();
  db = fixture.pool;
  cleanup = fixture.cleanup;
  api = request(createApp(db));
});
afterEach(async () => {
  await cleanup?.();
});
const get = (slug = "pf", path = "") => api.get(`${base}/personas/${slug}${path}`);
const patch = (path, body, slug = "pf") => api.patch(`${base}/personas/${slug}${path}`).send(body);
const post = (path, body, slug = "pf") => api.post(`${base}/personas/${slug}${path}`).send(body);
const at = (value, path) => path.split(".").reduce((item, key) => item?.[key], value);
const items = (data) => data.days.flatMap((day) => day.items);
// Fields added by the fact model (state, ids) are not part of the original screen.
const strip = (value) => JSON.parse(JSON.stringify(value, (key, item) => (["state", "id", "position", "selected_minor", "history"].includes(key) && typeof item !== "object" ? undefined : item)));

// Values the scenarios define: they must come out of the stored facts unchanged.
const SCENARIO = {
  shared: [
    "today", "client", "cycle", "lastMessage", "week.spent", "week.daysSoFar", "week.guidePerDay", "week.days",
    "allocation", "budgets", "budgetGroups", "unbudgeted", "review", "question.txId", "question.amount",
    "question.merchant", "question.date", "spending.total", "spending.fixed", "spending.parts", "spending.period",
    "spending.title", "goal", "pots", "nextGoals", "reserve", "findings.items", "findings.firstStep",
    "calendar.found", "calendar.gift.result", "apps", "profile.money", "profile.income",
    "profile.observed.0", "profile.observed.2", "profile.subscriptions", "insight.figure",
    "profile.about.0", "profile.about.1", "profile.about.2", "profile.about.3", "categoryNotes",
  ],
  pf: ["agenda", "services", "profile.spending"],
  student: ["agenda", "essentials", "insight", "ideas.featured.title", "ideas.featured.text", "ideas.featured.effects", "ideas.featured.why", "ideas.groups", "profile.observed.1", "profile.permissions"],
};

for (const slug of ["pf", "student"])
  test(`${slug}: stored facts reproduce the scenario's screen values`, async () => {
    const response = await get(slug);
    assert.equal(response.status, 200);
    for (const path of [...SCENARIO.shared, ...SCENARIO[slug]])
      assert.deepEqual(strip(at(response.body, path)), strip(at(original.personas[slug], path)), `${slug}.${path}`);
  });

test("the seeded state renders without a missing fact in any template", async () => {
  for (const slug of ["pf", "student"]) present(await loadModel(db, slug), "2026-11-12", { strict: true });
});

test("there is no simulated processing, fake file or fake unread message", async () => {
  for (const slug of ["pf", "student"]) {
    const data = (await get(slug)).body;
    const text = JSON.stringify(data);
    assert.ok(!/Se procesează|"progress"|reading|running/.test(text), slug);
    assert.deepEqual(data.statements.files, []);
    assert.equal(data.analysis.status, "done");
    assert.ok(data.analysis.items.every((item) => item.state === "done"));
    assert.deepEqual(data.chatStatus, { unread: 0, coachReplies: false });
    // The import summary counts the rows that the import actually linked.
    const imported = await db.query(
      "SELECT COUNT(*) AS n FROM transactions t JOIN personas p ON p.id=t.persona_id JOIN demo_accounts a ON a.id=p.account_id WHERE a.slug=$1 AND t.import_id IS NOT NULL",
      [slug],
    );
    assert.match(data.statements.imported.meta, new RegExp(`· ${Number(imported.rows[0].n)} de plăți ·`));
    assert.equal(data.analysis.items[2].note, `${Number(imported.rows[0].n)} din ${Number(imported.rows[0].n)}`);
  }
});

// Bank product terms and editorial titles are product facts, not the persona's data.
const PRODUCT_FACTS = [
  "templates.intro.duration", "templates.statements.lead", "templates.statements.formats",
  "templates.ideas.groups[1].items[0].title", "templates.ideas.groups[1].items[0].text",
  "templates.ideas.groups[1].items[2].text", "templates.ideas.groups[1].items[3].text",
  "services[0].description", "services[0].helps", "services[0].why", "services[2].description", "services[2].helps",
];
test("seed copy holds no numbers outside placeholders, except product facts", async () => {
  const offending = [];
  const walk = (value, path) => {
    if (typeof value === "string") {
      if (/\d/.test(value.replace(/\{\{[^{}]+\}\}/g, "")) && !PRODUCT_FACTS.includes(path)) offending.push(`${path}: ${value}`);
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value))
        if (!["products", "entry", "terms", "source", "link", "href"].includes(key)) walk(item, path ? `${path}.${key}` : key);
  };
  for (const scenario of Object.values(scenarios)) {
    walk(scenario.templates, "templates");
    walk(scenario.services, "services");
    walk(scenario.goals.map((goal) => goal.copy), "goals");
  }
  assert.deepEqual(offending, []);
  const text = JSON.stringify(scenarios);
  for (const frozen of ["3.020 lei", "978 de plăți", "1.946", "24 de luni", "Se procesează", "extras_alta_banca"])
    assert.ok(!text.includes(frozen), frozen);
});

test("the generated ledger ends at each persona's opening balance of the current period", () => {
  assert.equal(generateLedger("pf", scenarios.pf.ledger).closing_minor, 0);
  assert.equal(generateLedger("student", scenarios.student.ledger).closing_minor, 36100);
});

test("changing a fact changes every sentence that mentions it", async () => {
  await db.query("UPDATE pots SET target_minor=$1 WHERE pot_key=$2", [150000, "gifts"]);
  await db.query("UPDATE commitments SET amount_minor=$1 WHERE name=$2", [250000, "Chirie"]);
  const data = (await get()).body;
  assert.equal(data.pots[0].note, "Rămași din 1.500 lei, pentru 7 ocazii");
  assert.equal(data.findings.firstStep.text.includes("cei 1.500 lei pentru cadouri"), true);
  assert.equal(data.profile.money.find((row) => row.id === "fixed").value, "3.120 lei pe lună");
  assert.equal(data.cycle.fixed, 3120);
});

test("migrations and seed are idempotent and do not overwrite user edits", async () => {
  await patch("/transactions/t1", { name: "Cafea redenumită" });
  await migrate(db);
  await seed(db);
  const data = (await get()).body;
  assert.equal(data.days[0].items[0].name, "Cafea redenumită");
  assert.equal(items(data).length, 23);
});

test("excluding one coffee recalculates cycle, week and budget from transaction facts", async () => {
  const response = await patch("/transactions/t1", { excluded: true });
  assert.equal(response.status, 200);
  assert.equal(response.body.cycle.spent, 709);
  assert.equal(response.body.cycle.left, 1271);
  assert.equal(response.body.week.spent, 164);
  assert.equal(response.body.budgets.find((budget) => budget.id === "cafenele").used, 2);
  assert.equal(response.body.lastMessage, null);
  assert.equal((await get()).body.cycle.left, 1271);
});

test("recategorization resolves review and updates category amounts without changing transaction money", async () => {
  const data = (await patch("/transactions/t14", { category: "cumparaturi", name: "Cumpărături", note: "Test", tags: ["familie"] })).body;
  assert.equal(data.cycle.spent, 739);
  assert.equal(data.review, null);
  assert.equal(data.question, null);
  assert.equal(data.filters[3].label, "Fără categorie · 0");
  assert.equal(data.spending.parts.find((part) => part.id === "cumparaturi").lei, 120);
  assert.equal((await get("pf", "/transactions/t14")).body.note, "Test");
});

test("merchant rules rename the merchant's payments and apply only to the active persona", async () => {
  const data = (await patch("/transactions/t4", { name: "Cumpărături de seară", category: "alimente", rule: true })).body;
  assert.ok(items(data).filter((tx) => tx.merchant === "Market Express").every((tx) => tx.name === "Cumpărături de seară" && tx.rule));
  assert.match(items(data).find((tx) => tx.id === "t4").history, /^Ultimele 3 luni: \d+ (de )?plăți, [\d.]+ lei$/);
  const rules = await db.query("SELECT r.* FROM merchant_rules r JOIN merchants m ON m.id=r.merchant_id WHERE m.name=$1", ["Market Express"]);
  assert.equal(rules.rowCount, 1);
  assert.ok(!items((await get("student")).body).some((tx) => tx.name === "Cumpărături de seară"));
});

test("split parts conserve every ban and update spending categories", async () => {
  const data = (await post("/transactions/t1/splits", { parts: [{ category: "alimente", amount_minor: 1000 }, { category: "cafenele", amount_minor: 2000 }] })).body;
  assert.equal(data.cycle.spent, 739);
  assert.equal(data.spending.parts.find((part) => part.id === "alimente").lei, 164);
  assert.equal(data.spending.parts.find((part) => part.id === "cafenele").lei, 145);
  const bad = await post("/transactions/t1/splits", { parts: [{ category: "alimente", amount_minor: 900 }, { category: "cafenele", amount_minor: 2000 }] });
  assert.equal(bad.status, 400);
  assert.equal((await get()).body.spending.total, 739);
});

test("a new budget removes its category from unbudgeted spending", async () => {
  const response = await post("/budgets", { category: "taxi", name: "Taxi", kind: "amount", limit_minor: 10000, period: "cycle" });
  assert.equal(response.status, 200);
  const budget = response.body.budgets.find((item) => item.name === "Taxi");
  assert.equal(budget.spent, 40);
  assert.equal(budget.limit, 100);
  assert.equal(budget.note, "Stabilit de tine");
  assert.equal(response.body.unbudgeted.total, 274);
  const changed = await patch(`/budgets/${budget.id}`, { limit_minor: 12500 });
  assert.equal(changed.body.budgets.find((item) => item.id === budget.id).limit, 125);
  const coffee = await patch("/budgets/cafenele", { count_limit: 4 });
  assert.equal(coffee.body.budgets.find((item) => item.id === "cafenele").note, "3 din 4 săptămâna aceasta · următoarea, de luni");
  assert.equal(coffee.body.categoryNotes.cafenele, "Intră la bugetul Cafenele: cel mult 4 pe săptămână.");
  assert.equal(coffee.body.lastMessage, null);
});

test("new categories persist in the persona's picker and are isolated from Matei", async () => {
  const response = await post("/categories", { label: "Animale" });
  assert.equal(response.status, 200);
  const key = Object.keys(response.body.categories).find((id) => response.body.categories[id].label === "Animale");
  assert.ok(response.body.pickerCategories.includes(key));
  assert.equal((await patch("/transactions/t14", { category: key })).status, 200);
  assert.ok(!(await get("student")).body.categories);
});

test("profile corrections are stored as the user's statements and rename the account", async () => {
  const response = await patch("/profile/about", { items: [{ id: "firstName", label: "Prenume", value: "Ana" }, { id: "household", label: "Gospodărie", value: "2 persoane" }] });
  assert.equal(response.status, 200);
  assert.equal(response.body.client.firstName, "Ana");
  assert.equal(response.body.profile.about.find((row) => row.id === "household").value, "2 persoane");
  assert.equal((await api.get(`${base}/accounts`)).body.accounts[0].name, "Ana Ionescu");
  const memory = await db.query("SELECT * FROM user_memory WHERE memory_key=$1", ["profile.about.household"]);
  assert.equal(memory.rows[0].kind, "correction");
});

test("permissions, privacy and service preferences persist", async () => {
  const data = (await patch("/preferences", { permissions: { contacts: false }, privacy: { "hide-amounts": true }, services_on: false })).body;
  assert.equal(data.profile.permissions.find((item) => item.id === "contacts").on, false);
  assert.equal(data.services.on, false);
  assert.equal((await get("pf", "/preferences")).body.privacy.find((item) => item.id === "hide-amounts").on, true);
});

test("app monitoring and gift forecasts use persisted choices in bani", async () => {
  const off = (await patch(`/apps/${encodeURIComponent("FitZone Gym")}`, { on: false })).body;
  assert.equal(off.apps.items[0].on, false);
  assert.equal(off.profile.permissions.find((item) => item.id === "screen").on, false);
  const response = await patch("/calendar", { connected: "phone", gift_choices_minor: [5000, 10000] });
  assert.equal(response.status, 200);
  assert.match(response.body.calendar.gift.result, /600 lei/);
  assert.equal(response.body.calendar.found[0].note, "Din calendarul telefonului");
  const custom = await patch("/calendar", { gift_choices_minor: [7550, 10000] });
  assert.match(custom.body.calendar.gift.result, /804 lei/);
  assert.equal(custom.body.calendar.gift.groups[0].selected, "75,50 lei");
  assert.equal((await patch("/calendar", { gift_choices_minor: ["50 lei", 100] })).status, 400);
});

test("question answers are validated, respect single choice and feed the profile", async () => {
  const question = original.personas.pf.questions[4];
  const body = { selected: ["Doar când e important"], fields: { "Fără notificări de la": "21:00", "până la": "08:00", "Rezumatul săptămânal": "Luni, la 08:00" } };
  const response = await api.put(`${base}/personas/pf/answers/${question.id}`).send(body);
  assert.equal(response.status, 200);
  assert.equal(response.body.profile.talk.find((row) => row.id === "quiet").value, "21:00 – 08:00");
  assert.equal(response.body.profile.talk.find((row) => row.id === "notifications").value, "Doar când e important");
  const two = await api.put(`${base}/personas/pf/answers/${question.id}`).send({ ...body, selected: ["Doar când e important", "Cel mult o dată pe zi"] });
  assert.equal(two.status, 400);
  assert.deepEqual(strip((await get("student")).body.questions.map((q) => q.options)), strip(original.personas.student.questions.map((q) => q.options)));
});

test("chat messages are stored with a timestamp and no invented reply", async () => {
  const count = (await get()).body.chat.length;
  const response = await post("/chat/messages", { text: "Bună!" });
  assert.equal(response.body.chat.length, count + 1);
  assert.deepEqual(response.body.chat.at(-1), { type: "me", text: "Bună!" });
  assert.equal(response.body.chatStatus.coachReplies, false);
  const proposal = response.body.chat.find((message) => message.actions);
  const answer = await post(`/chat/${proposal.position}/decision`, { action: "Da, amintește-mi" });
  assert.equal(answer.body.chat.find((message) => message.position === proposal.position).done, "Da, amintește-mi · 12 noiembrie");
  assert.equal((await post(`/chat/${proposal.position}/decision`, { action: "Nu acum" })).status, 404);
});

test("service and idea decisions save intent without changing actual income", async () => {
  const action = original.personas.student.services.items[0].actions[1];
  const response = await patch("/services/savingbox", { action }, "student");
  assert.equal(response.body.services.items[0].decision, action);
  const idea = await post("/ideas/decision", { decision: "accepted" }, "student");
  assert.equal(idea.body.ideas.featured.decision, "accepted");
  assert.equal(idea.body.cycle.total, 1861);
  assert.equal(idea.body.goal.due.date, "decembrie 2026");
  assert.equal(idea.body.goal.saved, 650);
});

test("receipts are stored in the database and linked to their payment", async () => {
  const content = Buffer.from("%PDF-1.4 bon").toString("base64");
  const receipt = await post("/transactions/t1/receipt", { name: "bon.pdf", mime: "application/pdf", content_base64: content });
  assert.equal(receipt.body.days[0].items[0].receipt.name, "bon.pdf");
  const stored = await db.query("SELECT content FROM documents WHERE name=$1", ["bon.pdf"]);
  assert.equal(Buffer.from(stored.rows[0].content).toString(), "%PDF-1.4 bon");
});

const csv = "Data inregistrare;Data tranzactiei;Descriere;Debit;Credit;Sold\n02.10.2026;02.10.2026;POS 02.10.2026 LIDL BUCURESTI;50,00;;100,00\n";
const pythonStub = (behaviour = "ok") => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push(url);
    if (behaviour === "down") throw new Error("connection refused");
    if (url.includes("/accounts/import"))
      return new Response(JSON.stringify(behaviour === "invalid" ? { status: "failed", error_code: "invalid_csv" } : { status: "completed", account_id: "acc-1", duplicate_count: 0 }), { status: 202 });
    assert.match(options.headers["X-User-Id"], /^[0-9a-f-]{36}$/);
    return new Response(JSON.stringify({
      total: 2, limit: 200, offset: 0,
      items: [
        { id: "py-1", account_id: "acc-1", occurred_at: "2026-10-02T10:00:00Z", amount_minor: -5000, description_raw: "POS 02.10.2026 LIDL BUCURESTI", category: "groceries" },
        { id: "py-2", account_id: "acc-1", occurred_at: "2026-10-03T10:00:00Z", amount_minor: 20000, description_raw: "TRANSFER PRIMIT", category: "salary" },
      ],
    }), { status: 200 });
  };
  return { calls, options: { baseUrl: "http://python.test", fetcher } };
};
const upload = (app, name = "extras.csv", content = csv) =>
  request(app).post(`${base}/personas/pf/statements`).send({ name, mime: "text/csv", content_base64: Buffer.from(content).toString("base64") });

test("a CSV statement is parsed by the Python service and its rows are added without duplicates", async () => {
  const stub = pythonStub();
  const app = createApp(db, { parser: stub.options });
  const first = await upload(app);
  assert.equal(first.status, 200);
  const file = first.body.statements.files.at(-1);
  assert.deepEqual([file.name, file.state, file.meta], ["extras.csv", "done", "2 plăți noi"]);
  assert.match(first.body.profile.statements[1].note, /1 fișier · 2 plăți/);
  assert.match(first.body.analysis.status, /stale|done/);
  const second = await upload(app, "extras-din-nou.csv");
  assert.equal(second.body.statements.files.at(-1).meta, "0 plăți noi · 2 plăți existente");
  const rows = await db.query("SELECT * FROM transactions WHERE external_id LIKE 'python:%'");
  assert.equal(rows.rowCount, 2);
  assert.equal(rows.rows.find((row) => row.external_id === "python:py-1").category, "alimente");
  assert.ok(stub.calls[0].startsWith("http://python.test/api/v1/accounts/import"));
});

test("unreadable or unsupported statements report what really happened", async () => {
  const down = await upload(createApp(db, { parser: pythonStub("down").options }));
  assert.deepEqual([down.body.statements.files.at(-1).state, down.body.statements.files.at(-1).meta], ["failed", "Serviciul care citește extrasele nu răspunde. Încearcă din nou mai târziu."]);
  const invalid = await upload(createApp(db, { parser: pythonStub("invalid").options }), "gresit.csv");
  assert.equal(invalid.body.statements.files.at(-1).state, "failed");
  const pdf = await request(createApp(db)).post(`${base}/personas/pf/statements`).send({ name: "extras.pdf", mime: "application/pdf", content_base64: Buffer.from("%PDF").toString("base64") });
  assert.deepEqual([pdf.body.statements.files.at(-1).state, pdf.body.statements.files.at(-1).meta], ["stored", "Salvat · în demo citesc doar extrase CSV"]);
  assert.equal((await db.query("SELECT * FROM transactions WHERE account_key LIKE 'statement:%'")).rowCount, 0);
});

test("a reactivated coach runs the real flow: import, analysis, findings", async () => {
  assert.equal((await api.delete(`${base}/personas/pf/coach`)).status, 204);
  const fresh = (await post("/coach", {})).body;
  assert.equal(fresh.statements.imported, null);
  assert.equal(fresh.analysis.status, "none");
  assert.deepEqual(fresh.findings.items, []);
  assert.deepEqual(fresh.chat, []);
  assert.equal((await post("/analysis", {})).status, 409);
  const imported = (await post("/imports", { months: 12 })).body;
  assert.match(imported.statements.imported.title, /^12 extrase lunare importate$/);
  assert.equal(imported.analysis.status, "none");
  const analysed = (await post("/analysis", {})).body;
  assert.equal(analysed.analysis.status, "done");
  const types = analysed.findings.items.map((item) => item.text);
  assert.ok(types.some((text) => text.startsWith("Între 27 și 5 ale lunii ai sub 100 lei")));
  assert.ok(types.some((text) => text.includes("Boabe & Co")));
  assert.ok(types.some((text) => text.startsWith("FitZone Gym: 220 lei pe lună")));
  const again = (await post("/imports", { months: 12 })).body;
  assert.equal(again.analysis.status, "stale");
  const counts = await db.query("SELECT rows_imported, rows_duplicate FROM imports ORDER BY created_at");
  assert.equal(Number(counts.rows.at(-1).rows_imported), 0);
});

test("idempotency keys prevent duplicate writes after a lost response", async () => {
  const path = `${base}/personas/pf/chat/messages`;
  await api.post(path).set("Idempotency-Key", "request-one").send({ text: "O singură dată" });
  const replay = await api.post(path).set("Idempotency-Key", "request-one").send({ text: "O singură dată" });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.chat.filter((message) => message.text === "O singură dată").length, 1);
  assert.equal((await api.post(path).set("Idempotency-Key", "request-one").send({ text: "Alt mesaj" })).status, 409);
});

test("revision checks reject stale edits", async () => {
  const response = await api.patch(`${base}/personas/pf/transactions/t1`).set("If-Match", "999").send({ name: "vechi" });
  assert.equal(response.status, 409);
  assert.equal((await get()).body.days[0].items[0].name, "Cafea și covrig");
});

test("deactivation deletes the coach's data and restart does not resurrect it", async () => {
  assert.equal((await api.delete(`${base}/personas/pf/coach`)).status, 204);
  assert.equal((await get()).status, 410);
  assert.equal((await db.query("SELECT * FROM transactions WHERE legacy_id=$1", ["t1"])).rows.filter((row) => row.external_id.startsWith("pf-")).length, 0);
  await seed(db);
  assert.equal((await get()).status, 410);
  assert.equal((await get("pf", "/products")).status, 200);
  assert.equal((await api.get(`${base}/accounts`)).body.accounts.length, 2);
});

test("search and filters operate on the active persona", async () => {
  const response = await get("student", "/tracking?q=Campus&filter=expenses");
  assert.equal(response.status, 200);
  assert.ok(items(response.body).every((item) => item.merchant.includes("Campus")));
  assert.equal(items((await get("pf", "/tracking?q=2.400")).body)[0].id, "t15");
  assert.equal((await get("pf", "/tracking?filter=nothing")).status, 400);
  assert.equal((await get("student", "/transactions/t1")).status, 404);
});

for (const [path, body] of [
  ["/transactions/t1", { amount_minor: -100 }],
  ["/transactions/t1", { category: "__proto__" }],
  ["/preferences", { permissions: { unknown: true } }],
  ["/preferences", { services_on: "false" }],
  ["/budgets", { category: "taxi", limit_minor: 12.5 }],
  ["/calendar", { gift_choices_minor: [0, 100] }],
  ["/imports", { months: 7 }],
])
  test(`reject invalid mutation ${path} ${JSON.stringify(body)}`, async () => {
    const before = (await get()).body;
    const response = ["/budgets", "/imports"].includes(path) ? await post(path, body) : await patch(path, body);
    assert.equal(response.status, 400);
    assert.ok(response.body.error.message);
    assert.deepEqual((await get()).body, before);
  });

test("errors never expose SQL, raw descriptions or credentials", async () => {
  const broken = request(createApp({ async connect() { throw new Error("PRIVATE database password and bank description"); } }));
  const response = await broken.get(`${base}/personas/pf`);
  assert.equal(response.status, 500);
  assert.ok(!JSON.stringify(response.body).includes("PRIVATE"));
  assert.equal((await api.get("/api/v1/transactions")).status, 404);
  assert.equal((await get("unknown")).status, 404);
});

test("DEMO_TODAY changes the day and time-dependent calculations, never the host clock", async () => {
  const tomorrow = request(createApp(db, { today: "2026-11-13" }));
  const response = await tomorrow.get(`${base}/personas/pf`);
  assert.match(response.body.today.label, /13 noiembrie/);
  assert.equal(response.body.cycle.daysLeftLabel, "22 de zile");
  assert.equal(response.body.days[0].label, "Ieri");
  assert.equal(response.body.cycle.left, 1241);
  assert.equal(response.body.chat.find((item) => item.type === "divider" && item.text === "Ieri")?.text, "Ieri");
  assert.match(response.body.lastMessage.meta, /^Ieri, 08:12/);
});

test("database stores facts in minor units and no screen totals", async () => {
  const transaction = (await db.query("SELECT * FROM transactions WHERE legacy_id=$1", ["t1"])).rows[0];
  assert.equal(Number(transaction.amount_minor), -3000);
  const persona = (await db.query("SELECT * FROM personas WHERE budget_method=$1", ["fixed_first"])).rows[0];
  const templates = json(persona.templates);
  for (const key of ["today", "review", "lastMessage", "agenda.0", "findings.items", "analysis.items", "statements.files", "statements.imported", "cycle.label", "cycle.total", "profile.statements"])
    assert.equal(at(templates, key), undefined, key);
  const history = await db.query("SELECT COUNT(*) AS n FROM transactions WHERE persona_id=$1 AND legacy_id LIKE 'h%'", [persona.id]);
  assert.ok(Number(history.rows[0].n) > 500);
});

test("progress and percentages come from the server", async () => {
  const metric = (await get("student", "/metrics")).body;
  assert.equal(metric.budgets.iesiri, 100);
  assert.equal(metric.budgets.livrari, (86 / 120) * 100);
  assert.equal(metric.goal, (650 / 1200) * 100);
  assert.equal(metric.categories.alimente, Math.round((297 / 611) * 100));
});

test("every screen route returns its fields from the composed persona", async () => {
  for (const slug of ["pf", "student"]) {
    const full = (await get(slug)).body;
    for (const [screen, fields] of Object.entries(SCREEN_FIELDS).filter(([key]) => key !== "products")) {
      const response = await get(slug, `/${screen}`);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, Object.fromEntries(fields.filter((field) => field in full).map((field) => [field, full[field]])));
    }
  }
});
