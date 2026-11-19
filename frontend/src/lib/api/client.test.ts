import { describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { ApiError, errorMessage } from "./errors";

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api", () => {
  it("calls the same-origin BFF with a JSON body", async () => {
    const fetchMock = mockFetch(200, { data: { ok: true } });

    await expect(api("/cart/items", { method: "POST", body: { product_id: 1 } })).resolves.toEqual({ data: { ok: true } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/cart/items");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: '{"product_id":1}' });
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sends form data as-is so the browser sets the multipart boundary", async () => {
    const fetchMock = mockFetch(200, {});
    const form = new FormData();
    form.append("image", "x");

    await api("admin/products/1/images", { method: "POST", body: form });

    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("returns undefined for 204 responses", async () => {
    mockFetch(204);
    await expect(api("auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws an ApiError with the first message per field", async () => {
    mockFetch(422, { message: "Invalid data.", code: "validation_error", errors: { email: ["Taken.", "Other."] } });

    const error = (await api("auth/register", { method: "POST", body: {} }).catch((e: ApiError) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe("validation_error");
    expect(error.fieldErrors()).toEqual({ email: "Taken." });
    expect(errorMessage(error)).toBe("Invalid data.");
  });

  it("survives a non-JSON error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));

    const error = (await api("products").catch((e: Error) => e)) as Error;

    expect(error.message).toBe("Unexpected response from the server.");
    expect(errorMessage(new TypeError("offline"))).toBe("Something went wrong. Please try again.");
  });
});
