import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

// PostgreSQL DATE is a calendar day, not a midnight in the host machine's zone.
pg.types.setTypeParser(1082, (value) => value);

export const json = (value) =>
  value == null ? value : typeof value === "string" ? JSON.parse(value) : value;
export const day = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value);
export const uid = randomUUID;

export function poolFromEnv() {
  if (!process.env.NODE_DATABASE_URL) throw new Error("NODE_DATABASE_URL is required");
  if (new URL(process.env.NODE_DATABASE_URL).pathname !== "/nexxt_demo")
    throw new Error("The Node service must use the separate nexxt_demo database");
  return new pg.Pool({ connectionString: process.env.NODE_DATABASE_URL, max: 10 });
}

export async function ensureDatabase() {
  if (!process.env.NODE_ADMIN_DATABASE_URL) return;
  const target = new URL(process.env.NODE_DATABASE_URL).pathname.slice(1);
  if (target !== "nexxt_demo") throw new Error("The demo service must use its separate nexxt_demo database");
  const admin = new pg.Pool({ connectionString: process.env.NODE_ADMIN_DATABASE_URL });
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [target]);
    if (!existing.rowCount) {
      try {
        await admin.query('CREATE DATABASE "nexxt_demo"');
      } catch (error) {
        if (error.code !== "42P04") throw error;
      }
    }
  } finally {
    await admin.end();
  }
}

export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const MIGRATIONS = ["001-demo", "002-realistic-model"];

export async function migrate(pool) {
  await transaction(pool, async (client) => {
    if (pool.dialect !== "sqlite") await client.query("SELECT pg_advisory_xact_lock(83107201)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY)");
    for (const name of MIGRATIONS) {
      const version = name.slice(0, 3);
      const result = await client.query("SELECT version FROM schema_migrations WHERE version=$1", [version]);
      if (result.rowCount) continue;
      await client.query(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8"));
      await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [version]);
    }
  });
}

export async function insert(client, table, fields) {
  const keys = Object.keys(fields);
  return client.query(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(",")})`,
    Object.values(fields),
  );
}

// Multi-row insert in chunks, for the generated ledger.
export async function insertMany(client, table, rows, chunk = 100) {
  if (!rows.length) return;
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  for (let start = 0; start < rows.length; start += chunk) {
    const part = rows.slice(start, start + chunk);
    const values = part.map(
      (_, row) => `(${keys.map((__, column) => `$${row * keys.length + column + 1}`).join(",")})`,
    );
    await client.query(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES ${values.join(",")}`,
      part.flatMap((row) => keys.map((key) => row[key] ?? null)),
    );
  }
}
