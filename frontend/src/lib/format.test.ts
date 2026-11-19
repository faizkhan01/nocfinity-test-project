import { describe, expect, it } from "vitest";
import { assetUrl, cn, formatDate, money } from "./format";

describe("money", () => {
  it("drops the decimals for whole dollars, as in the design", () => {
    expect(money(12000)).toBe("$120");
    expect(money(0)).toBe("$0");
  });

  it("keeps cents when there are any", () => {
    expect(money(1999)).toBe("$19.99");
    expect(money(1050)).toBe("$10.50");
  });

  it("formats other currencies", () => {
    expect(money(500, "eur")).toBe("€5");
  });
});

describe("formatDate", () => {
  it("shows a dash for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats the day, with the time only when asked", () => {
    expect(formatDate("2026-11-19T00:00:00Z")).toMatch(/^November 1[89], 2026$/);
    expect(formatDate("2026-11-19T12:00:00Z", true)).toMatch(/November 19, 2026.*\d{1,2}:\d{2}/);
  });
});

describe("assetUrl", () => {
  it("serves uploads same-origin whatever host the API reports", () => {
    expect(assetUrl("https://api.example.com/storage/products/a.jpg")).toBe("/storage/products/a.jpg");
    expect(assetUrl("http://nginx/storage/x.png")).toBe("/storage/x.png");
  });

  it("leaves other URLs alone and passes through empty values", () => {
    expect(assetUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(assetUrl(null)).toBeNull();
    expect(assetUrl("")).toBeNull();
  });
});

describe("cn", () => {
  it("joins only truthy class names", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});
