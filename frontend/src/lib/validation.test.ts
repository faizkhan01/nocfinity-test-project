import { describe, expect, it } from "vitest";
import { addressSchema, loginSchema, passwordRule, registerSchema, safeNext } from "./validation";

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("passwordRule", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordRule.safeParse("Str0ng!pass").success).toBe(true);
  });

  it.each([
    ["Sh0rt!", "Use at least 8 characters."],
    ["NOLOWER1!", "Add a lowercase letter."],
    ["noupper1!", "Add an uppercase letter."],
    ["NoNumber!", "Add a number."],
    ["NoSymbol1", "Add a symbol."],
    [`A1!${"a".repeat(70)}`, "Use at most 72 characters."],
  ])("rejects %s", (password, message) => {
    expect(firstError(passwordRule.safeParse(password))).toBe(message);
  });
});

describe("loginSchema", () => {
  it("trims the email and requires both fields", () => {
    expect(loginSchema.parse({ email: "  jane@example.com ", password: "x" }).email).toBe("jane@example.com");
    expect(firstError(loginSchema.safeParse({ email: "nope", password: "x" }))).toBe("Enter a valid email address.");
    expect(firstError(loginSchema.safeParse({ email: "jane@example.com", password: "" }))).toBe("Password is required.");
  });
});

describe("registerSchema", () => {
  it("reports a mismatched confirmation on the confirmation field", () => {
    const result = registerSchema.safeParse({ name: "Jane", email: "jane@example.com", password: "Str0ng!pass", password_confirmation: "other" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["password_confirmation"], message: "Passwords do not match." });
  });
});

describe("addressSchema", () => {
  const address = { name: "Jane Customer", phone: "+1 555 010 2030", line1: "742 Evergreen Terrace", city: "Springfield", postal_code: "49007", country: "US" };

  it("accepts a complete address with optional lines left empty", () => {
    expect(addressSchema.safeParse({ ...address, line2: "", state: "" }).success).toBe(true);
  });

  it("rejects bad phone numbers, postal codes and countries", () => {
    expect(firstError(addressSchema.safeParse({ ...address, phone: "call me" }))).toBe("Enter a valid phone number.");
    expect(firstError(addressSchema.safeParse({ ...address, postal_code: "<script>" }))).toBe("Enter a valid postal code.");
    expect(firstError(addressSchema.safeParse({ ...address, country: "USA" }))).toBe("Choose a country.");
  });
});

describe("safeNext", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/orders/ORD-1?tab=items")).toBe("/orders/ORD-1?tab=items");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "falls back for %s, preventing open redirects",
    (next) => {
      expect(safeNext(next, "/account")).toBe("/account");
    },
  );
});
