import { insert, json, uid } from "./db.js";
import { exactKeys, requireValue, textValue } from "./errors.js";
import { safeInteger } from "./money.js";
import { catalog } from "./seed.js";

const encode = JSON.stringify;
const int = (value, max = 9007199254740991) => Number.isSafeInteger(value) && value > 0 && value <= max;
const boolean = (value) => typeof value === "boolean";
const categories = (model) => ({ ...catalog.categories, ...(model.preferences.categories ?? {}) });
const ensureCategory = (model, key) =>
  requireValue(Object.hasOwn(categories(model), key), "Categoria nu există.");
const findTx = (model, key) => {
  const tx = model.transactions.find(
    (row) => row.legacy_id === key && row.scope === "current" && row.visible,
  );
  requireValue(tx, "Tranzacția nu există în acest cont.", 404);
  return tx;
};
async function updatePreferences(db, model) {
  await db.query("UPDATE personas SET preferences=$1 WHERE id=$2", [
    encode(model.preferences),
    model.persona.id,
  ]);
}
async function updateTemplates(db, model) {
  await db.query("UPDATE personas SET templates=$1 WHERE id=$2", [encode(model.templates), model.persona.id]);
}
async function decision(db, model, key, payload) {
  await db.query(
    "INSERT INTO decisions(id,persona_id,decision_key,payload) VALUES($1,$2,$3,$4) ON CONFLICT(persona_id,decision_key) DO UPDATE SET payload=excluded.payload",
    [uid(), model.persona.id, key, encode(payload)],
  );
}

export async function patchTransaction(db, model, key, body) {
  exactKeys(body, ["name", "category", "note", "tags", "rule", "excluded"]);
  requireValue(Object.keys(body).length > 0, "Nu ai trimis nicio modificare.");
  const tx = findTx(model, key),
    payload = { ...json(tx.presentation) };
  if ("name" in body) {
    requireValue(textValue(body.name, 160), "Denumirea e prea lungă.");
    payload.name = body.name;
    payload.renamed = body.name !== tx.merchant;
  }
  if ("note" in body) {
    requireValue(textValue(body.note, 2000), "Nota e prea lungă.");
    payload.note = body.note;
  }
  if ("tags" in body) {
    requireValue(
      Array.isArray(body.tags) &&
        body.tags.length <= 20 &&
        body.tags.every((tag) => textValue(tag, 40) && tag.trim()),
      "Etichetele sunt invalide.",
    );
    payload.tags = [...new Set(body.tags)];
  }
  if ("rule" in body) {
    requireValue(boolean(body.rule), "Regula trebuie să fie adevărat/fals.");
    payload.rule = body.rule;
  }
  if ("excluded" in body) requireValue(boolean(body.excluded), "Excluderea trebuie să fie adevărat/fals.");
  const category = body.category ?? tx.category;
  ensureCategory(model, category);
  if (category !== "nesortat") {
    delete payload.needsReview;
    delete payload.suggestion;
  }
  const kind =
    safeInteger(tx.amount_minor) > 0
      ? "income"
      : category === "economii"
        ? "saving"
        : ["locuinta", "abonamente", ...(model.persona.mode === "student" ? ["transport"] : [])].includes(
              category,
            )
          ? "fixed"
          : "variable";
  await db.query(
    "UPDATE transactions SET category=$1,kind=$2,excluded=$3,presentation=$4,splits=$5 WHERE id=$6",
    [
      category,
      kind,
      body.excluded ?? Boolean(tx.excluded),
      encode(payload),
      category === tx.category ? encode(json(tx.splits)) : "[]",
      tx.id,
    ],
  );
  if (body.rule === true) {
    await db.query(
      "INSERT INTO merchant_rules(id,persona_id,merchant,payload) VALUES($1,$2,$3,$4) ON CONFLICT(persona_id,merchant) DO UPDATE SET payload=excluded.payload",
      [uid(), model.persona.id, tx.merchant, encode({ category, name: payload.name })],
    );
    for (const other of model.transactions.filter(
      (row) => row.scope === "current" && row.visible && row.merchant === tx.merchant && row.id !== tx.id,
    )) {
      const otherPayload = {
        ...json(other.presentation),
        name: payload.name,
        renamed: payload.renamed,
        rule: true,
      };
      if (category !== "nesortat") {
        delete otherPayload.needsReview;
        delete otherPayload.suggestion;
      }
      await db.query("UPDATE transactions SET category=$1,kind=$2,presentation=$3,splits=$4 WHERE id=$5", [
        category,
        kind,
        encode(otherPayload),
        "[]",
        other.id,
      ]);
    }
  } else if (body.rule === false)
    await db.query("DELETE FROM merchant_rules WHERE persona_id=$1 AND merchant=$2", [
      model.persona.id,
      tx.merchant,
    ]);
}

