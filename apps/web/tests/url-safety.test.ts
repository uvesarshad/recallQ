import assert from "node:assert/strict";
import {
  isBlockedHostname,
  isBlockedIpAddress,
  parseSafeHttpUrl,
  UnsafeUrlError,
} from "../lib/url-safety.ts";

export function runUrlSafetyTests() {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("api.localhost"), true);
  assert.equal(isBlockedHostname("example.com"), false);

  assert.equal(isBlockedIpAddress("127.0.0.1"), true);
  assert.equal(isBlockedIpAddress("10.1.2.3"), true);
  assert.equal(isBlockedIpAddress("172.16.0.1"), true);
  assert.equal(isBlockedIpAddress("192.168.1.2"), true);
  assert.equal(isBlockedIpAddress("169.254.169.254"), true);
  assert.equal(isBlockedIpAddress("::1"), true);
  assert.equal(isBlockedIpAddress("fc00::1"), true);
  assert.equal(isBlockedIpAddress("8.8.8.8"), false);
  assert.equal(isBlockedIpAddress("2001:4860:4860::8888"), false);

  assert.equal(parseSafeHttpUrl("https://example.com/path").hostname, "example.com");
  assert.throws(() => parseSafeHttpUrl("file:///etc/passwd"), UnsafeUrlError);
  assert.throws(() => parseSafeHttpUrl("http://127.0.0.1/admin"), UnsafeUrlError);
  assert.throws(() => parseSafeHttpUrl("https://user:pass@example.com"), UnsafeUrlError);
}
