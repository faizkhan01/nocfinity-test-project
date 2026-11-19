import { describe, expect, it } from "vitest";
import { defaultSort, listOf, pickParams, shopHref } from "./shop-filters";

describe("pickParams", () => {
  it("keeps only known filters, so arbitrary query keys never reach the API", () => {
    expect(pickParams({ search: "shirt", token: "x", page: "2", utm_source: "ad" })).toEqual({ search: "shirt", page: "2" });
  });

  it("joins repeated values and caps their length", () => {
    expect(pickParams({ colors: ["Red", "Blue"] })).toEqual({ colors: "Red,Blue" });
    expect(pickParams({ search: "x".repeat(500) }).search).toHaveLength(200);
  });

  it("drops empty values", () => {
    expect(pickParams({ search: "", category: undefined })).toEqual({});
  });
});

describe("shopHref", () => {
  it("builds a stable URL in filter order", () => {
    expect(shopHref({ sort: "newest", search: "polo" })).toBe("/shop?search=polo&sort=newest");
  });

  it("applies changes and removes cleared filters", () => {
    expect(shopHref({ search: "polo", page: "3" }, { page: undefined, colors: "Red" })).toBe("/shop?search=polo&colors=Red");
    expect(shopHref({ search: "polo" }, { search: undefined })).toBe("/shop");
  });

  it("encodes values", () => {
    expect(shopHref({ search: "t-shirt & tee" })).toBe("/shop?search=t-shirt+%26+tee");
  });
});

describe("listOf", () => {
  it("splits comma lists and ignores blanks", () => {
    expect(listOf("Red,,Blue")).toEqual(["Red", "Blue"]);
    expect(listOf(undefined)).toEqual([]);
  });
});

describe("defaultSort", () => {
  it("ranks searches by relevance and plain listings by popularity", () => {
    expect(defaultSort({ search: "jeans" })).toBe("relevance");
    expect(defaultSort({})).toBe("popular");
  });
});
