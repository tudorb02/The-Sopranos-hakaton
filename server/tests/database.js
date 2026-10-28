import pg from "pg";
import { migrate, uid } from "../src/db.js";
import { seed } from "../src/seed.js";
import { sqlitePool } from "./sqlite.js";

export async function testDatabase() {
  let pool, cleanup;
  if (process.env.NODE_TEST_DATABASE_URL) {
    const admin = new pg.Pool({ connectionString: process.env.NODE_TEST_DATABASE_URL });
    const schema = `node_test_${uid().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({
      connectionString: process.env.NODE_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 5,
    });
    cleanup = async () => {
      await pool.end();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    };
  } else {
    pool = sqlitePool();
    cleanup = () => pool.end();
  }
  try {
    await migrate(pool);
    await seed(pool);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { pool, cleanup };
}
