const { test, expect, openApp, KEY } = require("./fixtures");

const tab = (page, name) => page.locator(`.tabs [data-tab="${name}"]`).click();

test.describe("without a key", () => {
  test.use({ seed: {} });

  test("shows setup, rejects a bad key, accepts a good one", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#hero")).toBeHidden();

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

  test("Settings offers to add a key, and search points to it", async ({ page }) => {
    await page.goto("./");
    await tab(page, "settings");
    await expect(page.locator("#set-key-state")).toContainText("Not connected");
    await expect(page.locator("#key-change")).toHaveText("Add key");
    await expect(page.locator("#key-remove")).toBeHidden();
    await tab(page, "search");
    await page.locator("#search-input").fill("amd");
    await expect(page.locator("#search-msg")).toHaveText("Search needs your Finnhub key.");
    await page.getByRole("button", { name: "Connect it on Home" }).click();
    await expect(page.locator("#v-home")).toBeVisible();
    await expect(page.locator("#key-input")).toBeFocused();
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
  await tab(page, "settings");
  await expect(page.locator("#set-key-state")).toContainText("stopped accepting");
});

test("change the key in Settings", async ({ page }) => {
  await openApp(page);
  await tab(page, "settings");
  await expect(page.locator("#set-key-state")).toContainText("Connected");
  await page.locator("#key-change").click();
  await expect(page.locator("#set-key-input")).toBeFocused();
  await expect(page.locator("#key-change")).toHaveText("Cancel");
  await page.locator("#set-key-input").fill("bad-key");
  await page.locator("#set-key-go").click();
  await expect(page.locator("#set-key-msg")).toContainText("didn't accept that key");
  await page.locator("#set-key-input").fill("another-good-key");
  await page.locator("#set-key-go").click();
  await expect(page.locator("#toast")).toHaveText("Live prices connected");
  await expect(page.locator("#set-key-form")).toBeHidden();
  await expect(page.locator("#key-change")).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tangent.fhkey")))).toBe("another-good-key");
});

test("remove key needs two taps", async ({ page }) => {
  await openApp(page);
  await tab(page, "settings");
  const rm = page.locator("#key-remove");
  await rm.click();
  await expect(rm).toHaveText("Tap again to remove");
  await rm.click();
  await expect(page.locator("#toast")).toHaveText("Key removed from this phone");
  await expect(page.locator("#set-key-state")).toContainText("Not connected");
  await tab(page, "home");
  await expect(page.locator("#setup")).toBeVisible();
});
