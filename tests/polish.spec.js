const { test, expect, openApp } = require("./fixtures");

const symbols = (page) => page.locator("#wl .wl-id b").allTextContents();
const savedOrder = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tangent.watch")).map((w) => w.sym));
const subs = (page) => page.evaluate(() => [...window.__fakeWS.subs]);
const quoteCalls = (finnhub) => finnhub.calls.filter((c) => c.path === "/quote").length;

/* Drags the mouse horizontally across a row, in steps like a finger. Hovering first waits until the
   row has stopped sliding (rows animate into a new order). */
async function swipe(page, li, dx) {
  await li.hover();
  const b = await li.boundingBox();
  const x = b.x + b.width - 40, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
  await page.mouse.up();
}

test("search finds share classes like BRK.B but not foreign listings", async ({ page, finnhub }) => {
  await openApp(page);
  await page.locator("#add").click();
  await page.locator("#search-input").fill("berkshire");
  await expect(page.locator("#search-results li b")).toHaveText(["BRK.B", "BRK.A"]);
  await expect(page.locator("#search-msg")).toHaveText("2 results");
  expect(finnhub.calls.find((c) => c.path === "/search").exchange).toBe("US");

  await page.locator('#search-results li[data-sym="BRK.B"] .res-add').click();
  await page.locator('.tabs [data-tab="home"]').click();
  await expect(page.locator('#wl .px[data-px="BRK.B"]')).toHaveText("$480.00");
  await expect(page.locator('#wl li[data-sym="BRK.B"]')).toContainText("Berkshire Hathaway");
  // Dotted symbols work everywhere a selector is built from them, live ticks included.
  await expect.poll(() => subs(page)).toContain("BRK.B");
  await page.evaluate(() => window.__fakeWS.push([{ s: "BRK.B", p: 481.5, t: Date.now() }]));
  await expect(page.locator('#wl .px[data-px="BRK.B"]')).toHaveText("$481.50");
});

test("a search with no US listing says so", async ({ page }) => {
  await openApp(page);
  await page.locator('.tabs [data-tab="search"]').click();
  await page.locator("#search-input").fill("zzqx");
  await expect(page.locator("#search-msg")).toHaveText("No US-listed stocks match that. Try the ticker.");
  await expect(page.locator("#search-results li")).toHaveCount(0);
});

test("a refresh repaints rows instead of rebuilding them", async ({ page, finnhub }) => {
  await openApp(page);
  await page.evaluate(() => { window.__row = document.querySelector('#wl li[data-sym="AAPL"]'); });
  finnhub.quotes.AAPL = { ...finnhub.quotes.AAPL, c: 199, d: 1, dp: 0.5051 };
  await page.locator("#refresh").click();
  await expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$199.00");
  expect(await page.evaluate(() => window.__row === document.querySelector('#wl li[data-sym="AAPL"]'))).toBe(true);
});

test("Moves order waits while a finger is on the list, so a tap opens what was under it", async ({ page }) => {
  await openApp(page);
  expect(await symbols(page)).toEqual(["NVDA", "AAPL", "TSLA", "MSFT"]);
  await expect.poll(() => subs(page)).toContain("MSFT");
  const b = await page.locator('#wl li[data-sym="AAPL"] .wl-id').boundingBox();
  await page.mouse.move(b.x + 10, b.y + b.height / 2);
  await page.mouse.down();
  // MSFT jumps to the top of the day's moves (+7.84%) while the finger is down.
  await page.evaluate(() => window.__fakeWS.push([{ s: "MSFT", p: 440, t: Date.now() }]));
  await expect(page.locator('#wl .px[data-px="MSFT"]')).toHaveText("$440.00");
  await expect(page.locator("#hero-val")).not.toHaveText("▲ Up 0.98%");
  expect(await symbols(page)).toEqual(["NVDA", "AAPL", "TSLA", "MSFT"]);
  await page.mouse.up();
  await expect(page.locator("#pg-title")).toHaveText("AAPL");
  await page.goBack();
  // Shortly after the finger lifts, the rows slide into the new order.
  await expect.poll(() => symbols(page)).toEqual(["MSFT", "NVDA", "AAPL", "TSLA"]);
});

