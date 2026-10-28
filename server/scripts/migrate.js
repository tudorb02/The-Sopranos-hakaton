import { ensureDatabase, migrate, poolFromEnv } from "../src/db.js";
await ensureDatabase();
const pool = poolFromEnv();
try { await migrate(pool); console.log("Demo migrations complete"); }
finally { await pool.end(); }
