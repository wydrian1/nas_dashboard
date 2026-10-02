import { XMLParser, XMLValidator } from "fast-xml-parser";
import { isIP } from "node:net";
import { articleUrl, feedUrl, isPublicAddress } from "./url-policy.ts";
import { readArticleLimit } from "./rss-settings.ts";

export type ParsedArticle = { guid: string; title: string; url: string; published: string | null; image_url: string | null };

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") return text((value as Record<string, unknown>)["#text"]);
  return "";
}
function array<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }

export function enclosureImage(item: Record<string, unknown>, base: string): string | null {
  const candidates = [
    ...array(item.enclosure),
    ...array(item.link).filter(link => link && typeof link === "object" && (link as Record<string, unknown>)["@_rel"] === "enclosure")
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const enclosure = candidate as Record<string, unknown>;
    const type = text(enclosure["@_type"]).toLowerCase().split(";")[0].trim();
    const source = text(enclosure["@_url"] || enclosure["@_href"]);
    if (!source || source.length > 2048) continue;
    try {
      const url = feedUrl(new URL(source, base).href);
      const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
      if (hostname === "localhost" || /\.(localhost|local|lan|internal)$/.test(hostname) || (isIP(hostname) && !isPublicAddress(hostname))) continue;
      const knownImage = /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(url.pathname);
      if (type ? !/^image\/(jpeg|jpg|png|gif|webp|avif|bmp|x-ms-bmp)$/.test(type) : !knownImage) continue;
      return url.href;
    } catch { /* Invalid, mixed-content and non-image enclosures are skipped. */ }
  }
  return null;
}

export function parseFeedArticles(xml: string, base: string, requestedLimit: number): ParsedArticle[] {
  const limit = readArticleLimit(requestedLimit);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("Érvénytelen RSS XML.");
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  const channel = parsed.rss?.channel || parsed.feed;
  if (!channel) throw new Error("Nem RSS vagy Atom forrás.");
  const entries = array<Record<string, unknown>>(channel.item || channel.entry);
  const articles = entries.flatMap((item, position) => {
    if (!item || typeof item !== "object") return [];
    const atomLink = array(item.link).find(link => link && typeof link === "object" && (!(link as Record<string, unknown>)["@_rel"] || (link as Record<string, unknown>)["@_rel"] === "alternate")) as Record<string, unknown> | undefined;
    const link = atomLink ? text(atomLink["@_href"]) : text(item.link);
    const url = articleUrl(link, base);
    if (!url || !link) return [];
    const date = Date.parse(text(item.pubDate || item.published || item.updated));
    const article: ParsedArticle & { position: number } = {
      guid: (text(item.guid || item.id) || url).slice(0, 2048),
      title: text(item.title).replace(/<[^>]*>/g, "").slice(0, 500) || "Névtelen hír",
      url,
      published: Number.isFinite(date) ? new Date(date).toISOString() : null,
      image_url: enclosureImage(item, base),
      position
    };
    return [article];
  });
  articles.sort((a, b) => (b.published ? Date.parse(b.published) : -Infinity) - (a.published ? Date.parse(a.published) : -Infinity) || a.position - b.position);
  const seen = new Set<string>();
  return articles.filter(article => {
    if (seen.has(article.guid)) return false;
    seen.add(article.guid);
    return true;
  }).slice(0, limit).map(({ position: _position, ...article }) => article);
}
