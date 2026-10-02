export type CpuSample = { idle: number; total: number };
export type DiskInfo = { name: string; total: number; free: number };
export type SystemSnapshot = {
  checked: string;
  cpuPercent: number | null;
  memory: { total: number; free: number };
  disks: DiskInfo[];
  diskError: boolean;
};

export function cpuUsage(before: CpuSample, after: CpuSample): number | null {
  const total = after.total - before.total;
  const idle = after.idle - before.idle;
  if (!Number.isFinite(total) || !Number.isFinite(idle) || total <= 0 || idle < 0) return null;
  return Math.round(Math.min(100, Math.max(0, (1 - idle / total) * 100)) * 10) / 10;
}

export function usedPercent(total: number, free: number): number {
  return total > 0 ? Math.min(100, Math.max(0, (1 - free / total) * 100)) : 0;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = bytes > 0 ? Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${(bytes / 1024 ** index).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} ${units[index]}`;
}

export function parseDisks(json: string): DiskInfo[] {
  const parsed: unknown = JSON.parse(json.replace(/^\uFEFF/, ""));
  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const disk = value as Record<string, unknown>;
    if (typeof disk.name !== "string" || !/^[A-Z]:$/i.test(disk.name)
      || typeof disk.total !== "number" || !Number.isFinite(disk.total) || disk.total <= 0
      || typeof disk.free !== "number" || !Number.isFinite(disk.free) || disk.free < 0 || disk.free > disk.total) return [];
    return [{ name: disk.name, total: disk.total, free: disk.free }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