export async function splitTransaction(db, model, key, body) {
  exactKeys(body, ["parts"]);
  const tx = findTx(model, key);
  requireValue(
    safeInteger(tx.amount_minor) < 0 && ["fixed", "variable"].includes(tx.kind),
    "Poți împărți doar o cheltuială.",
  );
  requireValue(
    Array.isArray(body.parts) && body.parts.length >= 2 && body.parts.length <= 10,
    "Alege între 2 și 10 părți.",
  );
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
  const limit =
      body.limit_minor ?? (existing?.limit_minor == null ? null : safeInteger(existing.limit_minor)),
    count = body.count_limit ?? existing?.count_limit;
  requireValue(kind === "count" ? int(count, 100) : int(limit), "Completează o limită pozitivă.");
  const name = body.name ?? json(existing?.presentation ?? "{}").name ?? categories(model)[category].label;
  requireValue(textValue(name, 100) && name.trim(), "Nume de buget invalid.");
  if (existing) {
    await db.query(
      "UPDATE budgets SET category=$1,kind=$2,period=$3,limit_minor=$4,count_limit=$5,presentation=$6 WHERE id=$7",
      [
        category,
        kind,
        period,
        kind === "amount" ? limit : null,
        kind === "count" ? count : null,
        encode({ ...json(existing.presentation), name, kind }),
        existing.id,
      ],
    );
  } else {
    requireValue(
      !model.budgets.some((budget) => budget.category === category),
      "Există deja un buget pentru această categorie.",
    );
    const budgetKey = `budget-${uid()}`;
    await insert(db, "budgets", {
      id: uid(),
      persona_id: model.persona.id,
      budget_key: budgetKey,
      category,
      kind,
      period,
      limit_minor: kind === "amount" ? limit : null,
      count_limit: kind === "count" ? count : null,
      presentation: encode({
        id: budgetKey,
        name: name.trim(),
        icon: categories(model)[category].icon,
        kind,
        note: "Stabilit de tine",
        ...(model.persona.mode === "student" ? { group: "optionale" } : {}),
      }),
      sort_order: model.budgets.length,
    });
  }
}

export async function patchProfile(db, model, section, body) {
  requireValue(["about", "money", "talk"].includes(section), "Secțiunea nu poate fi corectată.");
  exactKeys(body, ["items"]);
  requireValue(Array.isArray(body.items), "Trimite lista de câmpuri.");
  const originals = model.templates.profile[section];
  requireValue(body.items.length === originals.length, "Lista de câmpuri este incompletă.");
  const seen = new Set();
  for (const item of body.items) {
    exactKeys(item, ["label", "value"]);
    requireValue(
      textValue(item.value, 1000) &&
        originals.some((row) => row.label === item.label) &&
        !seen.has(item.label),
      "Câmp de profil invalid.",
    );
    seen.add(item.label);
  }
  model.templates.profile[section] = originals.map((row) => {
    const value = body.items.find((item) => item.label === row.label).value;
    return { ...row, value, ...(value !== row.value && row.src ? { src: "said" } : {}) };
  });
  await updateTemplates(db, model);
  if (section === "about") {
    const name = body.items.find((item) => item.label === "Prenume")?.value.trim();
    if (name) {
      requireValue(name.length <= 80, "Prenumele este prea lung.");
      const client = json(model.account.client),
        account = json(model.account.presentation);
      client.name = client.name.replace(client.firstName, name);
      client.firstName = name;
      client.initial = name[0];
      account.name = client.name;
      account.initial = client.initial;
      await db.query("UPDATE demo_accounts SET client=$1,presentation=$2 WHERE id=$3", [
        encode(client),
        encode(account),
        model.account.id,
      ]);
    }
  }
}

