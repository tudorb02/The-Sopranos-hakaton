// A genuine SQL test driver for offline runs. Production always uses PostgreSQL.
import { DatabaseSync } from "node:sqlite";

export function sqlitePool(path = ":memory:") {
  const database = new DatabaseSync(path);
  database.exec("PRAGMA foreign_keys=ON");
  const driver = {
    dialect: "sqlite",
    async query(sql, values = []) {
      if (!values.length && (sql.includes(";\n") || /^(BEGIN|COMMIT|ROLLBACK|CREATE|PRAGMA)/i.test(sql))) {
        database.exec(sql);
        return { rows: [], rowCount: 0 };
      }
      const statement = database.prepare(sql.replace(/\$\d+/g, "?"));
      const parameters = values.map((value) => (typeof value === "boolean" ? Number(value) : value));
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
        const rows = statement.all(...parameters);
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...parameters);
      return { rows: [], rowCount: result.changes };
    },
    async connect() {
      return { ...driver, release() {} };
    },
    async end() {
      database.close();
    },
  };
  return driver;
}
