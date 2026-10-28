import { failStatement, importAccount, ParserError, parseWithPython, runAnalysis, storeStatementRows } from "./coach.js";
import { insert, uid } from "./db.js";
import { exactKeys, requireValue, textValue } from "./errors.js";
import { localInstant } from "./history.js";
import { cycleStart } from "./history.js";
import { localTime, present } from "./read-model.js";
import { catalog, kindOf } from "./seed.js";

const encode = JSON.stringify;
const int = (value, max = 9007199254740991) => Number.isSafeInteger(value) && value > 0 && value <= max;
const boolean = (value) => typeof value === "boolean";
const categories = (model) => ({ ...catalog.categories, ...(model.preferences.categories ?? {}) });
const ensureCategory = (model, key) =>
  requireValue(Object.hasOwn(categories(model), key), "Categoria nu există.");
// Writes happen on the demo day (DEMO_TODAY) at the current Bucharest time of day.
export function nowAt(today) {
  const now = new Date();
  const offset = localInstant(today, "12:00").slice(-6);
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  const millis = String(now.getUTCMilliseconds()).padStart(3, "0");
  return `${today}T${localTime(now)}:${seconds}.${millis}${offset}`;
}
const visible = (model, tx) =>
  tx.import_id || (tx.account_key === "current" && tx.local_date >= cycleStart(model.today, model.persona.income_day));
const findTx = (model, key) => {
  const tx = model.transactions.find((row) => row.legacy_id === key && visible(model, row));
  requireValue(tx, "Tranzacția nu există în acest cont.", 404);
  return tx;
};
async function updatePreferences(db, model) {
  await db.query("UPDATE personas SET preferences=$1 WHERE id=$2", [encode(model.preferences), model.persona.id]);
}
async function updateTemplates(db, model) {
  await db.query("UPDATE personas SET templates=$1 WHERE id=$2", [encode(model.templates), model.persona.id]);
}
async function decision(db, model, key, payload) {
  await db.query(
    "INSERT INTO decisions(id,persona_id,decision_key,payload,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(persona_id,decision_key) DO UPDATE SET payload=excluded.payload",
    [uid(), model.persona.id, key, encode(payload), nowAt(model.today)],
  );
}
async function remember(db, model, key, kind, content) {
  await db.query(
    "INSERT INTO user_memory(id,persona_id,memory_key,kind,content,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(persona_id,memory_key) DO UPDATE SET content=excluded.content,created_at=excluded.created_at",
    [uid(), model.persona.id, key, kind, content, nowAt(model.today)],
  );
}

export async function patchTransaction(db, model, key, body) {
  exactKeys(body, ["name", "category", "note", "tags", "rule", "excluded"]);
  requireValue(Object.keys(body).length > 0, "Nu ai trimis nicio modificare.");
  const tx = findTx(model, key),
    display = { ...tx.display };
  if ("name" in body) {
    requireValue(textValue(body.name, 160), "Denumirea e prea lungă.");
    display.name = body.name;
  }
  if ("note" in body) {
    requireValue(textValue(body.note, 2000), "Nota e prea lungă.");
    display.note = body.note;
  }
  if ("tags" in body) {
    requireValue(
      Array.isArray(body.tags) && body.tags.length <= 20 && body.tags.every((tag) => textValue(tag, 40) && tag.trim()),
      "Etichetele sunt invalide.",
    );
    display.tags = [...new Set(body.tags)];
  }
  if ("rule" in body) requireValue(boolean(body.rule), "Regula trebuie să fie adevărat/fals.");
  if ("excluded" in body) requireValue(boolean(body.excluded), "Excluderea trebuie să fie adevărat/fals.");
  const category = body.category ?? tx.category;
  ensureCategory(model, category);
  const clearReview = (value) => {
    if (category !== "nesortat") {
      delete value.needsReview;
      delete value.suggestion;
    }
    return value;
  };
  const kind = kindOf(model, category, tx.amount_minor, tx.pot_key);
  await db.query("UPDATE transactions SET category=$1,kind=$2,excluded=$3,display=$4,splits=$5 WHERE id=$6", [
    category,
    kind,
    body.excluded ?? Boolean(tx.excluded),
    encode(clearReview(display)),
    category === tx.category ? encode(tx.splits) : "[]",
    tx.id,
  ]);
  if (body.rule === true) {
    await db.query(
      "INSERT INTO merchant_rules(id,persona_id,merchant_id,category,display_name,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(persona_id,merchant_id) DO UPDATE SET category=excluded.category,display_name=excluded.display_name",
      [uid(), model.persona.id, tx.merchant_id, category, display.name ?? null, nowAt(model.today)],
    );
    for (const other of model.transactions.filter((row) => row.merchant_id === tx.merchant_id && row.id !== tx.id && visible(model, row))) {
      const otherDisplay = clearReview({ ...other.display, ...(display.name !== undefined ? { name: display.name } : {}) });
      await db.query("UPDATE transactions SET category=$1,kind=$2,display=$3,splits=$4 WHERE id=$5", [
        category,
        kindOf(model, category, other.amount_minor, other.pot_key),
        encode(otherDisplay),
        "[]",
        other.id,
      ]);
    }
  } else if (body.rule === false)
    await db.query("DELETE FROM merchant_rules WHERE persona_id=$1 AND merchant_id=$2", [model.persona.id, tx.merchant_id]);
}

