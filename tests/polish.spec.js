const { test, expect, openApp } = require("./fixtures");

const symbols = (page) => page.locator("#wl .wl-id b").allTextContents();
const savedOrder = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tangent.watch")).map((w) => w.sym));

test("search finds share classes like BRK.B but not foreign listings", async ({ page, finnhub }) => {
  await openApp(page);
  await page.locator("#add").click();
  await page.locator("#add-input").fill("berkshire");
  const results = page.locator("#add-results button b");
  await expect(results).toHaveText(["BRK.B", "BRK.A"]);
  expect(finnhub.calls.find((c) => c.path === "/search").exchange).toBe("US");

  await page.locator("#add-results button", { hasText: "BRK.B" }).click();
  await expect(page.locator('#wl .px[data-px="BRK.B"]')).toHaveText("$480.00");
  await expect(page.locator("#wl li", { hasText: "BRK.B" })).toContainText("Berkshire Hathaway");
  // Dotted symbols work everywhere a selector is built from them, live ticks included.
  await expect.poll(() => page.evaluate(() => [...window.__fakeWS.subs])).toContain("BRK.B");
  await page.evaluate(() => window.__fakeWS.push([{ s: "BRK.B", p: 481.5, t: Date.now() }]));
  await expect(page.locator('#wl .px[data-px="BRK.B"]')).toHaveText("$481.50");
});

test("a refresh repaints rows instead of rebuilding them", async ({ page, finnhub }) => {
  await openApp(page);
  await page.evaluate(() => { window.__row = document.querySelector('#wl li[data-sym="AAPL"]'); });
  finnhub.quotes.AAPL = { ...finnhub.quotes.AAPL, c: 199, d: 1, dp: 0.5051 };
  await page.locator("#refresh").click();
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$199.00");
  expect(await page.evaluate(() => window.__row === document.querySelector('#wl li[data-sym="AAPL"]'))).toBe(true);
});

test.describe("reordering", () => {
  test("grips only show in Mine sort", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#wl .wl-grip").first()).toBeHidden();
    await page.locator('#sort [data-sort="mine"]').click();
    await expect(page.locator("#wl .wl-grip")).toHaveCount(4);
    await expect(page.locator("#wl .wl-grip").first()).toBeVisible();
    await expect(page.locator("#toast")).toContainText("Drag the handle");
  });

  test("arrow keys on a grip move the stock and keep focus", async ({ page }) => {
    await openApp(page);
    await page.locator('#sort [data-sort="mine"]').click();
    const grip = page.locator('#wl li[data-sym="NVDA"] .wl-grip');
    await grip.focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await symbols(page)).toEqual(["NVDA", "AAPL", "MSFT", "TSLA"]);
    await expect(grip).toBeFocused();
    await expect(page.locator("#toast-msg")).toHaveText("NVDA moved to 1 of 4");
    await page.keyboard.press("ArrowUp"); // already first: nothing happens
    expect(await savedOrder(page)).toEqual(["NVDA", "AAPL", "MSFT", "TSLA"]);
    await page.reload();
    expect(await symbols(page)).toEqual(["NVDA", "AAPL", "MSFT", "TSLA"]);
  });

  test("dragging a grip moves the stock", async ({ page }) => {
    await openApp(page);
    await page.locator('#sort [data-sort="mine"]').click();
    const grip = await page.locator('#wl li[data-sym="AAPL"] .wl-grip').boundingBox();
    const target = await page.locator('#wl li[data-sym="NVDA"]').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + ((target.y + target.height * 0.75 - grip.y) * i) / 8);
    await page.mouse.up();
    expect(await symbols(page)).toEqual(["MSFT", "NVDA", "AAPL", "TSLA"]);
    expect(await savedOrder(page)).toEqual(["MSFT", "NVDA", "AAPL", "TSLA"]);
    // Dragging didn't open the price page.
    await expect(page.locator("#page")).toBeHidden();
  });
});

test("removing a stock can be undone, back in its place", async ({ page }) => {
  await openApp(page);
  await page.locator('#sort [data-sort="mine"]').click();
  await page.locator("#wl .wl-row", { hasText: "MSFT" }).click();
  await page.locator("#pg-watch").click();
  await page.locator("#pg-watch").click();
  await expect(page.locator("#pg-watch")).toHaveText("Watch");
  await expect(page.locator("#toast-msg")).toHaveText("MSFT removed");
  await page.locator("#toast-act").click();
  await expect(page.locator("#pg-watch")).toHaveText("Watching");
  await expect(page.locator("#toast")).toBeHidden();
  await page.goBack();
  expect(await symbols(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
});
