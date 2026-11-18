import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/config";

const CUSTOMER_ONLY = ["/checkout", "/orders", "/account"];
const ADMIN_PUBLIC = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

function contentSecurityPolicy(nonce: string, https: boolean): string {
  const dev = process.env.NODE_ENV !== "production";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self'",
    `connect-src 'self' https://api.stripe.com https://r.stripe.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** Cheap redirect for signed-out visitors; the API still authorizes every request on its own. */
function guard(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin") && !ADMIN_PUBLIC.some((p) => pathname.startsWith(p)) && !request.cookies.has(COOKIE.admin)) {
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(pathname + search)}`, request.url));
  }

  if (CUSTOMER_ONLY.some((p) => pathname.startsWith(p)) && !request.cookies.has(COOKIE.customer)) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url));
  }

  return null;
}

export function middleware(request: NextRequest) {
  const redirect = guard(request);
  if (redirect) return redirect;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = contentSecurityPolicy(nonce, https);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [{ source: "/((?!bff|storage|_next/static|_next/image|images|icons|fonts|favicon.ico).*)" }],
};