test.describe("swipe to remove", () => {
  test("a long swipe left removes the stock, and Undo puts it back in its place", async ({ page }) => {
    await openApp(page);
    await page.locator('#sort [data-sort="mine"]').click();
    const li = page.locator('#wl li[data-sym="MSFT"]');
    await swipe(page, li, -280);
    await expect(page.locator("#toast-msg")).toHaveText("MSFT removed");
    await expect(li).toHaveCount(0);
    // The swipe didn't also open the stock.
    await expect(page.locator("#page")).toBeHidden();
    expect(await savedOrder(page)).toEqual(["AAPL", "NVDA", "TSLA"]);
    await page.locator("#toast-act").click();
    await expect(li).toHaveCount(1);
    expect(await symbols(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
    expect(await savedOrder(page)).toEqual(["AAPL", "MSFT", "NVDA", "TSLA"]);
  });

  test("a short swipe reveals Remove; a tap on the row closes it again", async ({ page }) => {
    await openApp(page);
    const li = page.locator('#wl li[data-sym="TSLA"]');
    await swipe(page, li, -80);
    await expect(li).toHaveClass(/open/);
    await page.waitForTimeout(400);
    await li.locator(".wl-row").click();
    await expect(li).not.toHaveClass(/open/);
    await expect(page.locator("#page")).toBeHidden();

    await swipe(page, li, -80);
    await expect(li).toHaveClass(/open/);
    // Only the right edge of Remove shows from under the row; tap there, like a finger would.
    const del = await li.locator(".wl-del").boundingBox();
    await li.locator(".wl-del").click({ position: { x: del.width - 40, y: del.height / 2 } });
    await expect(page.locator("#toast-msg")).toHaveText("TSLA removed");
    await expect(li).toHaveCount(0);
  });

  test("a swipe right or a vertical drag doesn't open a row", async ({ page }) => {
    await openApp(page);
    const li = page.locator('#wl li[data-sym="AAPL"]');
    await swipe(page, li, 80);
    await expect(li).not.toHaveClass(/open/);
    await li.hover();
    const r = await li.boundingBox();
    await page.mouse.move(r.x + r.width - 40, r.y + 10);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(r.x + r.width - 40 - i * 4, r.y + 10 + i * 12);
    await page.mouse.up();
    await expect(li).not.toHaveClass(/open/);
    await expect(li.locator(".wl-main")).not.toHaveAttribute("style", /translateX/);
  });
});

test("pull down on Home to refresh", async ({ page, finnhub, browserName }) => {
  test.skip(browserName !== "chromium", "touch drags need Chromium's DevTools protocol");
  await openApp(page);
  const before = quoteCalls(finnhub);
  const cdp = await page.context().newCDPSession(page);
  const b = await page.locator("#hero").boundingBox();
  const x = b.x + 40, y = b.y + 10;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 16 }] });
  await expect(page.locator("#ptr")).toHaveClass(/on/);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => quoteCalls(finnhub)).toBeGreaterThan(before);
  await expect(page.locator("#ptr")).not.toHaveClass(/on/);

  // A short pull springs back without refreshing.
  const after = quoteCalls(finnhub);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 4; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 12 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("#ptr")).not.toHaveClass(/on/);
  await page.waitForTimeout(300);
  expect(quoteCalls(finnhub)).toBe(after);
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
    // The rows slide into the new order first.
    await page.locator('#wl li[data-sym="AAPL"] .wl-grip').hover();
    await page.locator('#wl li[data-sym="NVDA"]').hover();
    const grip = await page.locator('#wl li[data-sym="AAPL"] .wl-grip').boundingBox();
    const target = await page.locator('#wl li[data-sym="NVDA"]').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + ((target.y + target.height * 0.75 - grip.y) * i) / 8);
    await page.mouse.up();
    expect(await symbols(page)).toEqual(["MSFT", "NVDA", "AAPL", "TSLA"]);
    expect(await savedOrder(page)).toEqual(["MSFT", "NVDA", "AAPL", "TSLA"]);
    // Dragging neither opened the price page nor swiped the row.
    await expect(page.locator("#page")).toBeHidden();
    await expect(page.locator("#wl li.open")).toHaveCount(0);
  });
});

test("removing a stock from its page can be undone, back in its place", async ({ page }) => {
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
