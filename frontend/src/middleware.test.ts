import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function request(path: string, { cookies = {}, headers = {} }: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest(`http://localhost:3000${path}`, { headers: { ...(cookie ? { cookie } : {}), ...headers } });
}

describe("route guards", () => {
  it("sends signed-out visitors of admin pages to the admin login, keeping where they were going", () => {
    const response = middleware(request("/admin/orders?status=paid"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login?next=%2Fadmin%2Forders%3Fstatus%3Dpaid");
  });

  it("leaves the admin login and password pages public", () => {
    for (const path of ["/admin/login", "/admin/forgot-password", "/admin/reset-password?token=x"]) {
      expect(middleware(request(path)).headers.get("location")).toBeNull();
    }
  });

  it("sends signed-out shoppers away from checkout, orders and account", () => {
    for (const path of ["/checkout", "/orders/ORD-2026-000001", "/account"]) {
      expect(middleware(request(path)).headers.get("location")).toMatch(/^http:\/\/localhost:3000\/login\?next=/);
    }
  });

  it("lets signed-in visitors through, and never mixes the two sessions", () => {
    expect(middleware(request("/admin", { cookies: { shop_admin_token: "t" } })).headers.get("location")).toBeNull();
    expect(middleware(request("/checkout", { cookies: { shop_customer_token: "t" } })).headers.get("location")).toBeNull();
    expect(middleware(request("/admin", { cookies: { shop_customer_token: "t" } })).headers.get("location")).toContain("/admin/login");
  });

  it("keeps public storefront pages public", () => {
    expect(middleware(request("/shop?search=polo")).headers.get("location")).toBeNull();
  });
});

describe("content security policy", () => {
  it("issues a fresh nonce per request and allows only Stripe as a third party", () => {
    const first = middleware(request("/")).headers.get("content-security-policy")!;
    const second = middleware(request("/")).headers.get("content-security-policy")!;
    const nonce = /'nonce-([^']+)'/.exec(first)?.[1];

    expect(nonce).toBeTruthy();
    expect(second).not.toContain(nonce);
    expect(first).toContain("frame-ancestors 'none'");
    expect(first).toContain("object-src 'none'");
    expect(first).toMatch(/script-src 'self' 'nonce-[^']+' https:\/\/js\.stripe\.com/);
    expect(first).toMatch(/img-src [^;]*https:\/\/res\.cloudinary\.com/);
  });

  it("upgrades insecure requests only behind HTTPS", () => {
    expect(middleware(request("/")).headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
    expect(middleware(request("/", { headers: { "x-forwarded-proto": "https" } })).headers.get("content-security-policy")).toContain(
      "upgrade-insecure-requests",
    );
  });
});
