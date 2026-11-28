const { test, expect, openApp, TUE_CLOSE } = require("./fixtures");

const subs = (page) => page.evaluate(() => [...window.__fakeWS.subs].sort());

test("subscribes to the watchlist while the market is open", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
  expect(await page.evaluate(() => window.__fakeWS.open().url)).toContain("token=test-key-123");
});

test("live trades move the price, the change and your list", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__fakeWS.push([
    { s: "AAPL", p: 206, t: Date.now(), v: 10 },
    { s: "AAPL", p: 210, t: Date.now() + 1, v: 5 }
  ]));
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$210.00");
  // 210 vs previous close 198 → +6.06%, a new day high.
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ Up 6.06%");
  await expect(page.locator("#mkt .live")).toHaveText("· Live");
  expect(await page.evaluate(() => window.__tangent.quotes.get("AAPL").h)).toBe(210);
  // Your list catches up within a couple of seconds, even with no more trades.
  await expect(page.locator("#hero-val")).toHaveText("▲ Up 2.24%");
});

test("the first trade of a session is measured against the last close", async ({ page, finnhub }) => {
  // Quotes still from Tuesday's close (Finnhub hasn't caught up yet) when Wednesday's trading starts.
  finnhub.quoteT = TUE_CLOSE;
  await openApp(page);
  await expect(page.locator("#hero-lab")).toHaveText("Your list on Tue");
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__fakeWS.push([{ s: "AAPL", p: 204, t: Date.now() }]));
  // Against Tuesday's close of 200, not Monday's 198.
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ Up 2.00%");
  await expect(page.locator("#hero-lab")).toHaveText("Your list today");
  // The rows still on Tuesday's numbers say so.
  await expect(page.locator('#wl .chg[data-sym="MSFT"] .tag')).toHaveText("Tue");
  await expect(page.locator('#wl .chg[data-sym="AAPL"] .tag')).toHaveCount(0);
});

test("trades for unknown or bad symbols are ignored", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__fakeWS.push([{ s: "ZZZZ", p: 1, t: Date.now() }, { s: "AAPL", p: -5, t: Date.now() }, { s: "AAPL", p: "x" }]));
  await page.waitForTimeout(100);
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
});

test.describe("market closed", () => {
  test("no socket", async ({ page, finnhub }) => {
    finnhub.open = false;
    await openApp(page);
    await expect(page.locator("#mkt")).toContainText("Market closed");
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__fakeWS.instances.length)).toBe(0);
  });
});

test("the price page subscribes to a stock not on the list", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__tangent.openPage("AMD"));
  await expect.poll(() => subs(page)).toContain("AMD");
  await page.goBack();
  await expect.poll(() => subs(page)).not.toContain("AMD");
});

test("stays within Finnhub's rate limit", async ({ page, finnhub }) => {
  await openApp(page);
  for (let i = 0; i < 3; i++) await page.locator("#refresh").click();
  await page.waitForTimeout(1500);
  const lastMinute = finnhub.calls.filter((c) => Date.now() - c.at < 60000);
  expect(lastMinute.length).toBeLessThan(50);
});
