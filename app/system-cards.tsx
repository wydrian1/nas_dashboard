"use client";
import { useEffect, useState } from "react";
import { formatBytes, usedPercent, type SystemSnapshot } from "@/lib/system-types";

function UsageMeter({ label, value }: { label: string; value: number }) {
  return <div className={`usage-meter ${value >= 90 ? "high" : value >= 75 ? "medium" : "normal"}`} role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div>;
}

export default function SystemCards({ initial }: { initial: SystemSnapshot }) {
  const [info, setInfo] = useState(initial);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/system", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Nem érhető el.");
        const snapshot: SystemSnapshot = await response.json();
        if (active) { setInfo(snapshot); setError(false); }
      } catch { if (active) setError(true); }
    }, 30_000);
    return () => { active = false; clearInterval(timer); controller.abort(); };
  }, []);
  const memoryPercent = usedPercent(info.memory.total, info.memory.free);
  const percent = (value: number) => `${value.toLocaleString("hu-HU", { maximumFractionDigits: 1 })}%`;
  return <>
    <div className="resource-grid">
      <article className="resource-card"><div className="resource-heading"><span className="resource-symbol">▥</span><h3>CPU-terhelés</h3><span className="subtle">Teljes gép</span></div>
        <strong className="resource-value">{info.cpuPercent === null ? "—" : percent(info.cpuPercent)}</strong>
        {info.cpuPercent !== null && <UsageMeter label="CPU-terhelés" value={info.cpuPercent} />}
        <p className="resource-caption">Az összes processzormag átlagos kihasználtsága</p>
      </article>
      <article className="resource-card"><div className="resource-heading"><span className="resource-symbol">▤</span><h3>Memória</h3><span className="subtle">RAM</span></div>
        <strong className="resource-value">{formatBytes(info.memory.free)} <small>szabad</small></strong>
        <UsageMeter label="Memória kihasználtsága" value={memoryPercent} />
        <p className="resource-caption">{formatBytes(info.memory.total)} összesen <span>{percent(memoryPercent)} használatban</span></p>
      </article>
    </div>
    <div className="disk-grid">{info.disks.map(disk => <article className="resource-card disk-card" key={disk.name}>
      <div className="resource-heading"><span className="resource-symbol">▱</span><h3>{disk.name} meghajtó</h3></div>
      <strong className="resource-value">{formatBytes(disk.free)} <small>szabad</small></strong>
      <UsageMeter label={`${disk.name} tárhely kihasználtsága`} value={usedPercent(disk.total, disk.free)} />
      <p className="resource-caption">{formatBytes(disk.total)} összesen <span>{percent(usedPercent(disk.total, disk.free))} foglalt</span></p>
    </article>)}</div>
    {info.diskError && <p className="error">A meghajtóadatok most nem olvashatók ki. A következő frissítéskor újrapróbáljuk.</p>}
    <p className="footnote" aria-live="polite">{error ? "A frissítés sikertelen; az utolsó ismert rendszeradatok láthatók." : "Windows rendszeradatok · 30 másodpercenként frissül · a CPU értéke a mintavételi időszak átlaga"}</p>
  </>;
}
