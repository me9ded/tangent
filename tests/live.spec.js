const { test, expect, openApp } = require("./fixtures");

const subs = (page) => page.evaluate(() => [...window.__fakeWS.subs].sort());

test("subscribes to the watchlist while the market is open", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
  expect(await page.evaluate(() => window.__fakeWS.open().url)).toContain("token=test-key-123");
});

test("live trades move the price, the pill and the summary", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__fakeWS.push([
    { s: "AAPL", p: 206, t: Date.now(), v: 10 },
    { s: "AAPL", p: 210, t: Date.now() + 1, v: 5 }
  ]));
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$210.00");
  // 210 vs previous close 198 → +6.06%, a new day high.
  await expect(page.locator('#wl .chg[data-sym="AAPL"]')).toHaveText("▲ 6.06%");
  await expect(page.locator("#mkt .live")).toHaveText("· Live");
  expect(await page.evaluate(() => window.__tangent.quotes.get("AAPL").h)).toBe(210);
});

test("trades for unknown or bad symbols are ignored", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => subs(page)).toContain("AAPL");
  await page.evaluate(() => window.__fakeWS.push([{ s: "ZZZZ", p: 1, t: Date.now() }, { s: "AAPL", p: -5, t: Date.now() }, { s: "AAPL", p: "x" }]));
  await page.waitForTimeout(100);
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
});

test.describe("market closed", () => {
  test("no socket, minute refresh label", async ({ page, finnhub }) => {
    finnhub.open = false;
    await openApp(page);
    await expect(page.locator("#mkt")).toContainText(/Market closed|Pre-market|After hours/);
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
