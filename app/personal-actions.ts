"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth";
import { db } from "@/lib/db";
import { InputError, inputId, inputText, inputLocation, quickLinkUrl, PERSONAL_LIMITS, type ActionResult } from "@/lib/personal-types";

async function mutate(operation: () => void, success: string): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { error: "A módosításhoz admin jogosultság szükséges." }; }
  try { operation(); revalidatePath("/"); revalidatePath("/config"); revalidatePath("/notes"); return { success }; }
  catch (error) { return { error: error instanceof InputError ? error.message : "A módosítás nem sikerült. Próbáld újra." }; }
}
function capacity(table: "quick_links" | "notes" | "todos", limit: number) {
  const row = db().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  if (row.n >= limit) throw new InputError(`Legfeljebb ${limit} elem tárolható ebben a gyűjteményben.`);
}
function exists(changes: number | bigint) { if (!changes) throw new InputError("Ez az elem már nem található. Frissítsd az oldalt."); }

export async function saveQuickLink(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => {
    const title = inputText(data.get("title"), "Link neve", 80);
    const url = quickLinkUrl(data.get("url"));
    const description = inputText(data.get("description"), "Leírás", 160, true);
    if (data.get("id")) {
      exists(db().prepare("UPDATE quick_links SET title=?,url=?,description=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(title,url,description,inputId(data.get("id"))).changes);
    } else {
      capacity("quick_links", PERSONAL_LIMITS.quickLinks);
      db().prepare("INSERT INTO quick_links(title,url,description) VALUES(?,?,?)").run(title,url,description);
    }
  }, "Link elmentve.");
}
export async function deleteQuickLink(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => { exists(db().prepare("DELETE FROM quick_links WHERE id=?").run(inputId(data.get("id"))).changes); }, "Link törölve.");
}
export async function saveNote(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => {
    const title = inputText(data.get("title"), "Jegyzet címe", 120);
    const content = inputText(data.get("content"), "Jegyzet", 5000);
    if (data.get("id")) {
      exists(db().prepare("UPDATE notes SET title=?,content=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(title,content,inputId(data.get("id"))).changes);
    } else {
      capacity("notes", PERSONAL_LIMITS.notes);
      db().prepare("INSERT INTO notes(title,content) VALUES(?,?)").run(title,content);
    }
  }, "Jegyzet elmentve.");
}
export async function deleteNote(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => { exists(db().prepare("DELETE FROM notes WHERE id=?").run(inputId(data.get("id"))).changes); }, "Jegyzet törölve.");
}
export async function saveTodo(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => {
    const text = inputText(data.get("text"), "Feladat", 200);
    if (data.get("id")) {
      exists(db().prepare("UPDATE todos SET text=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(text,inputId(data.get("id"))).changes);
    } else {
      capacity("todos", PERSONAL_LIMITS.todos);
      db().prepare("INSERT INTO todos(text) VALUES(?)").run(text);
    }
  }, "Feladat elmentve.");
}
export async function toggleTodo(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => { exists(db().prepare("UPDATE todos SET done=1-done,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(inputId(data.get("id"))).changes); }, "");
}
export async function deleteTodo(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => { exists(db().prepare("DELETE FROM todos WHERE id=?").run(inputId(data.get("id"))).changes); }, "Feladat törölve.");
}
export async function setWeatherLocation(_previous: ActionResult, data: FormData): Promise<ActionResult> {
  return mutate(() => {
    const location = inputLocation(data.get("name"), data.get("latitude"), data.get("longitude"));
    db().prepare("INSERT INTO weather_location(id,name,latitude,longitude) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude").run(location.name,location.latitude,location.longitude);
  }, "Település beállítva.");
}
