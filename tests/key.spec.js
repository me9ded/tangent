const { test, expect, openApp, KEY } = require("./fixtures");

test.describe("without a key", () => {
  test.use({ seed: {} });

  test("shows setup, rejects a bad key, accepts a good one", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#sum")).toBeHidden();

    await page.locator("#key-input").fill("bad-key");
    await page.locator("#key-go").click();
    await expect(page.locator("#key-msg")).toContainText("didn't accept that key");
    expect(await page.evaluate(() => localStorage.getItem("tangent.fhkey"))).toBeNull();

    await page.locator("#key-input").fill("  " + KEY + "  ");
    await page.locator("#key-go").click();
    await expect(page.locator("#toast")).toHaveText("Live prices connected");
    await expect(page.locator("#setup")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tangent.fhkey")))).toBe(KEY);
    // The default list loads once a key is in.
    await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
  });
});

test("a key Finnhub stops accepting brings setup back", async ({ page, finnhub }) => {
  await openApp(page);
  finnhub.badKey = true;
  await page.locator("#refresh").click();
  await expect(page.locator("#key-broken")).toBeVisible();
  await expect(page.locator("#setup")).toBeVisible();
  // Old prices stay on screen.
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
});

test("remove key needs two taps", async ({ page }) => {
  await openApp(page);
  const rm = page.locator("#key-remove");
  await rm.click();
  await expect(rm).toHaveText("Tap again to remove");
  await rm.click();
  await expect(page.locator("#toast")).toHaveText("Key removed from this phone");
  await expect(page.locator("#setup")).toBeVisible();
});
