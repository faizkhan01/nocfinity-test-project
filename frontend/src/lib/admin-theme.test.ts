import { describe, expect, it } from "vitest";
import { parseAdminTheme } from "./admin-theme";

describe("parseAdminTheme", () => {
  it("accepts the known themes", () => {
    expect(parseAdminTheme("dark")).toBe("dark");
    expect(parseAdminTheme("light")).toBe("light");
  });

  it("falls back to the system theme for missing or tampered cookies", () => {
    expect(parseAdminTheme(undefined)).toBe("system");
    expect(parseAdminTheme("purple")).toBe("system");
  });
});
