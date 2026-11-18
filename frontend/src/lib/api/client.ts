import { ApiError } from "./errors";

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

/** Browser-side calls go through the same-origin BFF, which attaches the httpOnly auth cookie. */
export async function api<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/bff/${path.replace(/^\//, "")}`, {
    method,
    signal,
    credentials: "same-origin",
    headers: isForm ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const json = await response.json().catch(() => ({ message: "Unexpected response from the server." }));

  if (!response.ok) {
    throw new ApiError(response.status, json);
  }

  return json as T;
}
