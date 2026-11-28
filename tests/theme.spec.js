const { test, expect, openApp, nyWed } = require("./fixtures");

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const lightness = (c) => { const m = c.match(/oklch\(([\d.]+)/); return m ? Number(m[1]) : null; };
const metas = (page) => page.locator('meta[name="theme-color"]').evaluateAll((ms) => ms.map((m) => m.content));

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

test("Settings can override the phone's appearance, and it sticks", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openApp(page);
  await page.locator('.tabs [data-tab="settings"]').click();
  await expect(page.locator('#theme input[value="system"]')).toBeChecked();
  await page.locator('#theme label', { hasText: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(lightness(await bg(page))).toBeLessThan(0.2);
  expect(await metas(page)).toEqual(["#101012", "#101012"]);

  // Dark from the first frame after a reload (set before the page draws).
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(lightness(await bg(page))).toBeLessThan(0.2);
  await page.locator('.tabs [data-tab="settings"]').click();
  await expect(page.locator('#theme input[value="dark"]')).toBeChecked();

  // Back to following the phone.
  await page.locator('#theme label', { hasText: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(lightness(await bg(page))).toBeGreaterThan(0.95);
  expect(await metas(page)).toEqual(["#fbf9f6", "#101012"]);
});

test("Light in Settings wins over a dark phone", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("tangent.theme", JSON.stringify("light")));
  await openApp(page);
  expect(lightness(await bg(page))).toBeGreaterThan(0.95);
  expect(await metas(page)).toEqual(["#fbf9f6", "#fbf9f6"]);
});

/* Not assertions: pictures for a person to look at.
   SHOTS=/some/folder npx playwright test theme --grep shots
   Playwright's WebKit screenshots inject a style element, so this one test runs without the CSP. */
test.describe("shots", () => {
  test.use({ bypassCSP: true });

  test("shots", async ({ page }, info) => {
    test.skip(!process.env.SHOTS, "set SHOTS to a folder to save screenshots");
    const shot = (scheme, name) => page.screenshot({ path: `${process.env.SHOTS}/${info.project.name}-${scheme}-${name}.png`, caret: "initial" });
    for (const scheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("./");
      await expect(page.locator("#wl li").first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => !!(window.__fakeWS.open() && window.__fakeWS.subs.size))).toBe(true);
      for (const [sym, base, slope] of [["AAPL", 197, 0.04], ["MSFT", 409, -0.13], ["NVDA", 114, 0.09], ["TSLA", 252, -0.02]]) {
        const trades = [];
        for (let i = 0; i < 60; i++) trades.push({ s: sym, p: base + slope * i + Math.sin(i / 4) * base * 0.002, t: nyWed(9, 30 + i) });
        for (let i = 0; i < 25; i++) trades.push({ s: sym, p: base + slope * (85 + i) + Math.cos(i / 3) * base * 0.002, t: nyWed(10, 35 + i) });
        await page.evaluate((t) => window.__fakeWS.push(t), trades);
      }
      await page.waitForTimeout(2300);
      await shot(scheme, "home");
      await page.locator("#v-home").evaluate((v) => v.scrollTo(0, 400));
      await shot(scheme, "home2");
      await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
      await expect(page.locator("#page")).toBeVisible();
      await page.waitForTimeout(400);
      const c = await page.locator("#pg-chart").boundingBox();
      await page.mouse.move(c.x + c.width * 0.3, c.y + 40);
      await page.waitForTimeout(150);
      await shot(scheme, "page");
      await page.goBack();
      await expect(page.locator("#page")).toBeHidden();
      await page.locator('.tabs [data-tab="search"]').click();
      await page.locator("#search-input").fill("berkshire");
      await expect(page.locator("#search-results li")).toHaveCount(2);
      await shot(scheme, "search");
      await page.locator('.tabs [data-tab="settings"]').click();
      await shot(scheme, "settings");
      await page.locator('.tabs [data-tab="home"]').click();
    }
  });
});
