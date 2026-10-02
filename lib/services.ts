import "server-only";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { serviceDefinitions, stateForHttpStatus, verifyProbeCertificate } from "@/lib/service-config";
export type ServiceStatus = { name: string; description: string; label: string; href: string; state: "online" | "protected" | "offline"; latency: number; checked: string };
let cached: { time: number; results: ServiceStatus[] } | undefined;
export async function serviceStatuses(): Promise<ServiceStatus[]> {
  if (cached && Date.now() - cached.time < 30_000) return cached.results;
  const results = await Promise.all(serviceDefinitions.map(service => new Promise<ServiceStatus>(resolve => {
    const started = Date.now();
    const finish = (state: ServiceStatus["state"]) => resolve({ name: service.name, description: service.description, label: service.label, href: service.href, state, latency: Date.now() - started, checked: new Date().toISOString() });
    const url = new URL(service.url);
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    // Local TLS exceptions never apply to external hosts or RSS downloads.
    const req = request(url, { rejectUnauthorized: verifyProbeCertificate(url), signal: AbortSignal.timeout(4000) }, response => {
      response.resume();
      const code = response.statusCode || 0;
      finish(stateForHttpStatus(code));
    });
    req.on("error", () => finish("offline"));
    req.end();
  })));
  cached = { time: Date.now(), results };
  return results;
}
