import express from "express";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { insert, json, transaction, uid } from "./db.js";
import { formatLei } from "./copy.js";
import { demoToday } from "./dates.js";
import { metrics } from "./metrics.js";
import { ApiError, requireValue } from "./errors.js";
import { accountFor, loadModel, present, screenData, SCREEN_FIELDS } from "./read-model.js";
import { catalog, scenarios, seedPersona } from "./seed.js";
import * as writes from "./write-model.js";
import { nowAt } from "./write-model.js";

export function createApp(
  pool,
  { today = demoToday(), allowedOrigins = ["http://localhost:8081", "http://127.0.0.1:8081"], parser = {} } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, If-Match, Idempotency-Key");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "14mb" }));
  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", today });
  });
  const api = express.Router();
  app.use("/api/demo/v1", api);
  api.get("/openapi.json", (_req, res) =>
    res.type("application/json").send(readFileSync(new URL("../../api/node-openapi.yaml", import.meta.url))),
  );
  api.get("/catalog", (_req, res) => res.json(catalog));
  api.get("/accounts", async (_req, res) => {
    const { rows } = await pool.query("SELECT presentation,client,iban_masked FROM demo_accounts ORDER BY slug");
    res.json({
      login: catalog.login,
      accounts: rows.map((row) => {
        const client = json(row.client);
        return {
          ...json(row.presentation),
          name: `${client.firstName} ${client.lastName}`,
          initial: client.firstName[0],
          detail: `Cont curent RON · ${row.iban_masked}`,
        };
      }),
    });
  });
  api.use("/personas/:persona", (req, _res, next) => {
    if (!Object.hasOwn(scenarios, req.params.persona))
      throw new ApiError(404, "Contul demo nu există.", "not_found");
    next();
  });
  const read = (handler) => async (req, res) =>
    transaction(pool, async (db) => {
      if (pool.dialect !== "sqlite")
        await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const model = await loadModel(db, req.params.persona);
      res.set("X-Data-Revision", String(model.persona.revision));
      res.json(await handler(model, present(model, today), req));
    });
  api.get(
    "/personas/:persona",
    read((_model, data) => data),
  );
  api.get(
    "/personas/:persona/preferences",
    read((model) => model.preferences),
  );
  api.get(
    "/personas/:persona/metrics",
    read((_model, data) => metrics(data)),
  );
  api.get("/personas/:persona/products", async (req, res) => {
    const account = await accountFor(pool, req.params.persona);
    res.json({ client: json(account.client), entry: catalog.entry, products: catalog.products });
  });
  for (const screen of Object.keys(SCREEN_FIELDS).filter((key) => !["products", "tracking"].includes(key)))
    api.get(
      `/personas/:persona/${screen}`,
      read((_model, data) => screenData(data, screen)),
    );
  api.get(
    "/personas/:persona/tracking",
    read((_model, data, req) => {
      const packet = screenData(data, "tracking");
      const query = req.query.q ?? "",
        filter = req.query.filter ?? "all";
      requireValue(
        typeof query === "string" &&
          query.length <= 160 &&
          data.filters.some((item) => item.id === filter),
        "Filtre invalide.",
      );
      const match = (tx) =>
        (!query ||
          `${tx.name} ${tx.merchant} ${tx.lei} ${formatLei(Math.round(Math.abs(tx.lei) * 100))} ${(tx.tags ?? []).join(" ")}`
            .toLocaleLowerCase("ro")
            .includes(query.toLocaleLowerCase("ro"))) &&
        (filter === "all" ||
          (filter === "expenses" && tx.lei < 0) ||
          (filter === "income" && tx.lei > 0) ||
          (filter === "uncategorized" && tx.category === "nesortat") ||
          (filter === "recurring" && tx.recurring));
      packet.days = packet.days
        .map((group) => ({ ...group, items: group.items.filter(match) }))
        .filter((group) => group.items.length);
      // The day's headline describes the day; filtering changes visible rows, not the ledger's total.
      return packet;
    }),
  );
  api.get(
    "/personas/:persona/transactions/:id",
    read((_model, data, req) => {
      const group = data.days.find((group) => group.items.some((tx) => tx.id === req.params.id));
      if (!group) throw new ApiError(404, "Tranzacția nu există în acest cont.", "not_found");
      return { ...group.items.find((tx) => tx.id === req.params.id), day: group };
    }),
  );
  const mutate = (handler) => async (req, res) => {
    const result = await transaction(pool, async (db) => {
      db.dialect = pool.dialect;
      const model = await loadModel(db, req.params.persona, true);
      model.today = today;
      const token = req.get("Idempotency-Key");
      requireValue(!token || /^[A-Za-z0-9_-]{1,100}$/.test(token), "Identificator de cerere invalid.");
      const hash = createHash("sha256")
        .update(JSON.stringify([req.method, req.path, req.body]))
        .digest("hex");
      const replay = token ? model.decisions.find((row) => row.decision_key === `request:${token}`) : null;
      if (replay) {
        requireValue(
          json(replay.payload).hash === hash,
          "Identificatorul a fost deja folosit pentru o altă cerere.",
          409,
        );
        return present(model, today);
      }
      if (req.get("If-Match") && req.get("If-Match") !== String(model.persona.revision))
        throw new ApiError(409, "Datele s-au schimbat. Reîncarcă pagina și încearcă din nou.", "conflict");
      await handler(db, model, req);
      if (token)
        await insert(db, "decisions", {
          id: uid(),
          persona_id: model.persona.id,
          decision_key: `request:${token}`,
          payload: JSON.stringify({ hash }),
          created_at: nowAt(today),
        });
      await writes.bumpRevision(db, model);
      return present(await loadModel(db, req.params.persona), today);
    });
    res.json(result);
  };
  api.patch(
    "/personas/:persona/transactions/:id",
    mutate((db, m, r) => writes.patchTransaction(db, m, r.params.id, r.body)),
  );
  api.post(
    "/personas/:persona/transactions/:id/splits",
    mutate((db, m, r) => writes.splitTransaction(db, m, r.params.id, r.body)),
  );
  api.post(
    "/personas/:persona/transactions/:id/receipt",
    mutate((db, m, r) => writes.addDocument(db, m, r.body, r.params.id)),
  );
  api.post(
    "/personas/:persona/categories",
    mutate((db, m, r) => writes.createCategory(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/budgets",
    mutate((db, m, r) => writes.writeBudget(db, m, r.body)),
  );
  api.patch(
    "/personas/:persona/budgets/:id",
    mutate((db, m, r) => writes.writeBudget(db, m, r.body, r.params.id)),
  );
  api.patch(
    "/personas/:persona/profile/:section",
    mutate((db, m, r) => writes.patchProfile(db, m, r.params.section, r.body)),
  );
  api.patch(
    "/personas/:persona/preferences",
    mutate((db, m, r) => writes.patchPreferences(db, m, r.body)),
  );
  api.patch(
    "/personas/:persona/calendar",
    mutate((db, m, r) => writes.patchCalendar(db, m, r.body)),
  );
  api.patch(
    "/personas/:persona/apps/:name",
    mutate((db, m, r) => writes.patchApp(db, m, r.params.name, r.body)),
  );
  api.put(
    "/personas/:persona/answers/:question",
    mutate((db, m, r) => writes.writeAnswer(db, m, r.params.question, r.body)),
  );
  api.patch(
    "/personas/:persona/services/:id",
    mutate((db, m, r) => writes.serviceDecision(db, m, r.params.id, r.body)),
  );
  api.post(
    "/personas/:persona/ideas/decision",
    mutate((db, m, r) => writes.ideaDecision(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/chat/messages",
    mutate((db, m, r) => writes.addMessage(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/chat/:index/decision",
    mutate((db, m, r) => writes.proposalDecision(db, m, r.params.index, r.body)),
  );
  api.post(
    "/personas/:persona/chat/read",
    mutate((db, m, r) => writes.markChatRead(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/analysis",
    mutate((db, m, r) => writes.startAnalysis(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/imports",
    mutate((db, m, r) => writes.importStatements(db, m, r.body)),
  );
  api.post(
    "/personas/:persona/statements",
    mutate((db, m, r) => writes.addDocument(db, m, r.body, null, parser)),
  );
  api.delete("/personas/:persona/coach", async (req, res) => {
    await transaction(pool, async (db) => {
      const account = await accountFor(db, req.params.persona);
      await db.query("DELETE FROM personas WHERE account_id=$1", [account.id]);
    });
    res.status(204).end();
  });
  api.post("/personas/:persona/coach", async (req, res) => {
    const data = await transaction(pool, async (db) => {
      const account = await accountFor(db, req.params.persona);
      if (pool.dialect !== "sqlite")
        await db.query("SELECT id FROM demo_accounts WHERE id=$1 FOR UPDATE", [account.id]);
      const existing = await db.query("SELECT id FROM personas WHERE account_id=$1", [account.id]);
      if (!existing.rowCount)
        await seedPersona(db, account, scenarios[req.params.persona], { activate: false, createdAt: nowAt(today) });
      return present(await loadModel(db, req.params.persona), today);
    });
    res.json(data);
  });
  app.use((_req, _res, next) => next(new ApiError(404, "Ruta nu există.", "not_found")));
  app.use((error, _req, res, _next) => {
    const status = error.status ?? (error instanceof RangeError ? 400 : 500);
    res
      .status(status)
      .json({
        error: {
          code:
            error.code && error instanceof ApiError
              ? error.code
              : status === 413
                ? "file_too_large"
                : status === 400
                  ? "invalid_request"
                  : "internal_error",
          message:
            error instanceof ApiError || error instanceof RangeError
              ? error.message
              : status === 413
                ? "Fișierul depășește limita de 10 MiB."
                : status === 400
                  ? "Cererea JSON este invalidă."
                  : "Nu pot încărca datele acum. Încearcă din nou.",
        },
      });
  });
  return app;
}
