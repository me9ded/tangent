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
  await expect(page.locator("h1")).toHaveText("Tangent");
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
  await context.setOffline(false);
});
