import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { initializeDatabase, ARTICLE_QUERY } from "../lib/db-schema.ts";

test("existing database gains defaults without losing feeds, articles or read state", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`CREATE TABLE feeds(id INTEGER PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL UNIQUE,checked_at TEXT,error TEXT);
      CREATE TABLE articles(id INTEGER PRIMARY KEY,feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,guid TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,published TEXT,is_read INTEGER NOT NULL DEFAULT 0,UNIQUE(feed_id,guid));
      INSERT INTO feeds VALUES(1,'Old feed','https://example.com/rss','2026-01-01',NULL);
      INSERT INTO articles VALUES(7,1,'old','Old article','https://example.com/old','2026-01-01',1);`);
    initializeDatabase(database);
    const feed = database.prepare("SELECT * FROM feeds").get();
    const article = database.prepare("SELECT * FROM articles").get();
    assert.equal(feed?.article_limit, 20);
    assert.equal(feed?.checked_at, null);
    assert.equal(article?.id, 7);
    assert.equal(article?.is_read, 1);
    assert.equal(article?.image_url, null);
    database.exec("UPDATE feeds SET checked_at='2026-01-02'");
    initializeDatabase(database);
    assert.equal(database.prepare("SELECT checked_at FROM feeds").get()?.checked_at, "2026-01-02");
  } finally { database.close(); }
});
test("visible limits are independent per feed and changing them preserves archives", () => {
  const database = new DatabaseSync(":memory:");
  try {
    initializeDatabase(database);
    database.exec("INSERT INTO feeds(id,name,url,article_limit) VALUES(1,'One','https://one.example/rss',2),(2,'Two','https://two.example/rss',3)");
    const insert = database.prepare("INSERT INTO articles(feed_id,guid,title,url,published) VALUES(?,?,?,?,?)");
    for (const feed of [1,2]) for (let n=1;n<=5;n++) insert.run(feed,String(n),`News ${n}`,`https://example.com/${n}`,`2026-01-0${n}`);
    let rows = database.prepare(ARTICLE_QUERY).all();
    assert.equal(rows.filter(row => row.feed_id === 1).length, 2);
    assert.equal(rows.filter(row => row.feed_id === 2).length, 3);
    assert.equal(rows[0].title, "News 5");
    database.exec("UPDATE feeds SET article_limit=1 WHERE id=1");
    rows = database.prepare(ARTICLE_QUERY).all();
    assert.equal(rows.filter(row => row.feed_id === 1).length, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM articles").get()?.n, 10);
  } finally { database.close(); }
});
test("undated current entries win over older archive and retain source order", () => {
  const database = new DatabaseSync(":memory:");
  try {
    initializeDatabase(database);
    database.exec(`INSERT INTO feeds(id,name,url,article_limit) VALUES(1,'One','https://example.com/rss',2);
      INSERT INTO articles(feed_id,guid,title,url,seen_at,source_position) VALUES
      (1,'a','First','https://example.com/a','2026-01-02',0),
      (1,'b','Second','https://example.com/b','2026-01-02',1),
      (1,'c','Older','https://example.com/c','2026-01-01',0);`);
    assert.deepEqual(database.prepare(ARTICLE_QUERY).all().map(row => row.title), ["First", "Second"]);
  } finally { database.close(); }
});
