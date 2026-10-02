import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceDefinitions, stateForHttpStatus, verifyProbeCertificate } from "../lib/service-config.ts";

test("qBittorrent uses its actual HTTPS listener", () => {
  assert.equal(serviceDefinitions.find(service => service.name === "qBittorrent")?.url, "https://127.0.0.1:8081/");
});
test("service opening links use public HTTPS URLs, not loopback probes", () => {
  for (const service of serviceDefinitions) {
    assert.equal(new URL(service.href).protocol, "https:");
    assert.notEqual(new URL(service.href).hostname, "127.0.0.1");
  }
});
test("HTTP authorization responses are not classified as offline", () => {
  assert.equal(stateForHttpStatus(200), "online");
  assert.equal(stateForHttpStatus(302), "online");
  assert.equal(stateForHttpStatus(401), "protected");
  assert.equal(stateForHttpStatus(403), "protected");
  assert.equal(stateForHttpStatus(500), "offline");
});
test("certificate exception is limited to fixed local TLS endpoints", () => {
  assert.equal(verifyProbeCertificate(new URL("https://127.0.0.1:8081/")), false);
  assert.equal(verifyProbeCertificate(new URL("https://127.0.0.1:8920/")), false);
  assert.equal(verifyProbeCertificate(new URL("https://example.com:8081/")), true);
  assert.equal(verifyProbeCertificate(new URL("https://127.0.0.1:443/")), true);
});