export async function splitTransaction(db, model, key, body) {
  exactKeys(body, ["parts"]);
  const tx = findTx(model, key);
  requireValue(tx.amount_minor < 0 && ["fixed", "variable"].includes(tx.kind), "Poți împărți doar o cheltuială.");
  requireValue(Array.isArray(body.parts) && body.parts.length >= 2 && body.parts.length <= 10, "Alege între 2 și 10 părți.");
  let total = 0n;
  for (const part of body.parts) {
    exactKeys(part, ["category", "amount_minor"]);
    ensureCategory(model, part.category);
    requireValue(int(part.amount_minor), "Fiecare parte trebuie să aibă o sumă pozitivă în bani.");
    total += BigInt(part.amount_minor);
  }
  requireValue(total === -BigInt(tx.amount_minor), "Părțile trebuie să însumeze exact valoarea plății.");
  await db.query("UPDATE transactions SET splits=$1 WHERE id=$2", [encode(body.parts), tx.id]);
}

export async function createCategory(db, model, body) {
  exactKeys(body, ["label"]);
  requireValue(textValue(body.label, 60) && body.label.trim(), "Completează numele categoriei.");
  requireValue(
    !Object.values(categories(model)).some(
      (item) => item.label.toLocaleLowerCase("ro") === body.label.trim().toLocaleLowerCase("ro"),
    ),
    "Categoria există deja.",
  );
  const key = `custom-${uid()}`;
  model.preferences.categories = {
    ...(model.preferences.categories ?? {}),
    [key]: { label: body.label.trim(), icon: "tag", tone: "cat-fixed" },
  };
  model.templates.pickerCategories.push(key);
  await updatePreferences(db, model);
  await updateTemplates(db, model);
}

export async function writeBudget(db, model, body, key) {
  exactKeys(body, ["category", "name", "kind", "limit_minor", "count_limit", "period"]);
  const existing = key ? model.budgets.find((budget) => budget.budget_key === key) : null;
  if (key) requireValue(existing, "Bugetul nu există.", 404);
  const category = body.category ?? existing?.category;
  ensureCategory(model, category);
  const kind = body.kind ?? existing?.kind ?? "amount";
  requireValue(["amount", "count"].includes(kind), "Bugetul poate limita suma sau numărul de plăți.");
  const period = body.period ?? existing?.period ?? "cycle";
  requireValue(["week", "cycle"].includes(period), "Perioadă invalidă.");
  const limit = body.limit_minor ?? existing?.limit_minor ?? null,
    count = body.count_limit ?? existing?.count_limit;
  requireValue(kind === "count" ? int(count, 100) : int(limit), "Completează o limită pozitivă.");
  const name = body.name ?? existing?.name ?? categories(model)[category].label;
  requireValue(textValue(name, 100) && name.trim(), "Nume de buget invalid.");
  const style = kind === "count" ? "count" : existing?.note_style === "count" ? null : existing?.note_style ?? null;
  if (existing) {
    await db.query(
      "UPDATE budgets SET category=$1,kind=$2,period=$3,limit_minor=$4,count_limit=$5,name=$6,note_style=$7,paused_until=NULL WHERE id=$8",
      [category, kind, period, kind === "amount" ? limit : null, kind === "count" ? count : null, name.trim(), style, existing.id],
    );
  } else {
    requireValue(!model.budgets.some((budget) => budget.category === category), "Există deja un buget pentru această categorie.");
    await insert(db, "budgets", {
      id: uid(),
      persona_id: model.persona.id,
      budget_key: `budget-${uid()}`,
      category,
      name: name.trim(),
      icon: categories(model)[category].icon,
      kind,
      period,
      limit_minor: kind === "amount" ? limit : null,
      count_limit: kind === "count" ? count : null,
      group_key: model.persona.budget_method === "envelopes" ? "optionale" : null,
      on_home: false,
      note_style: kind === "count" ? "count" : null,
      sort_order: model.budgets.length,
      created_at: nowAt(model.today),
    });
  }
}

