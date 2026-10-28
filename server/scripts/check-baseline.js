// Direct read-model smoke test without opening a network port.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { migrate } from "../src/db.js";
import { seed } from "../src/seed.js";
import { loadModel, present } from "../src/read-model.js";
import { sqlitePool } from "../tests/sqlite.js";
const expected = JSON.parse(
  await readFile(new URL("../tests/fixtures/frontend-baseline.json", import.meta.url), "utf8"),
);
const db = sqlitePool();
await migrate(db);
await seed(db);
try {
  for (const slug of ["pf", "student"]) {
    const actual = present(await loadModel(db, slug), "2026-11-12");
    for (const key of new Set([...Object.keys(actual), ...Object.keys(expected.personas[slug])]))
      assert.deepEqual(actual[key], expected.personas[slug][key], `${slug}.${key}`);
    console.log(`${slug}: exact frontend compatibility`);
  }
} finally {
  await db.end();
}
