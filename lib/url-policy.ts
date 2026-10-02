import { isIP } from "node:net";

export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127)
      || (a === 198 && (b === 18 || b === 19)));
  }
  // Permit global-unicast IPv6 only; mapped IPv4/local/link-local are rejected.
  if (isIP(ip) === 6) return /^[23]/.test(ip) && !ip.startsWith("2001:db8:");
  return false;
}

export function feedUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Csak nyilvános HTTPS RSS-cím adható meg, egyedi port és jelszó nélkül.");
  }
  url.hash = "";
  return url;
}

export function articleUrl(input: string, base: string): string | null {
  try {
    const url = new URL(input, base);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
