import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const AUTH = { customer: "e2e/.auth/customer.json", admin: "e2e/.auth/admin.json" };

export const SUPER_ADMIN = { email: "superadmin@nocfinity-shop.test", password: "SuperAdmin@123" };
export const SUPPORT = { email: "support@nocfinity-shop.test", password: "Staff@12345" };
export const PASSWORD = "E2e-Passw0rd!";

/** A product that is in stock, over the SAVE15 minimum, and has colour and size options. */
export const PRODUCT = { slug: "one-life-graphic-t-shirt", name: "One Life Graphic T-shirt", color: "Forest", size: "Large" };

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}

/** Signs a customer up through the BFF, so the session cookie lands in this request context. */
export async function registerCustomer(request: APIRequestContext, baseURL: string, email = uniqueEmail("customer")) {
  const response = await request.post("/bff/auth/register", {
    headers: { Origin: baseURL },
    data: { name: "E2E Shopper", email, password: PASSWORD, password_confirmation: PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return email;
}

export async function addProductToCart(page: Page, quantity = 1) {
  await page.goto(`/product/${PRODUCT.slug}`);
  await page.getByRole("button", { name: PRODUCT.color }).click();
  await page.getByRole("button", { name: PRODUCT.size, exact: true }).click();
  for (let i = 1; i < quantity; i++) await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("link", { name: /^Cart, [1-9]\d* items?$/ })).toBeVisible();
}

export function cartLink(page: Page) {
  return page.getByRole("link", { name: /^Cart, \d+ items?$/ });
}
