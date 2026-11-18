import "server-only";
import { cookies, headers } from "next/headers";
import { API_URL, COOKIE, clientIpHeaders } from "@/lib/config";
import { ApiError } from "./errors";

type Options = { auth?: "customer" | "admin"; revalidate?: number };

/** Server components call Laravel directly with the token from the httpOnly cookie. */
export async function apiGet<T>(path: string, { auth, revalidate }: Options = {}): Promise<T> {
  const jar = await cookies();
  const requestHeaders = new Headers({ Accept: "application/json" });
  const token = auth ? jar.get(auth === "admin" ? COOKIE.admin : COOKIE.customer)?.value : undefined;
  const cartToken = jar.get(COOKIE.cart)?.value;
  const ipHeaders = clientIpHeaders(await headers());

  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  if (cartToken && auth !== "admin") requestHeaders.set("X-Cart-Token", cartToken);
  for (const [name, value] of Object.entries(ipHeaders)) requestHeaders.set(name, value);

  const response = await fetch(`${API_URL}/api/v1/${path.replace(/^\//, "")}`, {
    headers: requestHeaders,
    ...(token || revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
  });
  const json = await response.json().catch(() => ({ message: "Unexpected response from the API." }));

  if (!response.ok) {
    throw new ApiError(response.status, json);
  }

  return json as T;
}

export async function hasSession(kind: "customer" | "admin"): Promise<boolean> {
  return Boolean((await cookies()).get(kind === "admin" ? COOKIE.admin : COOKIE.customer)?.value);
}
