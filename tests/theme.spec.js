const { test, expect, openApp, nyWed } = require("./fixtures");

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const lightness = (c) => { const m = c.match(/oklch\(([\d.]+)/); return m ? Number(m[1]) : null; };

for (const scheme of ["dark", "light"]) {
  test(`follows the phone's ${scheme} appearance`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openApp(page);
    const L = lightness(await bg(page));
    if (scheme === "dark") expect(L).toBeLessThan(0.2);
    else expect(L).toBeGreaterThan(0.95);
    // Text is the opposite end, and up/down keep their meaning.
    const ink = lightness(await page.evaluate(() => getComputedStyle(document.querySelector(".wl-id b")).color));
    expect(Math.abs(ink - L)).toBeGreaterThan(0.75);
    await expect(page.locator('#wl .chg[data-sym="NVDA"]')).toHaveClass(/up/);
  });
}

// Not assertions: pictures for a person to look at (npx playwright test theme --grep shots).
test("shots", async ({ page }, info) => {
  test.skip(!process.env.SHOTS, "set SHOTS=1 to save screenshots");
  for (const scheme of ["dark", "light"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    await expect(page.locator("#wl li").first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!(window.__fakeWS.open() && window.__fakeWS.subs.size))).toBe(true);
    for (const [sym, base, slope] of [["AAPL", 197, 0.08], ["MSFT", 409, -0.25], ["NVDA", 114, 0.18], ["TSLA", 252, -0.04]]) {
      const trades = [];
      for (let i = 0; i < 90; i++) trades.push({ s: sym, p: base + slope * i + Math.sin(i / 4) * base * 0.002, t: nyWed(9, 30 + i) });
      for (let i = 0; i < 40; i++) trades.push({ s: sym, p: base + slope * (130 + i) + Math.cos(i / 3) * base * 0.002, t: nyWed(11, 40 + i) });
      await page.evaluate((t) => window.__fakeWS.push(t), trades);
    }
    await page.locator('#sort [data-sort="mine"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${process.env.SHOTS}/${info.project.name}-${scheme}-list.png` });
    await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
    const c = await page.locator("#pg-chart").boundingBox();
    await page.mouse.move(c.x + c.width * 0.3, c.y + 40);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${process.env.SHOTS}/${info.project.name}-${scheme}-page.png` });
    await page.goBack();
  }
});
