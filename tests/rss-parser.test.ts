import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeedArticles, enclosureImage } from "../lib/rss-parser.ts";
import { readArticleLimit } from "../lib/rss-settings.ts";

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>News</title>${items}</channel></rss>`;
const item = (n: number) => `<item><guid>${n}</guid><title>News ${n}</title><link>https://example.com/${n}</link><pubDate>${new Date(Date.UTC(2026, 0, n)).toUTCString()}</pubDate><enclosure url="https://images.example.com/${n}.jpg" type="image/jpeg" /></item>`;

test("feed limits default to 20 and accept only integers from 1 to 100", () => {
  assert.equal(readArticleLimit(undefined), 20);
  assert.equal(readArticleLimit(null), 20);
  assert.equal(readArticleLimit(""), 20);
  assert.equal(readArticleLimit("5"), 5);
  assert.equal(readArticleLimit(100), 100);
  for (const invalid of [0, 101, -1, 1.5, "abc", "1e2", Infinity]) assert.throws(() => readArticleLimit(invalid));
});
test("unsorted RSS returns the latest requested count with enclosure images", () => {
  const xml = rss(Array.from({length:30}, (_, index) => item(index + 1)).join(""));
  const articles = parseFeedArticles(xml, "https://example.com/rss", 20);
  assert.equal(articles.length, 20);
  assert.equal(articles[0].title, "News 30");
  assert.equal(articles[19].title, "News 11");
  assert.equal(articles[0].image_url, "https://images.example.com/30.jpg");
  assert.equal(parseFeedArticles(xml, "https://example.com/rss", 5).length, 5);
});
test("missing dates retain feed order and duplicate GUIDs do not consume the limit", () => {
  const xml = rss('<item><guid>a</guid><title>First</title><link>https://example.com/a</link></item><item><guid>a</guid><title>Duplicate</title><link>https://example.com/a</link></item><item><guid>b</guid><title>Second</title><link>https://example.com/b</link></item>');
  assert.deepEqual(parseFeedArticles(xml, "https://example.com/rss", 20).map(article => article.title), ["First", "Second"]);
});
test("non-image, unsafe and local enclosures are not rendered", () => {
  for (const enclosure of [
    {"@_url":"https://example.com/audio.mp3", "@_type":"audio/mpeg"},
    {"@_url":"javascript:alert(1)", "@_type":"image/jpeg"},
    {"@_url":"https://127.0.0.1/photo.jpg", "@_type":"image/jpeg"},
    {"@_url":"https://localhost/photo.jpg", "@_type":"image/jpeg"},
    {"@_url":"https://example.com/photo.svg", "@_type":"image/svg+xml"},
    {"@_url":"http://example.com/photo.jpg", "@_type":"image/jpeg"}
  ]) assert.equal(enclosureImage({enclosure}, "https://example.com/rss"), null);
  assert.equal(enclosureImage({enclosure:{"@_url":"/photo.png"}}, "https://example.com/rss"), "https://example.com/photo.png");
});
test("Atom enclosure links are supported without replacing the article link", () => {
  const xml = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>a</id><title>Atom news</title><updated>2026-01-01T00:00:00Z</updated><link rel="alternate" href="https://example.com/news"/><link rel="enclosure" type="image/webp" href="https://images.example.com/news.webp"/></entry></feed>';
  const article = parseFeedArticles(xml, "https://example.com/atom", 20)[0];
  assert.equal(article.url, "https://example.com/news");
  assert.equal(article.image_url, "https://images.example.com/news.webp");
});
test("XML external entities remain rejected", () => {
  assert.throws(() => parseFeedArticles('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]><rss><channel/></rss>', "https://example.com/rss", 20));
});
