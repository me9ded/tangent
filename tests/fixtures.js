// Shared test setup: a fake Finnhub (REST + WebSocket) and a seeded phone.
// Nothing here talks to the real Finnhub.
const base = require("@playwright/test");

const KEY = "test-key-123";
const NOW_S = () => Math.floor(Date.now() / 1000);

const QUOTES = {
  AAPL: { c: 200, d: 2, dp: 1.0101, h: 205, l: 195, o: 197, pc: 198 },
  MSFT: { c: 400, d: -8, dp: -1.9608, h: 410, l: 395, o: 409, pc: 408 },
  NVDA: { c: 120, d: 6, dp: 5.2632, h: 121, l: 113, o: 114, pc: 114 },
  TSLA: { c: 250, d: -1, dp: -0.3984, h: 255, l: 248, o: 252, pc: 251 },
  "BRK.B": { c: 480, d: 1.2, dp: 0.2506, h: 482, l: 477, o: 478, pc: 478.8 }
};
const NAMES = { AAPL: "Apple", MSFT: "Microsoft", NVDA: "Nvidia", TSLA: "Tesla" };
const SEED_WATCH = ["AAPL", "MSFT", "NVDA", "TSLA"].map((sym) => ({ sym, name: NAMES[sym] }));

const SEARCH = {
  berkshire: [
    { description: "BERKSHIRE HATHAWAY INC-CL B", displaySymbol: "BRK.B", symbol: "BRK.B", type: "Common Stock" },
    { description: "BERKSHIRE HATHAWAY INC-CL A", displaySymbol: "BRK.A", symbol: "BRK.A", type: "Common Stock" },
    { description: "BERKSHIRE HATHAWAY INC-CL B", displaySymbol: "BRKB.MX", symbol: "BRKB.MX", type: "Common Stock" },
    { description: "BERKSHIRE HATHAWAY INC-CL B", displaySymbol: "BRK.B:XETRA", symbol: "BRK.B:XETRA", type: "Common Stock" }
  ],
  amd: [
    { description: "ADVANCED MICRO DEVICES", displaySymbol: "AMD", symbol: "AMD", type: "Common Stock" },
    { description: "ADVANCED MICRO DEVICES", displaySymbol: "AMD.SW", symbol: "AMD.SW", type: "Common Stock" }
  ]
};

/** Mutable fake-Finnhub state; tests flip these to change how the "server" behaves. */
function makeFinnhub() {
  return {
    open: true,
    badKey: false,
    rateLimit: false,
    down: false,
    quotes: JSON.parse(JSON.stringify(QUOTES)),
    calls: []
  };
}

async function routeFinnhub(context, fh) {
  await context.route("https://finnhub.io/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const sym = url.searchParams.get("symbol");
    fh.calls.push({ path, sym, q: url.searchParams.get("q"), exchange: url.searchParams.get("exchange"), at: Date.now() });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (fh.down) return route.abort("internetdisconnected");
    if (fh.badKey || url.searchParams.get("token") === "bad-key") return json({ error: "Invalid API key" }, 401);
    if (fh.rateLimit) return json({ error: "API limit reached" }, 429);
    switch (path) {
      case "/quote": {
        const q = fh.quotes[sym] || { c: 50, d: 0.5, dp: 1.0101, h: 51, l: 49, o: 49.5, pc: 49.5 };
        return json({ ...q, t: NOW_S() });
      }
      case "/stock/market-status":
        return json({ exchange: "US", holiday: null, isOpen: fh.open, session: fh.open ? "regular" : null, timezone: "America/New_York", t: NOW_S() });
      case "/stock/metric":
        return json({ metric: { "52WeekHigh": (fh.quotes[sym] || { c: 50 }).c * 1.3, "52WeekLow": (fh.quotes[sym] || { c: 50 }).c * 0.6 }, symbol: sym });
      case "/stock/profile2":
        return json({ name: sym, ticker: sym, logo: "" });
      case "/search": {
        const result = SEARCH[(url.searchParams.get("q") || "").toLowerCase()] || [];
        return json({ count: result.length, result });
      }
      default:
        return json({ error: "unknown endpoint " + path }, 404);
    }
  });
}

/* Runs in the page before app.js: a WebSocket stand-in the test can push trades through. */
function fakeSocketScript() {
  const hub = { instances: [], subs: new Set(), sent: [] };
  class FakeWebSocket extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      hub.instances.push(this);
      setTimeout(() => { if (this.readyState === 0) { this.readyState = 1; this.dispatchEvent(new Event("open")); } }, 5);
    }
    send(s) {
      hub.sent.push(s);
      const m = JSON.parse(s);
      if (m.type === "subscribe") hub.subs.add(m.symbol);
      if (m.type === "unsubscribe") hub.subs.delete(m.symbol);
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      hub.subs.clear();
      setTimeout(() => this.dispatchEvent(new Event("close")), 0);
    }
  }
  hub.open = () => hub.instances.filter((w) => w.readyState === 1).pop() || null;
  hub.push = (trades) => {
    const ws = hub.open();
    if (!ws) throw new Error("no open socket");
    ws.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "trade", data: trades }) }));
  };
  window.WebSocket = FakeWebSocket;
  window.__fakeWS = hub;
}

/* Seeds localStorage once per tab, so a reload keeps whatever the app saved. */
function seedScript(seed) {
  if (sessionStorage.getItem("__seeded")) return;
  sessionStorage.setItem("__seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem("tangent." + k, JSON.stringify(v));
}

const test = base.test.extend({
  // Override per test with test.use({ seed: {...} }).
  seed: [{ fhkey: KEY, watch: SEED_WATCH }, { option: true }],
  finnhub: async ({ context }, use) => {
    const fh = makeFinnhub();
    await routeFinnhub(context, fh);
    await use(fh);
  },
  page: async ({ page, seed, finnhub }, use) => {
    void finnhub;
    await page.addInitScript(fakeSocketScript);
    await page.addInitScript(seedScript, seed);
    await use(page);
  }
});

/** Open the app and wait until the watchlist shows prices. */
async function openApp(page) {
  await page.goto("./");
  await base.expect(page.locator("#wl li").first()).toBeVisible();
  await base.expect(page.locator('#wl .px[data-px="AAPL"]')).toHaveText("$200.00");
}

module.exports = { test, expect: base.expect, openApp, KEY, QUOTES, SEED_WATCH };
