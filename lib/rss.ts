import "server-only";
import { db, feeds, type Feed } from "@/lib/db";
import { downloadFeed } from "@/lib/feed-download";
import { parseFeedArticles } from "@/lib/rss-parser";

async function refresh(feed: Feed, force: boolean) {
  if (!force && feed.checked_at && Date.now() - Date.parse(feed.checked_at) < 15 * 60_000) return;
  try {
    const xml = await downloadFeed(feed.url);
    const items = parseFeedArticles(xml, feed.url, feed.article_limit);
    const checkedAt = new Date().toISOString();
    const insert = db().prepare(`INSERT INTO articles(feed_id,guid,title,url,published,image_url,seen_at,source_position) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(feed_id,guid) DO UPDATE SET title=excluded.title, url=excluded.url,
      published=excluded.published, image_url=excluded.image_url, seen_at=excluded.seen_at, source_position=excluded.source_position`);
    for (const [position, item] of items.entries()) {
      insert.run(feed.id, item.guid, item.title, item.url, item.published, item.image_url, checkedAt, position);
    }
    db().prepare("UPDATE feeds SET checked_at=?, error=NULL WHERE id=?").run(checkedAt, feed.id);
    db().prepare("DELETE FROM articles WHERE feed_id=? AND id NOT IN (SELECT id FROM articles WHERE feed_id=? ORDER BY id DESC LIMIT 500)").run(feed.id, feed.id);
  } catch {
    db().prepare("UPDATE feeds SET checked_at=?, error=? WHERE id=?").run(new Date().toISOString(), "A forrás nem frissíthető. Ellenőrizd az RSS-címet.", feed.id);
  }
}

let running: Promise<void> | undefined;
export async function refreshFeeds(force = false) {
  if (running) return running;
  running = (async () => { for (const feed of feeds()) await refresh(feed, force); })();
  try { await running; } finally { running = undefined; }
}
