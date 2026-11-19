import { expect, test } from "@playwright/test";
import { PASSWORD, addProductToCart, cartLink, uniqueEmail } from "./support";

test.describe("customer accounts", () => {
  test("signed-out shoppers are sent to sign in and brought back", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);

    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("Return Trip");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("next"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/orders$/);
  });

  test("the registration form explains what is wrong before calling the API", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Full name").fill("J");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("weakpass");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Add an uppercase letter.")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("a wrong password is refused, and the right one signs in", async ({ page, request, baseURL }) => {
    const email = uniqueEmail("login");
    await request.post("/bff/auth/register", {
      headers: { Origin: baseURL! },
      data: { name: "Login Test", email, password: PASSWORD, password_confirmation: PASSWORD },
    });

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Wrong-Passw0rd!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("These credentials do not match our records.")).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("a redirect to another site after sign-in is ignored", async ({ page }) => {
    await page.goto("/register?next=//evil.example/steal");
    await page.getByLabel("Full name").fill("Safe Redirect");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("redirect"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/");
  });

  test("a guest cart is kept when the shopper creates an account", async ({ page }) => {
    await addProductToCart(page);

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Cart Merge");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("merge"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    await expect(cartLink(page)).toHaveAccessibleName("Cart, 1 item");
  });

  test("the session cookie is httpOnly, so page scripts cannot read it", async ({ page, context }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Cookie Check");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("cookie"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/");

    const session = (await context.cookies()).find((c) => c.name === "shop_customer_token");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("shop_customer_token");
  });
});
