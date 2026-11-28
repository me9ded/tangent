/* Live trades over Finnhub's WebSocket, while the US market is open and Tangent is on screen. */
import { esc, usd, reduced } from "./util.js";
import { S, quotes, getKey } from "./state.js";
import { regular, saveQuotes } from "./market.js";
import { record } from "./history.js";
import { paintViz } from "./chart.js";
import { paintPill, paintRange } from "./ui/bits.js";
import { paintStatus } from "./ui/status.js";
import { renderSummary } from "./ui/list.js";
import { paintPageNumbers } from "./ui/stock.js";

const FH_WS = "wss://ws.finnhub.io";
export const live = { ws: null, open: false, subs: new Set(), retry: 0, timer: 0, lastTick: 0 };
const liveWanted = () => !!getKey() && !S.keyBroken && !document.hidden && regular() && S.watch.length > 0;

export function liveSync() {
  if (!liveWanted()) { liveClose(); return; }
  if (!live.ws) liveOpen();
  else if (live.open) liveSubscribe();
}
function liveOpen() {
  clearTimeout(live.timer);
  let ws;
  try { ws = new WebSocket(FH_WS + "?token=" + encodeURIComponent(getKey())); }
  catch (e) { liveRetry(); return; }
  live.ws = ws;
  live.open = false;
  live.subs = new Set();
  ws.addEventListener("open", () => { if (live.ws !== ws) return; live.open = true; live.retry = 0; liveSubscribe(); paintStatus(); });
  ws.addEventListener("message", (ev) => {
    if (live.ws !== ws) return;
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m && m.type === "trade" && Array.isArray(m.data)) onTrades(m.data);
  });
  ws.addEventListener("close", () => {
    if (live.ws !== ws) return;
    live.ws = null;
    live.open = false;
    paintStatus();
    if (liveWanted()) liveRetry();
  });
  ws.addEventListener("error", () => { try { ws.close(1000); } catch (e) {} });
}
export function liveClose() {
  clearTimeout(live.timer);
  if (!live.ws) return;
  const ws = live.ws;
  live.ws = null;
  live.open = false;
  try { ws.close(1000); } catch (e) {}
  paintStatus();
}
function liveRetry() {
  clearTimeout(live.timer);
  live.retry = Math.min(live.retry + 1, 6);
  live.timer = setTimeout(liveSync, Math.min(60000, 1500 * 2 ** live.retry));
}
function liveSend(o) { try { if (live.ws && live.open) live.ws.send(JSON.stringify(o)); } catch (e) {} }
function liveSubscribe() {
  const want = new Set(S.watch.map((w) => w.sym));
  if (S.pageSym) want.add(S.pageSym);
  for (const s of want) if (!live.subs.has(s)) { liveSend({ type: "subscribe", symbol: s }); live.subs.add(s); }
  for (const s of [...live.subs]) if (!want.has(s)) { liveSend({ type: "unsubscribe", symbol: s }); live.subs.delete(s); }
}
export const isLive = () => live.open && Date.now() - live.lastTick < 90000;

const ticks = new Map();
let tickRaf = 0, lastSave = 0, lastSummary = 0;
function onTrades(list) {
  const latest = new Map();
  const now = Date.now();
  // Every trade counts for the day's high and low and for the chart; the newest one sets the price.
  for (const t of list.filter((t) => t && typeof t.s === "string" && Number.isFinite(t.p) && t.p > 0).sort((a, b) => (a.t || 0) - (b.t || 0))) {
    const q = quotes.get(t.s);
    if (!q || !(q.pc > 0)) continue;
    q.h = Math.max(q.h || t.p, t.p);
    q.l = q.l > 0 ? Math.min(q.l, t.p) : t.p;
    record(t.s, t.t || now, t.p);
    latest.set(t.s, t);
  }
  for (const [s, t] of latest) {
    const q = quotes.get(s);
    const before = q.c;
    q.c = t.p;
    q.d = t.p - q.pc;
    q.dp = (q.d / q.pc) * 100;
    if (t.t) q.t = Math.floor(t.t / 1000);
    const dir = t.p > before ? 1 : t.p < before ? -1 : 0;
    if (dir || !ticks.has(s)) ticks.set(s, dir);
  }
  if (!latest.size) return;
  live.lastTick = Date.now();
  if (!tickRaf) tickRaf = requestAnimationFrame(paintTicks);
}
function paintTicks() {
  tickRaf = 0;
  const now = Date.now();
  for (const [s, dir] of ticks) {
    const q = quotes.get(s);
    if (!q) continue;
    document.querySelectorAll('.px[data-px="' + esc(s) + '"]').forEach((n) => {
      n.textContent = usd(q.c);
      if (dir && !reduced) {
        n.classList.remove("tick-up", "tick-down");
        void n.offsetWidth;
        n.classList.add(dir > 0 ? "tick-up" : "tick-down");
        clearTimeout(n._t);
        n._t = setTimeout(() => n.classList.remove("tick-up", "tick-down"), 220);
      }
    });
    document.querySelectorAll('.chg[data-sym="' + esc(s) + '"]').forEach(paintPill);
    document.querySelectorAll('.rng[data-sym="' + esc(s) + '"]').forEach(paintRange);
    document.querySelectorAll('.viz[data-sym="' + esc(s) + '"]').forEach(paintViz);
  }
  ticks.clear();
  if (S.pageSym) paintPageNumbers();
  if (now - lastSummary > 2000) { lastSummary = now; renderSummary(); }
  if (now - lastSave > 10000) { lastSave = now; S.quotesAt = now; saveQuotes(); }
  paintStatus();
}
