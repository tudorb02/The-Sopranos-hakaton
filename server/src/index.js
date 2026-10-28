import { createApp } from "./app.js";
import { ensureDatabase, migrate, poolFromEnv } from "./db.js";
import { demoToday } from "./dates.js";
import { seed } from "./seed.js";

await ensureDatabase();
const pool = poolFromEnv();
await migrate(pool);
await seed(pool);
const today = demoToday();
const app = createApp(pool, {
  today,
  allowedOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:8081,http://127.0.0.1:8081").split(","),
});
const server = app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log(`Demo API ready (${today})`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
