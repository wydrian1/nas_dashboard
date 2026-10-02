import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedProfile } from "../lib/access.ts";
import { feedUrl, isPublicAddress, articleUrl } from "../lib/url-policy.ts";

test("only the verified allowed Google account may sign in", () => {
  assert.equal(isAllowedProfile({ email: "wydrian@gmail.com", email_verified: true }, "wydrian@gmail.com"), true);
  assert.equal(isAllowedProfile({ email: "other@gmail.com", email_verified: true }, "wydrian@gmail.com"), false);
  assert.equal(isAllowedProfile({ email: "wydrian@gmail.com", email_verified: false }, "wydrian@gmail.com"), false);
  assert.equal(isAllowedProfile(null, "wydrian@gmail.com"), false);
});
test("RSS network policy rejects private and special addresses", () => {
  for (const ip of ["127.0.0.1", "192.168.1.20", "10.0.0.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "::ffff:127.0.0.1"]) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("RSS accepts HTTPS only, article links reject script protocols", () => {
  assert.throws(() => feedUrl("http://example.com/rss"));
  assert.throws(() => feedUrl("https://user:password@example.com/rss"));
  assert.throws(() => feedUrl("https://example.com:8081/rss"));
  assert.equal(articleUrl("javascript:alert(1)", "https://example.com"), null);
  assert.equal(articleUrl("/news", "https://example.com/rss"), "https://example.com/news");
});
