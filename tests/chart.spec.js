const { test, expect, openApp, nyWed } = require("./fixtures");

/* One trade a minute for AAPL from 10:00, rising from 199 by 0.25 a minute. */
async function pushMinutes(page, sym, count, startMin = 0, from = 199) {
  const trades = [];
  for (let i = 0; i < count; i++) trades.push({ s: sym, p: from + i * 0.25, t: nyWed(10, startMin + i) });
  await expect.poll(() => page.evaluate(() => !!(window.__fakeWS.open() && window.__fakeWS.subs.size))).toBe(true);
  // Separate frames, like the real stream.
  for (const t of trades) await page.evaluate((t) => window.__fakeWS.push([t]), t);
}

test("the price page starts with an honest empty chart", async ({ page }) => {
  await openApp(page);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  await expect(page.locator("#pg-chart")).toHaveClass(/empty/);
  await expect(page.locator("#pg-chart-note")).toContainText("fills in while Tangent is open");
});

test("live trades draw today's chart, with a readout while scrubbing", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "AAPL", 12);
  await page.locator("#wl .wl-row", { hasText: "AAPL" }).click();
  const chart = page.locator("#pg-chart");
  await expect(chart).not.toHaveClass(/empty/);
  await expect(chart).toHaveClass(/up/);
  await expect(page.locator("#pg-chart-lab")).toHaveText("Wed, Nov 25");
  await expect(chart.locator("path.ln")).toHaveAttribute("d", /^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+){11}$/);
  await expect(chart).toHaveAttribute("aria-label", /12 minutes recorded, from \$199\.00 at 10:00 AM to \$201\.75 at 10:11 AM/);

  // Scrub to the left edge: snaps to the first point.
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(page.locator("#pg-chart-read")).toHaveText("10:00 AM · $199.00");
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(page.locator("#pg-chart-read")).toHaveText("10:11 AM · $201.75");
  await page.mouse.move(box.x + box.width / 2, box.y - 40);
  await expect(page.locator("#pg-chart-read")).toHaveText("");
});

test("a gap where Tangent wasn't open is drawn dashed", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "MSFT", 3, 0, 400);
  await pushMinutes(page, "MSFT", 3, 60, 401);
  await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
  await expect(page.locator("#pg-chart path.gap")).toHaveAttribute("d", /^M.+L.+$/);
  await expect(page.locator("#pg-chart-note")).toContainText("Dashed parts");
});

test("rows switch from the range bar to a sparkline once there's enough data", async ({ page }) => {
  await openApp(page);
  const row = page.locator('#wl li[data-sym="NVDA"]');
  await expect(row.locator(".rng")).toBeVisible();
  await expect(row.locator(".spark")).toBeHidden();
  await pushMinutes(page, "NVDA", 9, 0, 118);
  await expect(row.locator(".spark")).toBeHidden();
  await pushMinutes(page, "NVDA", 1, 9, 121);
  await expect(row.locator(".spark")).toBeVisible();
  await expect(row.locator(".rng")).toBeHidden();
  await expect(row.locator(".spark")).toHaveClass(/up/);
});

test("the recording survives a reload and keeps only watched stocks", async ({ page }) => {
  await openApp(page);
  await pushMinutes(page, "AAPL", 10);
  // Trades outside the session are ignored.
  await page.evaluate((t) => window.__fakeWS.push([{ s: "AAPL", p: 150, t }]), nyWed(8, 0));
  await page.reload(); // pagehide saves
  await expect(page.locator('#wl li[data-sym="AAPL"] .spark')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tangent.hist")));
  expect(Object.keys(saved)).toContain("2026-11-25");
  expect(saved["2026-11-25"].AAPL.length).toBe(10);
  expect(saved["2026-11-25"].AAPL.some(([, p]) => p === 150)).toBe(false);
});

test("a quote refresh anchors the chart at the open", async ({ page, finnhub }) => {
  finnhub.quoteT = nyWed(11, 30) / 1000;
  await openApp(page);
  const pts = await page.evaluate(() => window.__tangent.hist["2026-11-25"].AAPL);
  expect(pts).toEqual([[570, 197], [690, 200]]);
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
  expect(q.h).toBe(230);
  expect(await page.evaluate(() => window.__tangent.hist["2026-11-25"].AAPL)).toEqual([[600, 199], [601, 230], [602, 201]]);
});
