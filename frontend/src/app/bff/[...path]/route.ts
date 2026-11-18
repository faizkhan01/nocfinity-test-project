import { NextRequest, NextResponse } from "next/server";
import { API_URL, COOKIE, secureCookies } from "@/lib/config";

type Ctx = { params: Promise<{ path: string[] }> };

/** Endpoints whose successful response carries a bearer token that must become an httpOnly cookie. */
const LOGIN_ROUTES: Record<string, "customer" | "admin"> = {
  "auth/login": "customer",
  "auth/register": "customer",
  "admin/auth/login": "admin",
};

const LOGOUT_ROUTES: Record<string, "customer" | "admin"> = {
  "auth/logout": "customer",
  "admin/auth/logout": "admin",
};

const cookieOptions = { httpOnly: true, secure: secureCookies, sameSite: "lax" as const, path: "/" };

/** Same-origin check for state-changing requests (CSRF), on top of SameSite=Lax cookies. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status });
}

async function proxy(request: NextRequest, { params }: Ctx) {
  const path = (await params).path.join("/");

  if (!/^[A-Za-z0-9\-_/.]+$/.test(path) || path.includes("..") || path.startsWith("webhooks")) {
    return json({ message: "Resource not found.", code: "not_found" }, 404);
  }

  const mutating = !["GET", "HEAD"].includes(request.method);
  if (mutating && !isSameOrigin(request)) {
    return json({ message: "Cross-site request rejected.", code: "invalid_origin" }, 403);
  }

  const isAdmin = path.startsWith("admin/");
  const tokenCookie = isAdmin ? COOKIE.admin : COOKIE.customer;
  const token = request.cookies.get(tokenCookie)?.value;
  const cartToken = request.cookies.get(COOKIE.cart)?.value;

  // Guests have no session to check; avoid a noisy 401 on every page view.
  if (path === "auth/me" && !token) {
    return json({ data: null }, 200);
  }

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cartToken && !isAdmin) headers.set("X-Cart-Token", cartToken);
  headers.set("User-Agent", request.headers.get("user-agent") ?? "shop-bff");
  headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1");

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/${path}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: mutating ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return json({ message: "The shop is temporarily unavailable. Please try again.", code: "upstream_unavailable" }, 503);
  }

  if (upstream.status === 204) {
    const response = new NextResponse(null, { status: 204 });
    if (LOGOUT_ROUTES[path]) response.cookies.delete(tokenCookie);
    return response;
  }

  const body = await upstream.json().catch(() => ({ message: "Unexpected response from the API." }));
  const loginKind = LOGIN_ROUTES[path];

  // Strip the token from the body so it never reaches browser JavaScript.
  if (loginKind && upstream.ok && body?.data?.token) {
    const { token: newToken, expires_at: expiresAt, ...rest } = body.data;
    const response = json({ data: rest }, upstream.status);
    response.cookies.set(loginKind === "admin" ? COOKIE.admin : COOKIE.customer, newToken, {
      ...cookieOptions,
      ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
    });
    if (loginKind === "customer") response.cookies.delete(COOKIE.cart);
    return response;
  }

  if (path.startsWith("cart") && body?.data && "token" in body.data) {
    const { token: guestToken, ...rest } = body.data;
    const response = json({ data: rest }, upstream.status);
    if (guestToken) response.cookies.set(COOKIE.cart, guestToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return response;
  }

  const response = json(body, upstream.status);
  if (upstream.status === 401 && token) response.cookies.delete(tokenCookie);
  if (LOGOUT_ROUTES[path]) response.cookies.delete(tokenCookie);

  return response;
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
