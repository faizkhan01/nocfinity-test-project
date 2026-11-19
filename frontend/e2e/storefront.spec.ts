import { expect, test } from "@playwright/test";
import { PRODUCT, addProductToCart, cartLink } from "./support";

test.describe("storefront", () => {
  test("home page shows the hero and the product sections", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/find clothes that matches your style/i);
    await expect(page.getByRole("heading", { name: /new arrivals/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /top selling/i })).toBeVisible();
  });

  test("search suggests products while typing, without pressing Enter", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("banner").getByRole("combobox", { name: "Search for products" });

    await search.pressSequentially("shir", { delay: 60 });

    const options = page.getByRole("listbox", { name: "Matching products" }).getByRole("option");
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toContainText(/shirt/i);

    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/product\/[a-z0-9-]+$/);
  });

  test("search forgives typos and filters the shop grid live", async ({ page }) => {
    await page.goto("/shop");
    const search = page.getByRole("banner").getByRole("combobox", { name: "Search for products" });

    await search.pressSequentially("shrit", { delay: 60 });

    await expect(page).toHaveURL(/search=shrit/);
    await expect(page.getByRole("main").getByRole("link", { name: /shirt/i }).first()).toBeVisible();
  });

  test("filters and sorting live in the URL", async ({ page }) => {
    await page.goto("/shop?category=men");

    await page.getByRole("button", { name: "Blue", exact: true }).first().click();
    await page.getByRole("button", { name: "Apply Filter" }).first().click();
    await expect(page).toHaveURL(/colors=Blue/);

    await page.getByLabel("Sort products").first().selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);

    // Reloading the same URL gives the same server-rendered result.
    const before = await page.getByRole("main").getByRole("link").allInnerTexts();
    await page.reload();
    expect(await page.getByRole("main").getByRole("link").allInnerTexts()).toEqual(before);
  });

  test("an unknown product is a 404", async ({ page }) => {
    const response = await page.goto("/product/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("cart", () => {
  test("a guest can add a product and keep the cart across reloads", async ({ page }) => {
    await addProductToCart(page, 2);
    await expect(cartLink(page)).toHaveAccessibleName("Cart, 2 items");

    await page.reload();
    await expect(cartLink(page)).toHaveAccessibleName("Cart, 2 items");

    await page.goto("/cart");
    await expect(page.getByRole("main")).toContainText(PRODUCT.name);
    await expect(page.getByRole("main")).toContainText(`Color: ${PRODUCT.color}`);
  });

  test("quantities update the totals, which come from the API", async ({ page }) => {
    await addProductToCart(page);
    await page.goto("/cart");
    const subtotal = page.getByText("Subtotal").locator("..");
    const one = await subtotal.innerText();

    await page.getByRole("main").getByRole("button", { name: "Increase quantity" }).click();

    await expect(subtotal).not.toHaveText(one);
    await expect(cartLink(page)).toHaveAccessibleName("Cart, 2 items");
  });

  test("an expired coupon is rejected and a valid one is applied", async ({ page }) => {
    await addProductToCart(page);
    await page.goto("/cart");
    const promo = page.getByLabel("Promo code");

    await promo.fill("SUMMER10");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("This coupon has expired.")).toBeVisible();

    await promo.fill("save15");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("Discount (SAVE15)")).toBeVisible();
    await expect(page.getByText("-$15")).toBeVisible();
  });

  test("an empty cart cannot go to checkout", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("button", { name: /Go to Checkout/ })).toHaveCount(0);
  });
});
