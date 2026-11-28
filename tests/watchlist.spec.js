const { test, expect, openApp } = require("./fixtures");

const symbols = (page) => page.locator("#wl .wl-id b").allTextContents();

test("lists prices, your list's average move and today's movers", async ({ page }) => {
  await openApp(page);
  await expect(page.locator("#wl li")).toHaveCount(4);
  await expect(page.locator("#wl-count")).toHaveText("4 stocks");
  // Screen readers hear "Up" or "Down" (visually hidden) instead of the triangle.
  await expect(page.locator('#wl .chg[data-sym="NVDA"]')).toHaveText("▲ Up 5.26%");
  await expect(page.locator('#wl .chg[data-sym="MSFT"]')).toHaveText("▼ Down 1.96%");
  await expect(page.locator('#wl .chg[data-sym="NVDA"]')).toHaveAttribute("aria-label", /^Nvidia up 5\.26%, \$6\.00 today\./);
  await expect(page.locator("#hero-lab")).toHaveText("Your list today");
  await expect(page.locator("#hero-val")).toHaveText("▲ Up 0.98%");
  await expect(page.locator("#hero-sub")).toHaveText("Average move of 4 stocks · 2 up");
  await expect(page.locator("#mv .mv-row .mv-sym")).toHaveText(["NVDA", "AAPL", "TSLA", "MSFT"]);
  await expect(page.locator("#mkt")).toHaveText("Market open· 10:59 AM ET");
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

test("tapping a change switches percent and dollars everywhere", async ({ page }) => {
  await openApp(page);
  await page.locator('#wl .chg[data-sym="AAPL"]').click();
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ Up $2.00");
  await expect(page.locator('#wl .chg[data-sym="MSFT"]')).toHaveText("▼ Down $8.00");
  // The change's own tap must not open the price page.
  await expect(page.locator("#page")).toBeHidden();
  await page.locator('#wl .chg[data-sym="AAPL"]').click();
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ Up 1.01%");
});

test("a change that rounds to zero isn't green or red", async ({ page, finnhub }) => {
  // TSLA up 0.0024%: "0.00%" is flat, but in dollars it's up a cent.
  finnhub.quotes.TSLA = { ...finnhub.quotes.TSLA, c: 250.01, d: 0.006, dp: 0.0024, pc: 250.004 };
  await openApp(page);
  const chg = page.locator('#wl .chg[data-sym="TSLA"]');
  await expect(chg).toHaveText("0.00%");
  await expect(chg).not.toHaveClass(/up|down/);
  await expect(chg).toHaveAttribute("aria-label", /^Tesla up 0\.00%, \$0\.01 today\./);
  await chg.click();
  await expect(chg).toHaveText("▲ Up $0.01");
  await expect(chg).toHaveClass(/up/);
});

test("a failed refresh keeps the last prices and says it's offline", async ({ page, finnhub }) => {
  await openApp(page);
  finnhub.down = true;
  await page.locator("#refresh").click();
  await expect(page.locator("#toast")).toHaveText("Couldn't refresh. Showing the last prices.");
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
  await expect(page.locator("#mkt")).toHaveText("Offline· prices from 10:59 AM ET");
  await expect(page.locator("#mkt")).toHaveClass(/offline/);
  finnhub.down = false;
  await page.locator("#refresh").click();
  await expect(page.locator("#mkt")).toHaveText("Market open· 10:59 AM ET");
});

test("the phone going offline and back online", async ({ page, context, finnhub }) => {
  await openApp(page);
  await context.setOffline(true);
  await expect(page.locator("#mkt")).toContainText("Offline");
  const before = finnhub.calls.filter((c) => c.path === "/quote").length;
  await context.setOffline(false);
  // Back online: refreshes right away.
  await expect(page.locator("#mkt")).toContainText("Market open");
  await expect.poll(() => finnhub.calls.filter((c) => c.path === "/quote").length).toBeGreaterThan(before);
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
