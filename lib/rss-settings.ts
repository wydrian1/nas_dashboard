export const DEFAULT_ARTICLE_LIMIT = 20;
export const MIN_ARTICLE_LIMIT = 1;
export const MAX_ARTICLE_LIMIT = 100;

export function readArticleLimit(value: unknown): number {
  if (value === null || value === undefined || value === "") return DEFAULT_ARTICLE_LIMIT;
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isInteger(number) || number < MIN_ARTICLE_LIMIT || number > MAX_ARTICLE_LIMIT) {
    throw new Error(`A hírek száma ${MIN_ARTICLE_LIMIT} és ${MAX_ARTICLE_LIMIT} közötti egész szám legyen.`);
  }
  return number;
}
