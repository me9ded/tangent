/* Today's chart, recorded on this phone.
   Finnhub's free plan has no intraday candles, so Tangent keeps its own: the last price in each
   minute of the regular session (9:30 to 4:00 New York time), from live trades and quote refreshes,
   plus each day's previous close so an older day's chart is measured against its own close.
   Only the two most recent trading days are kept. */
import { store, asArr, asObj } from "./util.js";
import { OPEN_MIN, CLOSE_MIN, nyParts } from "./time.js";
import { watchOf } from "./state.js";

const KEEP_DAYS = 2;

/* ---------- pure: everything takes the history object, so the unit tests can drive it ---------- */

/** Clean up stored history into { "YYYY-MM-DD": { pts: { SYM: [[minute, price], ...] }, pc: { SYM: close } } }.
    Earlier versions stored { "YYYY-MM-DD": { SYM: [[minute, price], ...] } }; those load without closes. */
export function parseHist(raw) {
  const out = {};
  for (const [day, v] of Object.entries(asObj(raw))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const o = asObj(v);
    const current = o.pts && typeof o.pts === "object" && !Array.isArray(o.pts);
    const d = { pts: {}, pc: {} };
    for (const [s, pts] of Object.entries(current ? asObj(o.pts) : o)) {
      const ok = asArr(pts).filter((x) => Array.isArray(x) && Number.isInteger(x[0]) && x[0] >= OPEN_MIN && x[0] <= CLOSE_MIN && x[1] > 0);
      if (ok.length) d.pts[s] = ok;
    }
    if (current) for (const [s, pc] of Object.entries(asObj(o.pc))) if (Number.isFinite(pc) && pc > 0) d.pc[s] = pc;
    out[day] = d;
  }
  return out;
}
/** Put a price at a minute (replacing that minute's price unless keepExisting), and note the day's
    previous close if given. Returns true if anything changed. */
export function recordAt(h, sym, day, min, price, keepExisting, pc) {
  const d = h[day] || (h[day] = { pts: {}, pc: {} });
  let changed = false;
  if (pc > 0 && d.pc[sym] !== pc) { d.pc[sym] = pc; changed = true; }
  const pts = d.pts[sym] || (d.pts[sym] = []);
  const p = Math.round(price * 1e4) / 1e4;
  let i = pts.length - 1;
  while (i >= 0 && pts[i][0] > min) i--;
  if (i >= 0 && pts[i][0] === min) {
    if (!keepExisting && pts[i][1] !== p) { pts[i][1] = p; changed = true; }
  } else { pts.splice(i + 1, 0, [min, p]); changed = true; }
  for (const old of Object.keys(h).sort().slice(0, -KEEP_DAYS)) delete h[old];
  return changed;
}
/** Record a trade or price at a timestamp; ignored outside the regular session. */
export function recordIn(h, sym, ms, price, pc) {
  if (!(price > 0) || !Number.isFinite(ms)) return false;
  const { day, wd, min } = nyParts(ms);
  if (wd === "Sat" || wd === "Sun" || min < OPEN_MIN || min > CLOSE_MIN) return false;
  return recordAt(h, sym, day, min, price, false, pc);
}
/** A quote gives the latest price and the day's open, which anchors the chart at 9:30. */
export function recordQuoteIn(h, sym, q) {
  if (!q || !(q.t > 0)) return false;
  const { day, wd, min } = nyParts(q.t * 1000);
  if (wd === "Sat" || wd === "Sun" || min < OPEN_MIN) return false;
  const a = q.o > 0 ? recordAt(h, sym, day, OPEN_MIN, q.o, true, q.pc) : false;
  const b = recordIn(h, sym, q.t * 1000, q.c, q.pc);
  return a || b;
}
/** The most recent recorded day for a stock: { day, pts, pc } (pc is null when unknown). */
export function seriesIn(h, sym) {
  for (const day of Object.keys(h).sort().reverse()) {
    const pts = h[day].pts[sym];
    if (pts && pts.length) return { day, pts, pc: h[day].pc[sym] || null };
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
export function record(sym, ms, price, pc) { if (recordIn(hist, sym, ms, price, pc)) dirty = true; }
export function recordQuote(sym, q) { if (recordQuoteIn(hist, sym, q)) dirty = true; }
export const series = (sym) => seriesIn(hist, sym);
export function saveHist() {
  if (!dirty) return;
  dirty = false;
  const out = {};
  for (const [day, d] of Object.entries(hist)) {
    const o = { pts: {}, pc: {} };
    for (const [s, pts] of Object.entries(d.pts)) if (watchOf(s)) o.pts[s] = pts;
    for (const [s, pc] of Object.entries(d.pc)) if (watchOf(s)) o.pc[s] = pc;
    out[day] = o;
  }
  store.set("hist", out);
}
