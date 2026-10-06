import "server-only";
import { db } from "@/lib/db";
import type { QuickLink, Note, Todo, WeatherLocation } from "@/lib/personal-types";
import { plainSqlRow } from "@/lib/sql-rows";

export function personalData(email:string) {
  const database = db();
  return {
    links: (database.prepare("SELECT * FROM quick_links ORDER BY id").all() as QuickLink[]).map(plainSqlRow),
    notes: (database.prepare("SELECT * FROM notes ORDER BY updated_at DESC, id DESC").all() as Note[]).map(plainSqlRow),
    todos: (database.prepare("SELECT * FROM todos WHERE owner_email=? ORDER BY done, due_date IS NULL, due_date, id DESC").all(email.trim().toLowerCase()) as Todo[]).map(plainSqlRow),
    location: weatherLocation()
  };
}

export function weatherLocation(): WeatherLocation | null {
  const row = db().prepare("SELECT name,latitude,longitude FROM weather_location WHERE id=1").get() as WeatherLocation | undefined;
  return row ? plainSqlRow(row) : null;
}
