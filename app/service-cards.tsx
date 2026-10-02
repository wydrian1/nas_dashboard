"use client";
import { useEffect, useState } from "react";
import type { ServiceStatus } from "@/lib/services";

export default function ServiceCards({ initial }: { initial: ServiceStatus[] }) {
  const [services, setServices] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) { setError(true); return; }
        setServices(await response.json()); setError(false);
      } catch { setError(true); }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  return <><div className="service-grid">{services.map((service, i) => <article className="service-card" key={service.name}>
    <div className={`service-icon icon-${i}`}>{["↓", "▶", "◈"][i]}</div>
    <span className={`status ${service.state}`}><i />{service.state === "online" ? "Elérhető" : service.state === "protected" ? "Hitelesítést kér" : "Nem elérhető"}</span>
    <h3><a className="service-title-link" href={service.href} target="_blank" rel="noopener noreferrer">{service.name}<span aria-hidden="true">↗</span></a></h3><p>{service.description}</p>
    <div className="card-bottom"><span>Port {service.label} · {service.state !== "offline" ? `${service.latency} ms` : "—"}</span><a className="service-open" href={service.href} target="_blank" rel="noopener noreferrer" aria-label={`${service.name} megnyitása új lapon`}>Megnyitás ↗</a></div>
  </article>)}</div><p className="footnote">{error ? "Az automatikus ellenőrzés sikertelen; az utolsó ismert állapot látható." : "Helyi HTTP-ellenőrzés · 30 másodpercenként frissül · nem teljes körű működési teszt"}</p></>;
}
