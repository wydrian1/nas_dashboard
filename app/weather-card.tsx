"use client";
import { useEffect, useState } from "react";
import { ActionForm, ActionButton } from "./action-form";
import { setWeatherLocation } from "./personal-actions";
import type { WeatherLocation } from "@/lib/personal-types";
import { weatherIcon, weatherLabel, type CityResult, type WeatherSnapshot } from "@/lib/weather-types";

function CitySearch() {
  const [results,setResults] = useState<CityResult[]>([]);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [searched,setSearched] = useState(false);
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("city") || "").trim();
    setBusy(true);setError("");setResults([]);setSearched(false);
    try {
      const response = await fetch(`/api/weather/locations?q=${encodeURIComponent(query)}`,{cache:"no-store",signal:AbortSignal.timeout(15_000)});
      if (!response.ok) throw new Error("A keresés nem sikerült. Ellenőrizd a település nevét, majd próbáld újra.");
      setResults(await response.json());setSearched(true);
    } catch (error) { setError(error instanceof Error ? error.message : "A keresés nem sikerült."); }
    finally { setBusy(false); }
  }
  return <div className="city-search"><form onSubmit={search} className="city-search-form"><label>Település<input name="city" placeholder="Például: Budapest" required minLength={2} maxLength={80}/></label><button className="secondary-button" disabled={busy}>{busy ? "Keresés…" : "Keresés"}</button></form>
    {error && <p className="error" role="alert">{error}</p>}
    {searched && !results.length && <p className="footnote">Nincs találat. Próbálj más településnevet.</p>}
    <div className="city-results">{results.map(city=><ActionForm action={setWeatherLocation} key={city.id}>
      <input type="hidden" name="name" value={`${city.name}${city.detail ? `, ${city.detail}` : ""}`.slice(0,180)}/><input type="hidden" name="latitude" value={city.latitude}/><input type="hidden" name="longitude" value={city.longitude}/>
      <ActionButton className="city-result"><strong>{city.name}</strong><span>{city.detail}</span><b>Választás →</b></ActionButton>
    </ActionForm>)}</div>
  </div>;
}

export default function WeatherCard({ location }: { location: WeatherLocation | null }) {
  const [weather,setWeather] = useState<WeatherSnapshot | null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [retry,setRetry] = useState(0);
  const latitude=location?.latitude, longitude=location?.longitude;
  useEffect(()=>{
    setWeather(null);setError("");
    if (latitude === undefined || longitude === undefined) {setLoading(false);return;}
    let active=true;
    const controller=new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response=await fetch("/api/weather",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15_000)])});
        if (!response.ok) throw new Error("Az időjárás most nem tölthető be. Próbáld újra később.");
        const value:WeatherSnapshot=await response.json();
        if(active){setWeather(value);setError("");}
      } catch(error){if(active)setError(error instanceof Error ? error.message : "A frissítés sikertelen.");}
      finally{if(active)setLoading(false);}
    }
    void load();
    const timer=setInterval(()=>void load(),15*60_000);
    return()=>{active=false;clearInterval(timer);controller.abort();};
  },[latitude,longitude,retry]);
  const value=(number:number|null,unit="°")=>number===null ? "—" : `${Math.round(number).toLocaleString("hu-HU")}${unit}`;
  return <section id="weather" className="personal-section"><div className="section-heading"><h2>Időjárás</h2><span className="subtle">5 napos előrejelzés</span></div><div className="weather-panel">
    {!location ? <><div className="weather-empty"><span className="weather-symbol">☀</span><h3>Milyen idő lesz nálad?</h3><p>Válaszd ki a településedet. A választásodat megjegyezzük.</p></div><CitySearch/></> : <>
      <div className="weather-top"><h3>{location.name}</h3><button className="secondary-button" disabled={loading} onClick={()=>setRetry(retry+1)}>{loading ? "Betöltés…" : "↻ Frissítés"}</button></div>
      {!weather && loading && <p className="footnote" role="status">Az aktuális időjárás betöltése…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {weather && <><div className="weather-now"><span className="weather-symbol" aria-hidden="true">{weatherIcon(weather.current.code,weather.current.isDay)}</span><div><strong>{value(weather.current.temperature)}</strong><p>{weatherLabel(weather.current.code)}</p></div><div className="weather-stats"><span>Hőérzet <b>{value(weather.current.feelsLike)}</b></span><span>Páratartalom <b>{value(weather.current.humidity,"%")}</b></span><span>Szél <b>{value(weather.current.wind," km/h")}</b></span></div></div>
        <div className="weather-days">{weather.days.map((day,index)=><article key={day.date}><span>{index===0 ? "Ma" : new Intl.DateTimeFormat("hu-HU",{weekday:"short",timeZone:"UTC"}).format(new Date(`${day.date}T12:00:00Z`))}</span><span className="forecast-icon" role="img" aria-label={weatherLabel(day.code)}>{weatherIcon(day.code)}</span><strong>{value(day.max)} <small>{value(day.min)}</small></strong><span className="rain-chance">☂ {value(day.rain,"%")}</span></article>)}</div>
        <p className={`footnote ${weather.stale ? "error" : ""}`}>{weather.stale ? "A szolgáltató nem érhető el; korábbi előrejelzés látható. " : ""}Frissítve: {new Intl.DateTimeFormat("hu-HU",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Budapest"}).format(new Date(weather.checked))} · 15 perces gyorsítótár · modellalapú adatok</p>
      </>}
      <details className="personal-editor location-editor"><summary>Település módosítása</summary><CitySearch/></details>
    </>}
    <p className="weather-attribution">Időjárási adatok: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo ↗</a></p>
  </div></section>;
}
