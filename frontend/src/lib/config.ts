export const API_URL = process.env.API_URL ?? "http://localhost:8000";

export const COOKIE = {
  customer: "shop_customer_token",
  admin: "shop_admin_token",
  cart: "shop_cart_token",
} as const;

export const isProduction = process.env.NODE_ENV === "production";

/** Lets the API believe the visitor IP the server passes on; server-only, never sent to browsers. */
export const BFF_SECRET = process.env.BFF_SHARED_SECRET ?? "";

/** Visitor IP as seen by the Next.js server (Vercel sets x-real-ip; local proxies set x-forwarded-for). */
export function visitorIp(headers: Headers): string | null {
  const ip = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
}

/** Headers that tell the API who the real visitor is. */
export function clientIpHeaders(headers: Headers): Record<string, string> {
  const ip = visitorIp(headers);
  if (!ip) return {};
  return BFF_SECRET ? { "X-Client-IP": ip, "X-BFF-Secret": BFF_SECRET } : { "X-Forwarded-For": ip };
}

/** Secure cookies in production unless explicitly disabled for a plain-HTTP local run. */
export const secureCookies = isProduction && process.env.COOKIE_SECURE !== "false";
