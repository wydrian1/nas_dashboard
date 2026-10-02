import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { initializeDatabase, ARTICLE_QUERY, type Feed, type Article } from "@/lib/db-schema";
import { plainSqlRow } from "@/lib/sql-rows";

export type { Feed, Article } from "@/lib/db-schema";

let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  const opened = new DatabaseSync(join(process.cwd(), "data", "dashboard.sqlite"));
  try { initializeDatabase(opened); database = opened; }
  catch (error) { opened.close(); throw error; }
  return database;
}

export function feeds(): Feed[] { return (db().prepare("SELECT * FROM feeds ORDER BY name").all() as Feed[]).map(plainSqlRow); }
export function articles(): Article[] {
  return (db().prepare(ARTICLE_QUERY).all() as Article[]).map(plainSqlRow);
}
