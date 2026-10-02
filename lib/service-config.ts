export const serviceDefinitions = [
  { name: "qBittorrent", description: "Torrent kliens · helyi TLS", url: "https://127.0.0.1:8081/", label: "8081", href: "https://nas.wydrian.hu:8081/" },
  { name: "Plex", description: "Media server", url: "http://127.0.0.1:32400/identity", label: "32400", href: "https://app.plex.tv/desktop/" },
  { name: "Jellyfin", description: "Media server · helyi TLS", url: "https://127.0.0.1:8920/health", label: "8920", href: "https://nas.wydrian.hu:8920/" }
];

export function stateForHttpStatus(code: number): "online" | "protected" | "offline" {
  return [401, 403].includes(code) ? "protected" : code >= 200 && code < 400 ? "online" : "offline";
}

export function verifyProbeCertificate(url: URL): boolean {
  // Only these fixed loopback probes may use a local/self-signed certificate.
  return !(url.hostname === "127.0.0.1" && ["8081", "8920"].includes(url.port));
}