// Corrections are the user's own statements; they override what the coach inferred.
export async function patchProfile(db, model, section, body) {
  requireValue(["about", "money", "talk"].includes(section), "Secțiunea nu poate fi corectată.");
  exactKeys(body, ["items"]);
  requireValue(Array.isArray(body.items), "Trimite lista de câmpuri.");
  const shown = present(model, model.today).profile[section];
  const seen = new Set();
  for (const item of body.items) {
    exactKeys(item, ["id", "label", "value"]);
    const row = shown.find((entry) => (item.id ? entry.id === item.id : entry.label === item.label));
    requireValue(row && textValue(item.value, 1000) && !seen.has(row.id), "Câmp de profil invalid.");
    seen.add(row.id);
    if (item.value !== row.value) await remember(db, model, `profile.${section}.${row.id}`, "correction", item.value);
    if (row.id === "firstName" && item.value.trim() && item.value !== row.value) {
      const name = item.value.trim();
      requireValue(name.length <= 80, "Prenumele este prea lung.");
      await db.query("UPDATE demo_accounts SET client=$1 WHERE id=$2", [
        encode({ ...model.account.client, firstName: name }),
        model.account.id,
      ]);
    }
  }
}

export async function patchPreferences(db, model, body) {
  exactKeys(body, ["permissions", "privacy", "services_on"]);
  for (const collection of ["permissions", "privacy"])
    if (collection in body) {
      requireValue(body[collection] && typeof body[collection] === "object" && !Array.isArray(body[collection]), "Setări invalide.");
      for (const [key, value] of Object.entries(body[collection])) {
        const existing = model.preferences[collection].find((item) => item.id === key);
        requireValue(existing && boolean(value), "Setare necunoscută sau invalidă.");
        existing.on = value;
      }
    }
  if ("services_on" in body) {
    requireValue(boolean(body.services_on), "Setare invalidă.");
    model.preferences.services_on = body.services_on;
  }
  await updatePreferences(db, model);
}

export async function patchCalendar(db, model, body) {
  exactKeys(body, ["connected", "gift_choices_minor"]);
  if ("connected" in body) {
    requireValue(["google", "phone", null].includes(body.connected), "Sursă de calendar invalidă.");
    model.preferences.calendar_connected = body.connected;
  }
  if ("gift_choices_minor" in body) {
    const groups = model.templates.calendar.gift.groups;
    requireValue(
      Array.isArray(body.gift_choices_minor) &&
        body.gift_choices_minor.length === groups.length &&
        body.gift_choices_minor.every((choice) => int(choice, 100000000)),
      "Alege o sumă pozitivă, în bani, pentru fiecare grup.",
    );
    model.preferences.gift_choices_minor = body.gift_choices_minor;
  }
  await updatePreferences(db, model);
}

export async function patchApp(db, model, key, body) {
  exactKeys(body, ["on"]);
  requireValue(boolean(body.on), "Setare invalidă.");
  const app = model.subscriptions.find((sub) => sub.subscription_key === key);
  requireValue(app, "Abonamentul nu există.", 404);
  await db.query("UPDATE subscriptions SET monitored=$1 WHERE id=$2", [body.on, app.id]);
  // Screen Time is on while at least one app is monitored.
  const screen = model.preferences.permissions.find((item) => item.id === "screen");
  if (screen) {
    screen.on = model.subscriptions.some((sub) => (sub.id === app.id ? body.on : sub.monitored));
    await updatePreferences(db, model);
  }
}

export async function writeAnswer(db, model, key, body) {
  exactKeys(body, ["selected", "fields"]);
  const question = model.questions.find((row) => row.question_key === key);
  requireValue(question, "Întrebarea nu există.", 404);
  const definition = question.definition;
  requireValue(
    Array.isArray(body.selected) &&
      body.selected.every((choice) => definition.options.some((option) => option.label === choice)) &&
      (definition.multiple || body.selected.length <= 1),
    "Opțiuni invalide.",
  );
  requireValue(body.fields && typeof body.fields === "object" && !Array.isArray(body.fields), "Câmpuri invalide.");
  const fields = definition.fields ?? [];
  for (const [label, value] of Object.entries(body.fields)) {
    const field = fields.find((item) => item.label === label);
    requireValue(field && textValue(value, 2000), "Câmp invalid.");
    if (field.type === "select") requireValue(field.options.includes(value), "Opțiune invalidă.");
    if (field.numeric && value) requireValue(/^\d+(?:[.,]\d{1,2})?$/.test(value), "Completează o sumă pozitivă.");
  }
  requireValue(Object.keys(body.fields).length === fields.length, "Completează toate câmpurile întrebării.");
  await db.query("UPDATE questions SET answer=$1 WHERE id=$2", [
    encode({ selected: [...new Set(body.selected)], fields: body.fields }),
    question.id,
  ]);
}

