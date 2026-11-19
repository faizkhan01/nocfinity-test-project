import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const upstream = vi.fn();

beforeEach(() => {
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
});

function respond(status: number, body?: unknown) {
  upstream.mockResolvedValueOnce(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

function call(handler: typeof GET, path: string, init: { method?: string; body?: unknown; cookies?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { host: "shop.test", "x-real-ip": "203.0.113.7" };
  if (init.cookies) headers.cookie = init.cookies;
  if (init.origin !== null) headers.origin = init.origin ?? "http://shop.test";
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const request = new NextRequest(`http://shop.test/bff/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return handler(request, { params: Promise.resolve({ path: path.split("?")[0].split("/") }) });
}

describe("BFF proxy", () => {
  it("rejects path tricks and keeps webhooks unreachable through the proxy", async () => {
    for (const path of ["..%2Fsecret", "webhooks/stripe", "products/<x>"]) {
      expect((await call(GET, path)).status).toBe(404);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses state-changing requests from another origin or without one (CSRF)", async () => {
    expect((await call(POST, "cart/items", { method: "POST", body: {}, origin: "https://evil.example" })).status).toBe(403);
    expect((await call(POST, "cart/items", { method: "POST", body: {}, origin: null })).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards the query string, the bearer and cart tokens, and the visitor IP", async () => {
    respond(200, { data: [] });

    await call(GET, "products?search=polo", { cookies: "shop_customer_token=abc; shop_cart_token=cart1" });

    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/products?search=polo");
    expect(init.headers.get("Authorization")).toBe("Bearer abc");
    expect(init.headers.get("X-Cart-Token")).toBe("cart1");
    expect(init.headers.get("X-Forwarded-For")).toBe("203.0.113.7");
  });

  it("uses the admin token for admin routes and never sends the cart token there", async () => {
    respond(200, { data: {} });

    await call(GET, "admin/dashboard", { cookies: "shop_customer_token=abc; shop_admin_token=adm; shop_cart_token=cart1" });

    const init = upstream.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBe("Bearer adm");
    expect(init.headers.get("X-Cart-Token")).toBeNull();
  });

  it("moves the login token into an httpOnly cookie and out of the response body", async () => {
    respond(200, { data: { token: "secret-token", expires_at: "2030-01-01T00:00:00Z", customer: { id: 1 } } });

    const response = await call(POST, "auth/login", { method: "POST", body: { email: "a@b.c", password: "x" } });
    const body = await response.json();
    const cookie = response.headers.get("set-cookie")!;

    expect(body).toEqual({ data: { customer: { id: 1 } } });
    expect(JSON.stringify(body)).not.toContain("secret-token");
    expect(cookie).toContain("shop_customer_token=secret-token");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("shop_cart_token=;");
  });

  it("stores a new guest cart token as a cookie", async () => {
    respond(201, { data: { token: "guest-cart", items: [] } });

    const response = await call(POST, "cart/items", { method: "POST", body: { product_id: 1, quantity: 1 } });

    expect(await response.json()).toEqual({ data: { items: [] } });
    expect(response.headers.get("set-cookie")).toContain("shop_cart_token=guest-cart");
  });

  it("answers the guest session check without calling the API", async () => {
    const response = await call(GET, "auth/me");
    expect(await response.json()).toEqual({ data: null });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("clears an expired session cookie on 401 and on logout", async () => {
    respond(401, { message: "Unauthenticated." });
    const expired = await call(GET, "orders", { cookies: "shop_customer_token=old" });
    expect(expired.status).toBe(401);
    expect(expired.headers.get("set-cookie")).toContain("shop_customer_token=;");

    respond(204);
    const logout = await call(POST, "auth/logout", { method: "POST", cookies: "shop_customer_token=old" });
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("shop_customer_token=;");
  });

  it("returns a friendly 503 when the API is down", async () => {
    upstream.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await call(GET, "products");

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "upstream_unavailable" });
  });
});
