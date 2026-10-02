import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "data", "dashboard.sqlite");
if (existsSync(source)) {
  const folder = join(process.cwd(), "data", "backups");
  mkdirSync(folder, { recursive: true });
  const target = join(folder, `dashboard-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
  const database = new DatabaseSync(source, { readOnly: true });
  try { await backup(database, target); }
  finally { database.close(); }
  console.log(`SQLite backup saved: ${target}`);
}
