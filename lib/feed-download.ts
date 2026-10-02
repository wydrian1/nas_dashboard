import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import type { TcpSocketConnectOpts } from "node:net";
import { feedUrl, isPublicAddress } from "./url-policy.ts";

const MAX_BYTES = 2 * 1024 * 1024;

export function pinnedAddressOptions(address: { address: string; family: number }): RequestOptions & Pick<TcpSocketConnectOpts, "autoSelectFamily"> {
  return {
    family: address.family,
    // Node's automatic family selection asks lookup() for an array. This probe
    // deliberately uses one validated address, so disable selection/re-resolution.
    autoSelectFamily: false,
    lookup: (_host, _options, callback) => callback(null, address.address, address.family)
  };
}

export async function downloadFeed(input: string, redirects = 0): Promise<string> {
  const url = feedUrl(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Nem nyilvános RSS-cím.");
  const result = await new Promise<{ body: string; location?: string }>((resolve, reject) => {
    const req = request(url, {
      ...pinnedAddressOptions(addresses[0]),
      headers: { "User-Agent": "WydrianDashboard/0.1", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(12_000)
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
        res.resume();
        if (!res.headers.location) { reject(new Error("Hiányzó RSS-átirányítás.")); return; }
        resolve({ body: "", location: res.headers.location });
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error("Az RSS-forrás nem válaszolt megfelelően.")); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) req.destroy(new Error("Az RSS-forrás túl nagy."));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
      res.on("aborted", () => reject(new Error("Megszakadt RSS-letöltés.")));
    });
    req.on("error", reject);
    req.end();
  });
  if (result.location) {
    if (redirects >= 3) throw new Error("Túl sok RSS-átirányítás.");
    return downloadFeed(new URL(result.location, url).href, redirects + 1);
  }
  return result.body;
}
