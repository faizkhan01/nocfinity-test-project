import { afterEach, describe, expect, it, vi } from "vitest";

// The secret is read once at import, so each case loads a fresh copy of the module.
async function loadConfig(secret?: string) {
  vi.resetModules();
  if (secret !== undefined) vi.stubEnv("BFF_SHARED_SECRET", secret);
  return import("./config");
}

afterEach(() => vi.unstubAllEnvs());

describe("visitorIp", () => {
  it("prefers the platform's x-real-ip, then the first x-forwarded-for hop", async () => {
    const { visitorIp } = await loadConfig();
    expect(visitorIp(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1" }))).toBe("203.0.113.7");
    expect(visitorIp(new Headers({ "x-forwarded-for": " 198.51.100.4 , 10.0.0.1" }))).toBe("198.51.100.4");
    expect(visitorIp(new Headers())).toBeNull();
  });
});

describe("clientIpHeaders", () => {
  it("vouches for the visitor IP with the shared secret when one is set", async () => {
    const { clientIpHeaders } = await loadConfig("s3cret");
    expect(clientIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toEqual({ "X-Client-IP": "203.0.113.7", "X-BFF-Secret": "s3cret" });
  });

  it("falls back to X-Forwarded-For without a secret, and sends nothing without an IP", async () => {
    const { clientIpHeaders } = await loadConfig("");
    expect(clientIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toEqual({ "X-Forwarded-For": "203.0.113.7" });
    expect(clientIpHeaders(new Headers())).toEqual({});
  });
});
