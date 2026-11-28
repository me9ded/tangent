const { test, expect, openApp, pushMinutes, nyWed, TUE_CLOSE } = require("./fixtures");

/* Finnhub's quotes are still Tuesday's close, so the trades these tests push start Wednesday's
   recording from nothing (and are newer than the quote, so they move the price). */
test.beforeEach(({ finnhub }) => { finnhub.quoteT = TUE_CLOSE; });

const savedHist = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tangent.hist")));

test.describe("before the open, on a fresh install", () => {
  test.use({ now: nyWed(9, 15) });

  test("the price page starts with an honest empty chart", async ({ page, finnhub }) => {
    finnhub.open = false;
    finnhub.quoteT = nyWed(9, 10) / 1000;
    await openApp(page);
    await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
    await expect(page.locator("#pg-chart")).toHaveClass(/empty/);
    await expect(page.locator("#pg-chart")).toHaveAttribute("aria-label", "No chart yet");
    await expect(page.locator("#pg-chart-note")).toHaveText("The chart fills in while Tangent is open during market hours.");
  });
});

test("live trades draw today's chart, and scrubbing it drives the headline", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "AAPL", 12);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  const chart = page.locator("#pg-chart");
  await expect(chart).not.toHaveClass(/empty/);
  // 199 → 201.75 against Tuesday's close of 200.
  await expect(chart).toHaveClass(/up/);
  await expect(page.locator("#pg-chart-lab")).toHaveText("Today");
  await expect(chart.locator("path.ln")).toHaveAttribute("d", /^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+){11}$/);
  await expect(chart).toHaveAttribute("aria-label", "Today: 12 minutes recorded, from $199.00 at 10:00 AM to $201.75 at 10:11 AM New York time, previous close $200.00");
  await expect(page.locator("#pg-px")).toHaveText("$201.75");

  // Scrub to the left edge: snaps to the first point, and the headline shows that moment.
  await chart.hover(); // waits for the page to finish sliding in
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(page.locator("#pg-px")).toHaveText("$199.00");
  await expect(page.locator("#pg-dd")).toHaveText("▼ Down $1.00 (0.50%)");
  await expect(page.locator("#pg-when")).toHaveText("Today · 10:00 AM ET");
  await expect(chart.locator("circle.dot")).not.toHaveClass(/now/);
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(page.locator("#pg-px")).toHaveText("$201.75");
  await expect(page.locator("#pg-when")).toHaveText("Today · 10:11 AM ET");
  // Letting go goes back to the latest price.
  await page.mouse.move(box.x + box.width / 2, box.y - 40);
  await expect(page.locator("#pg-when")).toHaveText("Today · Live");
  await expect(page.locator("#pg-dd")).toHaveText("▲ Up $1.75 (0.88%)");
});

test("a gap where Tangent wasn't open is drawn dashed", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "MSFT", 3, 0, 400);
  await pushMinutes(page, "MSFT", 3, 45, 401);
  await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
  await expect(page.locator("#pg-chart path.gap")).toHaveAttribute("d", /^M.+L.+$/);
  await expect(page.locator("#pg-chart-note")).toContainText("Dashed parts");
});

test("rows show a sparkline once there's enough of today recorded", async ({ page }) => {
  await openApp(page);
  const viz = page.locator('#wl li[data-sym="NVDA"] .viz');
  await expect(viz).toBeHidden();
  await pushMinutes(page, "NVDA", 9, 0, 118);
  await expect(page.locator('#wl .px[data-px="NVDA"]')).toHaveText("$120.00");
  await expect(viz).toBeHidden();
  await pushMinutes(page, "NVDA", 1, 9, 121);
  await expect(viz).toBeVisible();
  await expect(viz.locator(".spark")).toHaveClass(/up/);
});

test("the recording survives a reload, with its close, and keeps only watched stocks", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "AAPL", 10);
  // Trades outside the session aren't recorded.
  await page.evaluate((t) => window.__fakeWS.push([{ s: "AAPL", p: 150, t }]), nyWed(8, 0));
  // A stock only looked at gets recorded too, but isn't kept.
  await page.evaluate(() => window.__tangent.openPage("AMD"));
  await expect(page.locator("#pg-px")).toHaveText("$50.00");
  await page.goBack();
  await page.reload(); // pagehide saves
  await expect(page.locator('#wl li[data-sym="AAPL"] .viz')).toBeVisible();
  const saved = await savedHist(page);
  expect(saved["2026-11-25"].pts.AAPL).toHaveLength(10);
  expect(saved["2026-11-25"].pts.AAPL.some(([, p]) => p === 150)).toBe(false);
  expect(saved["2026-11-25"].pc.AAPL).toBe(200);
  for (const d of Object.values(saved)) {
    expect(Object.keys(d.pts)).not.toContain("AMD");
    expect(Object.keys(d.pc)).not.toContain("AMD");
  }
});

test("a quote refresh anchors the chart at the open", async ({ page, finnhub }) => {
  finnhub.quoteT = nyWed(10, 30) / 1000;
  await openApp(page);
  const day = await page.evaluate(() => window.__tangent.hist["2026-11-25"]);
  expect(day.pts.AAPL).toEqual([[570, 197], [630, 200]]);
  expect(day.pc.AAPL).toBe(198);
});

test("one frame with many trades records every minute and the high in the middle", async ({ page }) => {
  await openApp(page);
  await expect.poll(() => page.evaluate(() => !!(window.__fakeWS.open() && window.__fakeWS.subs.size))).toBe(true);
  // Out of order on purpose; the 230 spike is neither first nor last.
  await page.evaluate((ts) => window.__fakeWS.push([
    { s: "AAPL", p: 201, t: ts[2] }, { s: "AAPL", p: 230, t: ts[1] }, { s: "AAPL", p: 199, t: ts[0] }
  ]), [nyWed(10, 0), nyWed(10, 1), nyWed(10, 2)]);
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$201.00");
  const q = await page.evaluate(() => window.__tangent.quotes.get("AAPL"));
  expect([q.o, q.h, q.l, q.pc]).toEqual([199, 230, 199, 200]);
  expect(await page.evaluate(() => window.__tangent.hist["2026-11-25"].pts.AAPL)).toEqual([[600, 199], [601, 230], [602, 201]]);
});