export async function serviceDecision(db, model, key, body) {
  exactKeys(body, ["action"]);
  const service = model.services.find((item) => item.service_key === key);
  requireValue(service, "Serviciul nu există.", 404);
  requireValue(service.payload.actions?.includes(body.action), "Acțiune invalidă.");
  await db.query("UPDATE services SET decision=$1,decided_at=$2 WHERE id=$3", [body.action, nowAt(model.today), service.id]);
}

export async function ideaDecision(db, model, body) {
  exactKeys(body, ["decision"]);
  requireValue(model.templates.ideas && ["accepted", "dismissed"].includes(body.decision), "Decizie invalidă.");
  await decision(db, model, "idea", body);
}

// The message is stored; the demo has no AI replies, and the client shows that explicitly.
export async function addMessage(db, model, body) {
  exactKeys(body, ["text"]);
  requireValue(textValue(body.text, 4000) && body.text.trim(), "Scrie un mesaj de maximum 4.000 de caractere.");
  const position = Math.max(-1, ...model.messages.map((message) => message.position)) + 1;
  const at = nowAt(model.today);
  await insert(db, "messages", {
    id: uid(),
    persona_id: model.persona.id,
    position,
    role: "user",
    kind: "text",
    body: encode({ text: body.text.trim() }),
    read_at: at,
    created_at: at,
  });
}

export async function markChatRead(db, model, body) {
  exactKeys(body ?? {}, []);
  await db.query("UPDATE messages SET read_at=$1 WHERE persona_id=$2 AND read_at IS NULL", [nowAt(model.today), model.persona.id]);
}

export async function proposalDecision(db, model, position, body) {
  exactKeys(body, ["action"]);
  const message = model.messages.find((row) => row.position === Number(position));
  requireValue(
    message?.kind === "proposal" && !message.decision && message.body.actions?.includes(body.action),
    "Propunerea sau acțiunea nu există.",
    404,
  );
  await db.query("UPDATE messages SET decision=$1,decided_at=$2 WHERE id=$3", [body.action, nowAt(model.today), message.id]);
}

export async function importStatements(db, model, body) {
  exactKeys(body, ["months"]);
  requireValue(model.templates.statements.period_months.includes(body.months), "Perioadă invalidă.");
  await importAccount(db, model, body.months, nowAt(model.today));
}

export async function startAnalysis(db, model, body) {
  exactKeys(body ?? {}, []);
  requireValue(model.imports.some((item) => item.status === "done"), "Importă mai întâi extrasele.", 409);
  await runAnalysis(db, model, nowAt(model.today));
}

const STATEMENT_FORMATS = ["pdf", "csv", "xls", "xlsx"];
export async function addDocument(db, model, body, key, options = {}) {
  exactKeys(body, ["name", "mime", "content_base64"]);
  const tx = key ? findTx(model, key) : null;
  requireValue(textValue(body.name, 180) && body.name.trim() && !/[\\/]/.test(body.name), "Nume de fișier invalid.");
  requireValue(
    typeof body.content_base64 === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(body.content_base64),
    "Conținut de fișier invalid.",
  );
  const content = Buffer.from(body.content_base64, "base64");
  requireValue(content.length > 0 && content.length <= 10 * 1024 * 1024, "Fișierul trebuie să aibă între 1 octet și 10 MiB.");
  const extension = body.name.toLowerCase().split(".").at(-1);
  requireValue((key ? ["pdf", "jpg", "jpeg", "png"] : STATEMENT_FORMATS).includes(extension), "Format de fișier neacceptat.");
  requireValue(textValue(body.mime, 100), "Tip de fișier invalid.");
  const id = uid();
  const at = nowAt(model.today);
  await insert(db, "documents", {
    id,
    persona_id: model.persona.id,
    kind: key ? "receipt" : "statement",
    transaction_id: tx?.id ?? null,
    name: body.name,
    mime: body.mime,
    size_bytes: content.length,
    content,
    status: key ? "stored" : extension === "csv" ? "stored" : "unsupported",
    created_at: at,
  });
  if (key || extension !== "csv") return;
  try {
    const parsed = await parseWithPython(model.account.slug, { name: body.name, content }, options);
    await storeStatementRows(db, model, id, parsed, at);
  } catch (error) {
    if (!(error instanceof ParserError)) throw error;
    await failStatement(db, model, id, error.code, at);
  }
}

export async function bumpRevision(db, model) {
  await db.query("UPDATE personas SET revision=revision+1 WHERE id=$1", [model.persona.id]);
}
