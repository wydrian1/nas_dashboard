import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { createServer } from "node:net";
import { once } from "node:events";
import { pinnedAddressOptions, downloadFeed } from "../lib/feed-download.ts";

test("pinned DNS resolver is compatible with Node automatic family selection", async () => {
  const server = createServer(socket => {
    socket.once("data", () => socket.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok"));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ hostname:"rss-test.invalid", port:address.port, ...pinnedAddressOptions({address:"127.0.0.1",family:4}), signal:AbortSignal.timeout(3000) }, response => { response.resume(); resolve(response.statusCode || 0); });
      req.on("error", reject); req.end();
    });
    assert.equal(status, 200);
  } finally { server.close(); }
});
test("real RSS downloader still rejects loopback URLs", async () => {
  await assert.rejects(downloadFeed("https://127.0.0.1/rss"), /Nem nyilvános/);
});
