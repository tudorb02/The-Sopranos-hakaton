// The coach's data flows: account import, statement import through the Python parser,
// and the deterministic analysis run. Each one writes facts; nothing here formats text.
import { createHash } from "node:crypto";
import { analyse } from "./analysis.js";
import { monthsBack } from "./copy.js";
import { insert, insertMany, uid } from "./db.js";
import { kindOf, merchantId } from "./seed.js";
import { analysisFacts, ledgerView, localDay } from "./read-model.js";

const encode = JSON.stringify;

async function log(db, model, actor, action, at) {
  await insert(db, "access_log", { id: uid(), persona_id: model.persona.id, actor, action, occurred_at: at });
}

// Imports the current account's statements for the last `months` months, up to `at`.
export async function importAccount(db, model, months, at) {
  const to = localDay(at);
  const from = monthsBack(to, months - 1);
  const rows = model.transactions.filter(
    (tx) => tx.account_key === "current" && tx.local_date >= from && tx.local_date <= to,
  );
  const fresh = rows.filter((tx) => !tx.import_id);
  const id = uid();
  await insert(db, "imports", {
    id,
    persona_id: model.persona.id,
    source: "account",
    period_from: from,
    period_to: to,
    status: "done",
    rows_total: rows.length,
    rows_imported: fresh.length,
    rows_duplicate: rows.length - fresh.length,
    created_at: at,
    finished_at: at,
  });
  for (let index = 0; index < fresh.length; index += 500) {
    const part = fresh.slice(index, index + 500).map((tx) => tx.id);
    await db.query(
      `UPDATE transactions SET import_id=$1 WHERE id IN (${part.map((_, i) => `$${i + 2}`).join(",")})`,
      [id, ...part],
    );
  }
  await log(db, model, "coach", `A importat extrasele contului curent (${months} luni)`, at);
  return id;
}

export async function runAnalysis(db, model, at) {
  const asOf = localDay(at);
  const result = analyse(ledgerView(model, asOf), analysisFacts(model), asOf);
  const id = uid();
  await insert(db, "analysis_runs", {
    id,
    persona_id: model.persona.id,
    status: "done",
    as_of: asOf,
    steps: encode(result.steps),
    started_at: at,
    finished_at: at,
  });
  await insertMany(
    db,
    "insights",
    result.insights.map((item) => ({
      id: uid(),
      persona_id: model.persona.id,
      run_id: id,
      type: item.type,
      payload: encode(item.payload),
      status: "new",
      created_at: at,
    })),
  );
  await log(db, model, "coach", "A analizat extrasele importate", at);
  return id;
}

