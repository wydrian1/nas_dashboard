import "server-only";
import { cpus, freemem, totalmem } from "node:os";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { cpuUsage, parseDisks, type CpuSample, type DiskInfo, type SystemSnapshot } from "@/lib/system-types";

function cpuSample(): CpuSample {
  return cpus().reduce((sample, cpu) => ({
    idle: sample.idle + cpu.times.idle,
    total: sample.total + Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
  }), { idle: 0, total: 0 });
}

async function readDisks(): Promise<DiskInfo[]> {
  // Fixed command only: no request parameters or user input enter PowerShell.
  const command = `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false;
    $ErrorActionPreference = 'Stop';
    $disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
      [PSCustomObject]@{ name=$_.DeviceID; total=[double]$_.Size; free=[double]$_.FreeSpace }
    });
    ConvertTo-Json -InputObject $disks -Compress`;
  const encoded = Buffer.from(command, "utf16le").toString("base64");
  const executable = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const output = await new Promise<string>((resolve, reject) => {
    execFile(executable, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
      windowsHide: true, timeout: 8000, maxBuffer: 128 * 1024, encoding: "utf8"
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
  return parseDisks(output);
}

let cached: { time: number; snapshot: SystemSnapshot } | undefined;
let previousSample: CpuSample | undefined;
let running: Promise<SystemSnapshot> | undefined;

export async function systemSnapshot(): Promise<SystemSnapshot> {
  if (cached && Date.now() - cached.time < 30_000) return cached.snapshot;
  if (running) return running;
  running = (async () => {
    const before = previousSample || cpuSample();
    const first = !previousSample;
    let diskError = false;
    const [disks] = await Promise.all([
      readDisks().catch(() => { diskError = true; return [] as DiskInfo[]; }),
      first ? delay(750) : Promise.resolve()
    ]);
    const after = cpuSample();
    previousSample = after;
    const snapshot: SystemSnapshot = {
      checked: new Date().toISOString(),
      cpuPercent: cpuUsage(before, after),
      memory: { total: totalmem(), free: freemem() },
      disks,
      diskError
    };
    cached = { time: Date.now(), snapshot };
    return snapshot;
  })();
  try { return await running; } finally { running = undefined; }
}
