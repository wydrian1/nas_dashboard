"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { feedUrl } from "@/lib/url-policy";
import { refreshFeeds } from "@/lib/rss";
import { readArticleLimit } from "@/lib/rss-settings";

export async function login() { await signIn("google", { redirectTo: "/" }); }
export async function logout() { await signOut({ redirectTo: "/" }); }

function revalidateNewsPages() {
  revalidatePath("/");
  revalidatePath("/news");
  revalidatePath("/config");
}

export async function addFeed(data: FormData) {
  await requireAdmin();
  const name = String(data.get("name") || "").trim().slice(0, 100);
  const input = String(data.get("url") || "").trim();
  if (!name || input.length > 2048) throw new Error("Adj meg nevet és érvényes RSS-címet.");
  if ((db().prepare("SELECT COUNT(*) AS n FROM feeds").get() as { n: number }).n >= 20) throw new Error("Legfeljebb 20 RSS-forrás adható meg.");
  const url = feedUrl(input).href;
  const limit = readArticleLimit(data.get("article_limit"));
  db().prepare("INSERT OR IGNORE INTO feeds(name,url,article_limit) VALUES(?,?,?)").run(name, url, limit);
  await refreshFeeds();
  revalidateNewsPages();
}
export async function updateFeedLimit(data: FormData) {
  await requireAdmin();
  const id = Number(data.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Érvénytelen RSS-forrás.");
  const limit = readArticleLimit(data.get("article_limit"));
  db().prepare("UPDATE feeds SET article_limit=?, checked_at=NULL WHERE id=?").run(limit, id);
  await refreshFeeds();
  revalidateNewsPages();
}
export async function removeFeed(data: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM feeds WHERE id=?").run(Number(data.get("id")));
  revalidateNewsPages();
}
export async function toggleRead(data: FormData) {
  await requireAdmin();
  db().prepare("UPDATE articles SET is_read=1-is_read WHERE id=?").run(Number(data.get("id")));
  revalidateNewsPages();
}
export async function refreshNews() {
  await requireAdmin();
  await refreshFeeds(true);
  revalidateNewsPages();
}
