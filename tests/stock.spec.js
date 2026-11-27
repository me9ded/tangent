const { test, expect, openApp } = require("./fixtures");

test("price page shows today's numbers and the 52-week range", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
  await expect(page.locator("#page")).toBeVisible();
  await expect(page.locator("#pg-head")).toContainText("Microsoft");
  await expect(page.locator("#pg-body .big-px")).toHaveText("$400.00");
  await expect(page.locator("#pg-change .dd")).toHaveText("−$8.00");
  const grid = page.locator("#pg-grid");
  await expect(grid).toContainText("Open$409.00");
  await expect(grid).toContainText("Previous close$408.00");
  await expect(grid).toContainText("52-week high$520.00");
  await expect(grid).toContainText("52-week low$240.00");
  await expect(page.locator('#pg-body .rng[data-kind="year"]')).not.toHaveClass(/empty/);

  // Back closes it, through history like the phone's back gesture.
  await page.goBack();
  await expect(page.locator("#page")).toBeHidden();
});

test("Escape closes the price page", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  await expect(page.locator("#page")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#page")).toBeHidden();
});

test("add a stock from search", async ({ page }) => {
  await openApp(page);
  await page.locator("#add").click();
  await page.locator("#add-input").fill("amd");
  const results = page.locator("#add-results button");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("AMD");
  await results.first().click();
  await expect(page.locator("#add-sheet")).toBeHidden();
  await expect(page.locator("#toast")).toHaveText("AMD added");
  await expect(page.locator("#wl li")).toHaveCount(5);
  await expect(page.locator('#wl .px[data-px="AMD"]')).toHaveText("$50.00");
  await page.reload();
  await expect(page.locator("#wl li")).toHaveCount(5);
});

test("remove a stock from its price page", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "TSLA" }).click();
  const wb = page.locator(".watchbtn");
  await expect(wb).toHaveText("Watching");
  await wb.click();
  await expect(wb).toHaveText("Tap to remove");
  await wb.click();
  await expect(wb).toHaveText("Watch");
  await expect(page.locator("#wl li")).toHaveCount(3);
  // Watch again from the same page.
  await wb.click();
  await expect(page.locator("#wl li")).toHaveCount(4);
});
