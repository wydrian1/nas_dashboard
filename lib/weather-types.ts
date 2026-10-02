import { inputLocation } from "./personal-types.ts";

export type CityResult = { id: number; name: string; detail: string; latitude: number; longitude: number };
export type WeatherSnapshot = {
  checked: string; stale: boolean;
  current: { temperature: number | null; feelsLike: number | null; humidity: number | null; wind: number | null; code: number | null; isDay: boolean; time: string };
  days: { date: string; min: number | null; max: number | null; rain: number | null; code: number | null }[];
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function number(value: unknown, min = -Infinity, max = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function text(value: unknown): string { return typeof value === "string" ? value.slice(0,100) : ""; }

export function parseCities(data: unknown): CityResult[] {
  const results = record(data).results;
  if (!Array.isArray(results)) return [];
  return results.slice(0,5).flatMap(value => {
    const city = record(value);
    try {
      const location = inputLocation(city.name, city.latitude, city.longitude);
      const id = number(city.id, 1);
      if (id === null || !Number.isSafeInteger(id)) return [];
      const detail = [...new Set([text(city.admin1),text(city.country)].filter(part => part && part !== location.name))].join(", ");
      return [{ id, name:location.name, detail, latitude:location.latitude, longitude:location.longitude }];
    } catch { return []; }
  });
}
export function parseWeather(data: unknown): WeatherSnapshot {
  const source = record(data), current = record(source.current), daily = record(source.daily);
  const dates = daily.time;
  if (!Object.keys(current).length || !Array.isArray(dates)) throw new Error("Hiányzó időjárási adatok.");
  const at = (key: string, index: number) => Array.isArray(daily[key]) ? daily[key][index] : undefined;
  const days = dates.slice(0,5).flatMap((date, index) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? [{
    date, min:number(at("temperature_2m_min",index),-100,100), max:number(at("temperature_2m_max",index),-100,100),
    rain:number(at("precipitation_probability_max",index),0,100), code:number(at("weather_code",index),0,100)
  }] : []);
  if (!days.length) throw new Error("Hiányzó előrejelzés.");
  return {
    checked:new Date().toISOString(), stale:false,
    current:{temperature:number(current.temperature_2m,-100,100),feelsLike:number(current.apparent_temperature,-100,100),humidity:number(current.relative_humidity_2m,0,100),wind:number(current.wind_speed_10m,0,500),code:number(current.weather_code,0,100),isDay:current.is_day === 1,time:text(current.time)},
    days
  };
}

export function weatherLabel(code: number | null): string {
  if (code === null) return "Nincs adat";
  if (code === 0) return "Derült";
  if (code === 1) return "Többnyire derült";
  if (code === 2) return "Részben felhős";
  if (code === 3) return "Borult";
  if ([45,48].includes(code)) return "Ködös";
  if ([51,53,55].includes(code)) return "Szitálás";
  if ([56,57,66,67].includes(code)) return "Ónos csapadék";
  if ([61,63,65].includes(code)) return "Eső";
  if ([71,73,75,77,85,86].includes(code)) return "Havazás";
  if ([80,81,82].includes(code)) return "Zápor";
  if ([95,96,97,99].includes(code)) return "Zivatar";
  return "Változékony idő";
}
export function weatherIcon(code: number | null, isDay = true): string {
  if (code === 0 || code === 1) return isDay ? "☀" : "☾";
  if (code !== null && [95,96,97,99].includes(code)) return "ϟ";
  if (code !== null && [71,73,75,77,85,86].includes(code)) return "❄";
  if (code !== null && [51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return "☂";
  return "☁";
}
