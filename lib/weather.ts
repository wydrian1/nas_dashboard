import "server-only";
import { parseCities, parseWeather, type CityResult, type WeatherSnapshot } from "@/lib/weather-types";
import type { WeatherLocation } from "@/lib/personal-types";

async function providerJson(url: URL): Promise<unknown> {
  // Only fixed Open-Meteo origins, no browser-provided URLs, cookies or tokens.
  if (!["api.open-meteo.com","geocoding-api.open-meteo.com"].includes(url.hostname)) throw new Error("Érvénytelen szolgáltató.");
  const response = await fetch(url, { cache:"no-store", redirect:"error", signal:AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("Az időjárásszolgáltató nem érhető el.");
  const body = await response.text();
  if (body.length > 256 * 1024) throw new Error("Túl nagy szolgáltatói válasz.");
  return JSON.parse(body);
}
const cities = new Map<string, {time:number; results:CityResult[]}>();
export async function searchCities(query: string): Promise<CityResult[]> {
  const cached = cities.get(query.toLowerCase());
  if (cached && Date.now()-cached.time < 60 * 60_000) return cached.results;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({name:query,count:"5",language:"hu",format:"json"}).toString();
  const results = parseCities(await providerJson(url));
  if (cities.size >= 20) cities.delete(cities.keys().next().value!);
  cities.set(query.toLowerCase(),{time:Date.now(),results});
  return results;
}
const forecasts = new Map<string,{time:number; retryAfter:number; snapshot:WeatherSnapshot}>();
const running = new Map<string,Promise<WeatherSnapshot>>();
export async function forecast(location: WeatherLocation): Promise<WeatherSnapshot> {
  const key = `${location.latitude},${location.longitude}`;
  const cached = forecasts.get(key);
  if (cached && (Date.now()-cached.time < 15 * 60_000 || Date.now()<cached.retryAfter)) return cached.snapshot;
  const inProgress = running.get(key);
  if (inProgress) return inProgress;
  const operation = (async () => {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",timezone:"auto",forecast_days:"5",temperature_unit:"celsius",wind_speed_unit:"kmh"}).toString();
      const snapshot = parseWeather(await providerJson(url));
      if (forecasts.size>=5) forecasts.delete(forecasts.keys().next().value!);
      forecasts.set(key,{time:Date.now(),retryAfter:0,snapshot});
      return snapshot;
    } catch (error) {
      if (!cached || Date.now()-cached.time>6*60*60_000) throw error;
      cached.snapshot = {...cached.snapshot,stale:true};
      cached.retryAfter = Date.now()+60_000;
      return cached.snapshot;
    }
  })();
  running.set(key,operation);
  try { return await operation; } finally { running.delete(key); }
}
