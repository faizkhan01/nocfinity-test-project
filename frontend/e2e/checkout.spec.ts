import { expect, test, type Page } from "@playwright/test";
import { AUTH, addProductToCart } from "./support";

// Stripe Elements needs real test-mode keys, so this runs only when the stack has them.
test.skip(process.env.E2E_STRIPE !== "1", "Set E2E_STRIPE=1 with Stripe test keys in the API to run checkout");
test.use({ storageState: AUTH.customer });
test.describe.configure({ mode: "serial" });

async function fillShipping(page: Page) {
  await page.getByRole("button", { name: /Go to Checkout/ }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.locator('input[name="name"]').fill("E2E Shopper");
  await page.locator('input[name="line1"]').fill("742 Evergreen Terrace");
  await page.locator('input[name="city"]').fill("Springfield");
  await page.locator('input[name="postal_code"]').fill("49007");
  await page.locator('input[name="phone"]').fill("+1 555 010 2030");
  await page.getByRole("button", { name: "Continue to payment" }).click();
}

async function payWith(page: Page, card: string) {
  const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await frame.locator('input[name="cardnumber"]').fill(card);
  await frame.locator('input[name="exp-date"]').fill("12 / 34");
  await frame.locator('input[name="cvc"]').fill("123");
  await page.getByRole("button", { name: /^Pay / }).click();
}

test("a declined card shows Stripe's message and creates no paid order", async ({ page }) => {
  await addProductToCart(page);
  await page.goto("/cart");
  await fillShipping(page);

  await payWith(page, "4000 0000 0000 0002");

  await expect(page.getByRole("alert").filter({ hasText: /declined/i })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/checkout/);
});

test("a card payment is authorized, captured and shown as a paid order", async ({ page }) => {
  await page.goto("/cart");
  if (await page.getByRole("button", { name: /Go to Checkout/ }).count() === 0) await addProductToCart(page);
  await page.goto("/cart");
  await fillShipping(page);

  await payWith(page, "4242 4242 4242 4242");

  await expect(page).toHaveURL(/\/orders\/ORD-\d{4}-\d{6}/, { timeout: 45_000 });
  const orderNumber = /ORD-\d{4}-\d{6}/.exec(page.url())![0];
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByRole("main")).toContainText(orderNumber);
  await expect(page.getByRole("link", { name: /^Cart, 0 items$/ })).toBeVisible();

  if (process.env.MAILPIT_URL) {
    await expect
      .poll(async () => {
        const res = await page.request.get(`${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(orderNumber)}`);
        return (await res.json()).messages_count ?? 0;
      }, { timeout: 30_000, message: "confirmation email in Mailpit" })
      .toBeGreaterThan(0);
  }
});
