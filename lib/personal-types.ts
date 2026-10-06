export type QuickLink = { id: number; title: string; url: string; description: string; updated_at: string };
export type Note = { id: number; title: string; content: string; updated_at: string };
export type Todo = { id: number; text: string; done: number; updated_at: string; due_date?:string|null;owner_email?:string };
export type WeatherLocation = { name: string; latitude: number; longitude: number };
export type ActionResult = { error?: string; success?: string };
export type FormAction = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

export const PERSONAL_LIMITS = { quickLinks: 60, notes: 50, todos: 100 };

import {InputError,inputText} from './mobile/task-inputs.ts';
export {InputError,inputText};

export function inputId(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new InputError("Érvénytelen azonosító.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new InputError("Érvénytelen azonosító.");
  return id;
}

export function quickLinkUrl(value: unknown): string {
  const source = inputText(value, "Webcím", 2048);
  try {
    const url = new URL(source);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new InputError("Érvényes HTTP vagy HTTPS webcímet adj meg, beágyazott jelszó nélkül."); }
}

export function inputLocation(name: unknown, latitude: unknown, longitude: unknown): WeatherLocation {
  const title = inputText(name, "Település", 180);
  const numeric = (value: unknown) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) ? Number(value) : NaN;
  const lat = numeric(latitude), lon = numeric(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new InputError("Érvénytelen településkoordináták.");
  return { name: title, latitude: lat, longitude: lon };
}
