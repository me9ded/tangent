const { test, expect, openApp } = require("./fixtures");

const tab = (page, name) => page.locator(`.tabs [data-tab="${name}"]`).click();

test("price page shows today's numbers and the 52-week range", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
  await expect(page.locator("#page")).toBeVisible();
  await expect(page).toHaveURL(/#MSFT$/);
  await expect(page.locator("#pg-head")).toContainText("Microsoft");
  await expect(page.locator("#pg-px")).toHaveText("$400.00");
  await expect(page.locator("#pg-dd")).toHaveText("▼ Down $8.00 (1.96%)");
  await expect(page.locator("#pg-dd")).toHaveClass(/down/);
  await expect(page.locator("#pg-when")).toHaveText("Today · 10:59 AM ET");
  const grid = page.locator("#pg-grid");
  await expect(grid).toContainText("Open$409.00");
  await expect(grid).toContainText("Previous close$408.00");
  await expect(grid).toContainText("52-week high$520.00");
  await expect(grid).toContainText("52-week low$240.00");
  await expect(page.locator('#pg-body .rng[data-kind="year"]')).not.toHaveClass(/empty/);
  await expect(page.locator('#pg-body .rng[data-kind="day"]')).toHaveAttribute("aria-label", "From $395.00 to $410.00, now $400.00, open $409.00, previous close $408.00");

  // Back closes it, through history like the phone's back gesture.
  await page.goBack();
  await expect(page.locator("#page")).toBeHidden();
  await expect(page).not.toHaveURL(/#/);
});

test("Escape closes the price page", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  await expect(page.locator("#page")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#page")).toBeHidden();
});

test("a stock page's address opens it again, with Home behind it", async ({ page }) => {
  await page.goto("./#NVDA");
  await expect(page.locator("#page")).toBeVisible();
  await expect(page.locator("#pg-title")).toHaveText("NVDA");
  await expect(page.locator("#pg-px")).toHaveText("$120.00");
  await page.goBack();
  await expect(page.locator("#page")).toBeHidden();
  await expect(page.locator('#wl .px[data-px="NVDA"]')).toHaveText("$120.00");
});

test("reloading on a stock page, or going Forward to it, adds no extra back steps", async ({ page }) => {
  await openApp(page);
  const len = await page.evaluate(() => history.length);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  await expect(page).toHaveURL(/#AAPL$/);
  await page.reload();
  await expect(page.locator("#pg-title")).toHaveText("AAPL");
  expect(await page.evaluate(() => history.length)).toBe(len + 1);
  await page.goBack();
  await expect(page.locator("#page")).toBeHidden();
  await page.goForward();
  await expect(page.locator("#pg-title")).toHaveText("AAPL");
  expect(await page.evaluate(() => history.length)).toBe(len + 1);
  await page.goBack();
  await expect(page.locator("#page")).toBeHidden();
  await expect(page).not.toHaveURL(/#/);
});

test("add a stock from search with +", async ({ page }) => {
  await openApp(page);
  await page.locator("#add").click();
  await expect(page.locator("#v-search")).toBeVisible();
  await expect(page.locator("#search-input")).toBeFocused();
  await page.locator("#search-input").fill("amd");
  const results = page.locator("#search-results li");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("AMDAdvanced Micro Devices");
  const add = results.first().locator(".res-add");
  await expect(add).toHaveAttribute("aria-label", "Add AMD to your watchlist");
  await add.click();
  await expect(page.locator("#toast")).toHaveText("AMD added");
  await expect(add).toBeDisabled();
  await expect(add).toHaveAttribute("aria-label", "AMD is on your watchlist");
  // Still focused, so a screen reader hears the new label; pressing it again does nothing.
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(add).toBeFocused();
  await tab(page, "home");
  await expect(page.locator("#wl li")).toHaveCount(5);
  await expect(page.locator('#wl .px[data-px="AMD"]')).toHaveText("$50.00");
  await page.reload();
  await expect(page.locator("#wl li")).toHaveCount(5);
});

test("a search result opens as a preview you can watch, and is remembered", async ({ page }) => {
  await openApp(page);
  await tab(page, "search");
  await page.locator("#search-input").fill("amd");
  await page.locator("#search-results .res-open", { hasText: "AMD" }).click();
  await expect(page.locator("#page")).toBeVisible();
  await expect(page.locator("#pg-head")).toContainText("Advanced Micro Devices");
  const wb = page.locator("#pg-watch");
  await expect(wb).toHaveText("Watch");
  await expect(wb).toHaveAttribute("aria-pressed", "false");
  await wb.click();
  await expect(wb).toHaveText("Watching");
  await expect(page.locator("#toast")).toHaveText("AMD added");
  await page.goBack();
  // Focus is back on the result that opened the page.
  await expect(page.locator("#search-results .res-open", { hasText: "AMD" })).toBeFocused();

  await page.locator("#search-input").fill("");
  await expect(page.locator("#recent")).toBeVisible();
  await expect(page.locator("#recent-list li b")).toHaveText(["AMD"]);
  await page.locator("#recent-clear").click();
  await expect(page.locator("#recent")).toBeHidden();
});

test("remove a stock from its price page", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "TSLA" }).click();
  const wb = page.locator("#pg-watch");
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
