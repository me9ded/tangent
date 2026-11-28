/* Today's chart, recorded on this phone.
   Finnhub's free plan has no intraday candles, so Tangent keeps its own: the last price in each
   minute of the regular session (9:30 to 4:00 New York time), from live trades and quote refreshes.
   Only the two most recent trading days are kept. */
import { store, asArr, asObj } from "./util.js";
import { OPEN_MIN, CLOSE_MIN, nyParts } from "./time.js";
import { watchOf } from "./state.js";

const KEEP_DAYS = 2;

/* ---------- pure: everything takes the history object, so the unit tests can drive it ---------- */

/** Clean up stored history: { "YYYY-MM-DD": { SYM: [[minute, price], ...] } }. */
export function parseHist(raw) {
  const out = {};
  for (const [day, syms] of Object.entries(asObj(raw))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const d = {};
    for (const [s, pts] of Object.entries(asObj(syms))) {
      const ok = asArr(pts).filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= OPEN_MIN && x[0] <= CLOSE_MIN && x[1] > 0);
      if (ok.length) d[s] = ok;
    }
    out[day] = d;
  }
  return out;
}
/** Put a price at a minute (replacing that minute's price unless keepExisting). Returns true if anything changed. */
export function recordAt(h, sym, day, min, price, keepExisting) {
  const d = h[day] || (h[day] = {});
  const pts = d[sym] || (d[sym] = []);
  const p = Math.round(price * 1e4) / 1e4;
  let i = pts.length - 1;
  while (i >= 0 && pts[i][0] > min) i--;
  if (i >= 0 && pts[i][0] === min) { if (keepExisting || pts[i][1] === p) return false; pts[i][1] = p; }
  else pts.splice(i + 1, 0, [min, p]);
  for (const old of Object.keys(h).sort().slice(0, -KEEP_DAYS)) delete h[old];
  return true;
}
/** Record a trade or price at a timestamp; ignored outside the regular session. */
export function recordIn(h, sym, ms, price) {
  if (!(price > 0) || !Number.isFinite(ms)) return false;
  const { day, wd, min } = nyParts(ms);
  if (wd === "Sat" || wd === "Sun" || min < OPEN_MIN || min > CLOSE_MIN) return false;
  return recordAt(h, sym, day, min, price);
}
/** A quote gives the latest price and the day's open, which anchors the chart at 9:30. */
export function recordQuoteIn(h, sym, q) {
  if (!q || !(q.t > 0)) return false;
  const { day, wd, min } = nyParts(q.t * 1000);
  if (wd === "Sat" || wd === "Sun" || min < OPEN_MIN) return false;
  const a = q.o > 0 ? recordAt(h, sym, day, OPEN_MIN, q.o, true) : false;
  const b = recordIn(h, sym, q.t * 1000, q.c);
  return a || b;
}
/** The most recent recorded day for a stock: today while the market trades, else the last session. */
export function seriesIn(h, sym) {
  for (const day of Object.keys(h).sort().reverse()) {
    const pts = h[day][sym];
    if (pts && pts.length) return { day, pts };
  }
  return null;
}

/* ---------- this phone's history ---------- */

export const hist = {};
let dirty = false;
export function loadHist() {
  for (const k of Object.keys(hist)) delete hist[k];
  Object.assign(hist, parseHist(store.get("hist", {})));
}
export function record(sym, ms, price) { if (recordIn(hist, sym, ms, price)) dirty = true; }
export function recordQuote(sym, q) { if (recordQuoteIn(hist, sym, q)) dirty = true; }
export const series = (sym) => seriesIn(hist, sym);
export function saveHist() {
  if (!dirty) return;
  dirty = false;
  const out = {};
  for (const [day, syms] of Object.entries(hist)) {
    out[day] = {};
    for (const [s, pts] of Object.entries(syms)) if (watchOf(s)) out[day][s] = pts;
  }
  store.set("hist", out);
}
