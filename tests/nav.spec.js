const { test, expect, openApp, TUE_CLOSE } = require("./fixtures");

const tab = (page, name) => page.locator(`.tabs [data-tab="${name}"]`);

test("the tab bar switches views and moves focus to each view's heading", async ({ page }) => {
  await openApp(page);
  await expect(tab(page, "home")).toHaveAttribute("aria-current", "page");
  await tab(page, "search").click();
  await expect(page.locator("#v-search")).toBeVisible();
  await expect(page.locator("#v-home")).toBeHidden();
  await expect(tab(page, "search")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "home")).not.toHaveAttribute("aria-current");
  await expect(page.locator("#search-h")).toBeFocused();
  await tab(page, "settings").click();
  await expect(page.locator("#v-settings")).toBeVisible();
  await expect(page.locator("#settings-h")).toBeFocused();
  await tab(page, "home").click();
  await expect(page.locator("#home-h")).toBeFocused();
});

test("each tab keeps its scroll, and tapping the current tab goes back to the top", async ({ page }) => {
  await openApp(page);
  const home = page.locator("#v-home");
  const y = await home.evaluate((v) => Math.min(200, v.scrollHeight - v.clientHeight));
  expect(y).toBeGreaterThan(50);
  await home.evaluate((v, y) => v.scrollTo(0, y), y);
  await tab(page, "settings").click();
  await tab(page, "home").click();
  expect(await home.evaluate((v) => v.scrollTop)).toBe(y);
  await tab(page, "home").click();
  await expect.poll(() => home.evaluate((v) => v.scrollTop)).toBe(0);
});

test("the stock page is a layer: the app behind it is inert, and focus comes back on close", async ({ page }) => {
  await openApp(page);
  const opener = page.locator('#wl li[data-sym="AAPL"] .wl-row');
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#page")).toBeVisible();
  await expect(page.locator("#pg-title")).toBeFocused();
  await expect(page.locator("#page")).toHaveAttribute("role", "dialog");
  expect(await page.evaluate(() => document.getElementById("app").inert)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#page")).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.getElementById("app").inert)).toBe(false);
});

test("focus returns to the same stock even after the list reorders behind the page", async ({ page }) => {
  await openApp(page);
  await page.locator('#wl li[data-sym="TSLA"] .wl-row').click();
  await expect(page.locator("#pg-title")).toHaveText("TSLA");
  // TSLA becomes the top mover while its page is open.
  await expect.poll(() => page.evaluate(() => [...window.__fakeWS.subs])).toContain("TSLA");
  await page.evaluate(() => window.__fakeWS.push([{ s: "TSLA", p: 300, t: Date.now() }]));
  await expect(page.locator("#pg-px")).toHaveText("$300.00");
  await expect.poll(() => page.locator("#wl .wl-id b").first().textContent()).toBe("TSLA");
  await page.keyboard.press("Escape");
  await expect(page.locator('#wl li[data-sym="TSLA"] .wl-row')).toBeFocused();
});

test("keyboard shortcuts: / searches, r refreshes", async ({ page, finnhub }) => {
  await openApp(page);
  await page.keyboard.press("/");
  await expect(page.locator("#v-search")).toBeVisible();
  await expect(page.locator("#search-input")).toBeFocused();
  // Typing in the box is just typing.
  await page.keyboard.type("r/");
  await expect(page.locator("#search-input")).toHaveValue("r/");
  await tab(page, "home").click();
  const before = finnhub.calls.filter((c) => c.path === "/quote").length;
  await page.keyboard.press("r");
  await expect.poll(() => finnhub.calls.filter((c) => c.path === "/quote").length).toBeGreaterThan(before);
});

test.describe("when the latest prices are Tuesday's close", () => {
  test.beforeEach(({ finnhub }) => { finnhub.quoteT = TUE_CLOSE; });

  test("everything says so instead of calling them today's", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#hero-lab")).toHaveText("Your list on Tue");
    await expect(page.locator("#mkt")).toHaveText("Market open· Tue 4:00 PM ET");
    await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveAttribute("aria-label", /^Apple up 1\.01%, \$2\.00 on Tue\./);
    // All rows are from the same day as the list, so none needs its own label.
    await expect(page.locator("#wl .chg .tag")).toHaveCount(0);
    await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
    await expect(page.locator("#pg-when")).toHaveText("Tue close");
  });
});
