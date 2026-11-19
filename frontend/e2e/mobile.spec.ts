import { expect, test } from "@playwright/test";

test.describe("mobile layout", () => {
  for (const path of ["/", "/shop", "/product/one-life-graphic-t-shirt", "/cart", "/login"]) {
    test(`${path} fits the screen without sideways scrolling`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the search opens from the header icon and suggests products", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    const search = page.getByRole("combobox", { name: "Search for products" }).last();
    await search.pressSequentially("jean", { delay: 60 });

    await expect(page.getByRole("option").first()).toContainText(/jean|denim/i);
  });
});
