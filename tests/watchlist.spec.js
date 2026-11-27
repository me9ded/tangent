const { test, expect, openApp } = require("./fixtures");

const symbols = (page) => page.locator("#wl .wl-id b").allTextContents();

test("lists prices and today's movers", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#wl li")).toHaveCount(4);
  await expect(page.locator("#wl-count")).toHaveText("4 stocks");
  await expect(page.locator('#wl .chg[data-sym="NVDA"]')).toHaveText("▲ 5.26%");
  await expect(page.locator('#wl .chg[data-sym="MSFT"]')).toHaveText("▼ 1.96%");
  await expect(page.locator("#sum-h")).toHaveText("Nvidia leads, +5.26%");
  await expect(page.locator("#sum-p")).toContainText("2 of 4 up today");
  await expect(page.locator("#mkt")).toContainText("Market open");
});

test("sort modes", async ({ page }) => {
  await openApp(page);
  expect(await symbols(page)).toEqual(["NVDA", "AAPL", "TSLA", "MSFT"]);
  await page.locator('#sort [data-sort="az"]').click();
  expect(await symbols(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
  await page.locator('#sort [data-sort="mine"]').click();
  expect(await symbols(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
  await expect(page.locator('#sort [data-sort="mine"]')).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator('#sort [data-sort="mine"]')).toHaveAttribute("aria-pressed", "true");
});

test("change pill switches percent and dollars everywhere", async ({ page }) => {
  await openApp(page);
  await page.locator('#wl .chg[data-sym="AAPL"]').click();
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ $2.00");
  await expect(page.locator('#wl .chg[data-sym="MSFT"]')).toHaveText("▼ $8.00");
  // The pill's own tap must not open the price page.
  await expect(page.locator("#page")).toBeHidden();
  await page.locator('#wl .chg[data-sym="AAPL"]').click();
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ 1.01%");
});

test("a failed refresh keeps the last prices", async ({ page, finnhub }) => {
  await openApp(page);
  finnhub.down = true;
  await page.locator("#refresh").click();
  await expect(page.locator("#toast")).toHaveText("Couldn't refresh. Showing the last prices.");
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
});

test("a 429 pauses and keeps the last prices", async ({ page, finnhub }) => {
  await openApp(page);
  finnhub.rateLimit = true;
  await page.locator("#refresh").click();
  await expect(page.locator("#toast")).toContainText("slow down");
  await expect(page.locator('#wl .px[data-px="MSFT"]')).toHaveText("$400.00");
  expect(await page.evaluate(() => window.__tangent.fhQ.pausedUntil > Date.now())).toBe(true);
});

test("last prices show on the next open before the network answers", async ({ page, finnhub }) => {
  await openApp(page);
  finnhub.down = true;
  await page.reload();
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
});
