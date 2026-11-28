const { test, expect, openApp } = require("./fixtures");

test.use({ serviceWorkers: "allow" });
// Playwright can only route requests through a service worker in Chromium.
test.skip(({ browserName }) => browserName !== "chromium", "service worker routing is Chromium-only in Playwright");

test("works offline once the service worker has the app", async ({ page, context }) => {
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait until this page is controlled, so the reload goes through the worker.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#home-h")).toHaveText("Tangent");
  await expect(page.locator("#mkt")).toContainText("Offline");
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
  await context.setOffline(false);
});

test("a new version waits for Reload, then takes over", async ({ page, context }) => {
  // Playwright only routes the first registration fetch, so the installed worker is a doctored
  // "old version" and update() then finds the real sw.js on disk, which differs.
  await context.route("**/sw.js", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + "\n// old version\n" });
  });
  await openApp(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 10000 }).toBe(true);
  await expect(page.locator("#toast")).toBeHidden();

  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await expect(page.locator("#toast-msg")).toHaveText("A new version of Tangent is ready", { timeout: 10000 });
  // An ordinary toast doesn't lose the offer.
  await page.locator('.tabs [data-tab="settings"]').click();
  await page.locator("#key-remove").click();
  await page.locator("#key-remove").click();
  await expect(page.locator("#toast-msg")).toHaveText("Key removed from this phone");
  await expect(page.locator("#toast-msg")).toHaveText("A new version of Tangent is ready", { timeout: 5000 });

  const reloaded = page.waitForEvent("load");
  await page.locator("#toast-act").click();
  await reloaded;
  await expect(page.locator("#home-h")).toHaveText("Tangent");
  expect(await page.evaluate(async () => !(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
});