// Python owns the Raiffeisen CSV parser (backend/app/services/csv_parser.py). It is reached
// over its public API, with one dedicated development user per demo persona.
export function pythonUserId(slug) {
  const configured = process.env.PYTHON_DEMO_USERS ? JSON.parse(process.env.PYTHON_DEMO_USERS)[slug] : null;
  if (configured) return configured;
  // uuid5(NAMESPACE_URL, "nexxt-demo:<slug>"), the same id backend/scripts/create_demo_users.py creates.
  const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const hash = createHash("sha1").update(Buffer.concat([namespace, Buffer.from(`nexxt-demo:${slug}`)])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class ParserError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Sends the CSV to Python and returns the parsed rows of that import (amounts in bani).
export async function parseWithPython(slug, file, { baseUrl = process.env.PYTHON_API_URL, fetcher = fetch } = {}) {
  if (!baseUrl) throw new ParserError("parser_unavailable");
  const user = pythonUserId(slug);
  const headers = { "X-User-Id": user };
  const form = new FormData();
  form.append("file", new Blob([file.content], { type: "text/csv" }), file.name);
  let job;
  try {
    const response = await fetcher(`${baseUrl}/api/v1/accounts/import`, { method: "POST", body: form, headers, signal: AbortSignal.timeout(20000) });
    if (response.status === 404) throw new ParserError("parser_unavailable");
    job = await response.json();
    if (!response.ok) throw new ParserError(response.status === 413 ? "file_too_large" : "invalid_csv");
  } catch (error) {
    if (error instanceof ParserError) throw error;
    throw new ParserError("parser_unavailable");
  }
  if (job.status !== "completed") throw new ParserError(job.error_code === "invalid_csv" ? "invalid_csv" : "import_failed");
  // Python has no import filter on /transactions; the persona's dedicated user owns only demo uploads.
  const items = [];
  for (let offset = 0; ; offset += 200) {
    const response = await fetcher(`${baseUrl}/api/v1/transactions?limit=200&offset=${offset}`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new ParserError("parser_unavailable");
    const page = await response.json();
    items.push(...page.items.filter((item) => item.account_id === job.account_id));
    if (offset + page.items.length >= page.total || !page.items.length) break;
  }
  return { job, items };
}

// Python's categories (api/openapi.yaml) mapped to the demo catalog.
const CATEGORY_MAP = {
  salary: "venit", rent: "locuinta", utilities: "utilitati", loan: "altele", gym: "abonamente",
  subscription: "abonamente", groceries: "alimente", transport: "transport", pharmacy: "altele",
  uncategorized: "nesortat", coffee: "cafenele", restaurants: "iesiri", delivery: "livrari",
  shopping: "cumparaturi", entertainment: "altele", gifts: "cadouri",
};

// Adds the parsed rows to the coach as a separate (external) account, without duplicates.
export async function storeStatementRows(db, model, documentId, parsed, at) {
  const importId = uid();
  const existing = new Set(model.transactions.map((tx) => tx.external_id));
  const rules = new Map(model.merchant_rules.map((rule) => [rule.merchant_id, rule]));
  const merchants = new Map(model.merchants.map((merchant) => [merchant.name, merchant.id]));
  const rows = [];
  let duplicate = 0;
  for (const item of parsed.items) {
    const externalId = `python:${item.id}`;
    if (existing.has(externalId)) {
      duplicate += 1;
      continue;
    }
    existing.add(externalId);
    const name = item.description_raw.split(/\s{2,}| · /)[0].replace(/^POS \d{2}\.\d{2}\.\d{4}( \d{2}:\d{2})? /, "").slice(0, 80);
    const id = await merchantId(db, model.persona.id, name, CATEGORY_MAP[item.category] ?? "nesortat", merchants);
    const rule = rules.get(id);
    const category = rule?.category ?? CATEGORY_MAP[item.category] ?? (item.amount_minor > 0 ? "venit" : "nesortat");
    rows.push({
      id: uid(),
      persona_id: model.persona.id,
      legacy_id: `s${rows.length + 1}-${importId.slice(0, 8)}`,
      external_id: externalId,
      account_key: `statement:${item.account_id}`,
      import_id: importId,
      merchant_id: id,
      occurred_at: item.occurred_at,
      local_date: localDay(item.occurred_at),
      amount_minor: item.amount_minor,
      category,
      kind: kindOf(model, category, item.amount_minor, null),
      status: "booked",
      description_raw: item.description_raw,
      display: encode(rule?.display_name ? { name: rule.display_name } : {}),
    });
  }
  const dates = rows.map((row) => row.local_date).sort();
  await insert(db, "imports", {
    id: importId,
    persona_id: model.persona.id,
    source: "statement",
    document_id: documentId,
    period_from: dates[0] ?? null,
    period_to: dates.at(-1) ?? null,
    status: "done",
    rows_total: parsed.items.length,
    rows_imported: rows.length,
    rows_duplicate: duplicate,
    created_at: at,
    finished_at: at,
  });
  await insertMany(db, "transactions", rows);
  await db.query("UPDATE documents SET status=$1 WHERE id=$2", ["processed", documentId]);
  await log(db, model, "coach", "A citit extrasul atașat", at);
}

export async function failStatement(db, model, documentId, code, at) {
  await insert(db, "imports", {
    id: uid(),
    persona_id: model.persona.id,
    source: "statement",
    document_id: documentId,
    status: "failed",
    error_code: code,
    created_at: at,
    finished_at: at,
  });
  await db.query("UPDATE documents SET status=$1,error_code=$2 WHERE id=$3", ["failed", code, documentId]);
}