export async function patchPreferences(db, model, body) {
  exactKeys(body, ["permissions", "privacy", "services_on"]);
  for (const collection of ["permissions", "privacy"])
    if (collection in body) {
      requireValue(
        body[collection] && typeof body[collection] === "object" && !Array.isArray(body[collection]),
        "Setări invalide.",
      );
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
  exactKeys(body, ["connected", "gift_choices"]);
  if ("connected" in body) {
    requireValue(["google", "phone", null].includes(body.connected), "Sursă de calendar invalidă.");
    model.preferences.calendar_connected = body.connected;
  }
  if ("gift_choices" in body) {
    const groups = model.templates.calendar.gift.groups;
    requireValue(
      Array.isArray(body.gift_choices) &&
        body.gift_choices.length === groups.length &&
        body.gift_choices.every(
          (choice, index) =>
            typeof choice === "string" &&
            /^\d+(?:[.,]\d{1,2})? lei$/.test(choice) &&
            (groups[index].options.includes(choice) || groups[index].options.includes("Altă sumă")),
        ),
      "Alege o sumă numerică din opțiunile disponibile.",
    );
    model.preferences.gift_choices = body.gift_choices;
  }
  await updatePreferences(db, model);
}

export async function patchApp(db, model, key, body) {
  exactKeys(body, ["on"]);
  requireValue(boolean(body.on), "Setare invalidă.");
  const app = model.subscriptions.find((sub) => sub.subscription_key === key);
  requireValue(app, "Abonamentul nu există.", 404);
  await db.query("UPDATE subscriptions SET monitored=$1 WHERE id=$2", [body.on, app.id]);
}

export async function writeAnswer(db, model, key, body) {
  exactKeys(body, ["selected", "fields"]);
  const question = model.questions.find((row) => row.question_key === key);
  requireValue(question, "Întrebarea nu există.", 404);
  const definition = json(question.definition);
  requireValue(
    Array.isArray(body.selected) &&
      body.selected.every((choice) => definition.options.some((option) => option.label === choice)),
    "Opțiuni invalide.",
  );
  requireValue(
    body.fields && typeof body.fields === "object" && !Array.isArray(body.fields),
    "Câmpuri invalide.",
  );
  const fields = definition.fields ?? [];
  for (const [key, value] of Object.entries(body.fields)) {
    const field = fields.find((field) => field.label === key);
    requireValue(field && textValue(value, 2000), "Câmp invalid.");
    if (field.type === "select") requireValue(field.options.includes(value), "Opțiune invalidă.");
    if (field.numeric && value)
      requireValue(/^\d+(?:[.,]\d{1,2})?$/.test(value), "Completează o sumă pozitivă.");
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
  requireValue(json(service.payload).actions?.includes(body.action), "Acțiune invalidă.");
  await db.query("UPDATE services SET decision=$1 WHERE id=$2", [body.action, service.id]);
}

export async function ideaDecision(db, model, body) {
  exactKeys(body, ["decision"]);
  requireValue(
    model.templates.ideas && ["accepted", "dismissed"].includes(body.decision),
    "Decizie invalidă.",
  );
  await decision(db, model, "idea", body);
}

export async function addMessage(db, model, body) {
  exactKeys(body, ["text"]);
  requireValue(
    textValue(body.text, 4000) && body.text.trim(),
    "Scrie un mesaj de maximum 4.000 de caractere.",
  );
  const position = Math.max(-1, ...model.messages.map((message) => message.position)) + 1;
  await insert(db, "messages", {
    id: uid(),
    persona_id: model.persona.id,
    position,
    payload: encode({ type: "me", text: body.text.trim() }),
  });
}

export async function proposalDecision(db, model, position, body, today) {
  exactKeys(body, ["action"]);
  const message = model.messages.find((message) => message.position === Number(position));
  const payload = message ? { ...json(message.payload) } : null;
  requireValue(
    payload?.type === "proposal" && payload.actions?.includes(body.action),
    "Propunerea sau acțiunea nu există.",
    404,
  );
  payload.done = `${body.action} · ${today}`;
  await db.query("UPDATE messages SET payload=$1 WHERE id=$2", [encode(payload), message.id]);
  await decision(db, model, `proposal:${position}`, body);
}

export async function importStatements(db, model, body) {
  exactKeys(body, ["period"]);
  requireValue(model.templates.statements.periods.includes(body.period), "Perioadă invalidă.");
  await decision(db, model, `import:${body.period}`, body);
  model.templates.statements.imported = {
    title: "Import demo finalizat",
    meta: `${body.period} · datele demo existente sunt păstrate fără duplicate`,
  };
  await updateTemplates(db, model);
}

export async function addDocument(db, model, body, key) {
  exactKeys(body, ["name", "mime", "content_base64"]);
  if (key) findTx(model, key);
  requireValue(
    textValue(body.name, 180) && body.name.trim() && !/[\\/]/.test(body.name),
    "Nume de fișier invalid.",
  );
  requireValue(
    typeof body.content_base64 === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(body.content_base64),
    "Conținut de fișier invalid.",
  );
  const content = Buffer.from(body.content_base64, "base64");
  requireValue(
    content.length > 0 && content.length <= 10 * 1024 * 1024,
    "Fișierul trebuie să aibă între 1 octet și 10 MiB.",
  );
  const allowed = key ? ["pdf", "jpg", "jpeg", "png"] : ["pdf", "csv", "xls", "xlsx"];
  requireValue(allowed.includes(body.name.toLowerCase().split(".").at(-1)), "Format de fișier neacceptat.");
  requireValue(textValue(body.mime, 100), "Tip de fișier invalid.");
  const presentation = { name: body.name, meta: `${content.length} octeți · salvat în demo`, state: "done" };
  await insert(db, "documents", {
    id: uid(),
    persona_id: model.persona.id,
    kind: key ? "receipt" : "statement",
    transaction_key: key ?? null,
    name: body.name,
    mime: body.mime,
    content,
    presentation: encode(presentation),
    sort_order: model.documents.length,
  });
  if (key) {
    const tx = findTx(model, key);
    await db.query("UPDATE transactions SET presentation=$1 WHERE id=$2", [
      encode({ ...json(tx.presentation), receipt: { name: body.name, size: content.length } }),
      tx.id,
    ]);
  }
}

export async function bumpRevision(db, model) {
  await db.query("UPDATE personas SET revision=revision+1 WHERE id=$1", [model.persona.id]);
}
