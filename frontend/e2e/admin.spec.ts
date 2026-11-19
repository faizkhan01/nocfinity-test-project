import { expect, test } from "@playwright/test";
import { AUTH, SUPER_ADMIN, SUPPORT } from "./support";

test.describe("admin sign-in", () => {
  test("customers' and staff sessions are separate: the admin needs its own login", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH.customer });
    const page = await context.newPage();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/);
    await context.close();
  });

  test("wrong password is refused, the right one opens the dashboard", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[name="email"]').fill(SUPER_ADMIN.email);
    await page.locator('input[name="password"]').fill("Not-The-Passw0rd!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.locator('input[name="password"]').fill(SUPER_ADMIN.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

test.describe("permissions", () => {
  test("support staff only see what their role allows, and the API backs it up", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[name="email"]').fill(SUPPORT.email);
    await page.locator('input[name="password"]').fill(SUPPORT.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/admin/);

    // Support is read-only: it can look at orders and products but not manage staff or roles.
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Roles & Permissions" })).toHaveCount(0);

    await page.goto("/admin/roles");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();

    expect((await page.request.get("/bff/admin/roles")).status()).toBe(403);
    expect((await page.request.get("/bff/admin/orders")).status()).toBe(200);
  });
});

test.describe("managing the shop", () => {
  test.use({ storageState: AUTH.admin });

  test("an order moves along its lifecycle and records the change", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByLabel("Status").selectOption("paid");
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("Paid");
    await firstRow.locator("a").first().click();
    await expect(page).toHaveURL(/\/admin\/orders\/\d+/);

    await page.getByRole("button", { name: "Mark as processing" }).click();

    await expect(page.getByText(/paid → processing/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as processing" })).toHaveCount(0);
  });

  test("the dark theme applies to the whole panel and survives a reload", async ({ page }) => {
    await page.goto("/admin");

    await page.getByRole("radio", { name: "Dark theme" }).click();
    await expect(page.locator("[data-theme=dark]").first()).toBeVisible();

    await page.reload();
    await expect(page.locator("[data-theme=dark]").first()).toBeVisible();
    await page.getByRole("radio", { name: "Light theme" }).click();
  });

  test("the Super Admin role cannot be edited", async ({ page }) => {
    await page.goto("/admin/roles");
    await expect(page.getByRole("checkbox", { name: /^Super Admin:/ }).first()).toBeDisabled();
  });
});
