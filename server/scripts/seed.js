import { ensureDatabase, migrate, poolFromEnv } from "../src/db.js";
import { seed } from "../src/seed.js";
await ensureDatabase();
const pool = poolFromEnv();
try {
  await migrate(pool);
  await seed(pool);
  console.log("Demo seed complete (idempotent)");
} finally {
  await pool.end();
}
