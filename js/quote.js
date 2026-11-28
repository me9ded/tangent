/* What a quote's numbers mean in time: which trading session they're from, how to say so, and how
   live trades and refreshes update them. Pure, so the unit tests can drive it. */
import { nyParts, minLabel, CLOSE_MIN } from "./time.js";

/** New York date of the session a quote is from (the day of its last trade), or null. */
export const sessionDay = (q) => (q && q.t > 0 ? nyParts(q.t * 1000).day : null);

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue" for a day in the last week, else "Nov 18". Days are "YYYY-MM-DD". */
export function dayShort(day, today) {
  const d = Date.parse(day + "T12:00:00Z"), ago = Math.round((Date.parse(today + "T12:00:00Z") - d) / 864e5);
  if (ago >= 0 && ago < 7) return WD[new Date(d).getUTCDay()];
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
/** "today" or "on Tue", for sentences about a day's change. */
export const onDay = (day, today) => (!day || day === today ? "today" : "on " + dayShort(day, today));

/** When a price is from, in New York time: "11:42 AM ET", or "Tue 4:00 PM ET" for an earlier day. */
export function priceTime(ms, today) {
  const { day, min } = nyParts(ms);
  return (day === today ? "" : dayShort(day, today) + " ") + minLabel(min) + " ET";
}
/** The stock page's line: "Today · Live", "Today · 11:42 AM ET", "Today · At close", "Tue close", "Tue · 2:31 PM ET". */
export function quoteWhen(q, today, live) {
  const day = sessionDay(q);
  if (!day) return "";
  const { min } = nyParts(q.t * 1000);
  if (day === today) return "Today · " + (live ? "Live" : min >= CLOSE_MIN ? "At close" : minLabel(min) + " ET");
  return dayShort(day, today) + (min >= CLOSE_MIN ? " close" : " · " + minLabel(min) + " ET");
}

/** The newest session day among quotes ("YYYY-MM-DD" strings sort by date), or null. */
export function latestDay(qs) {
  let best = null;
  for (const q of qs) { const d = sessionDay(q); if (d && (!best || d > best)) best = d; }
  return best;
}

/** Apply one trade to a quote, in place. A trade from a newer session than the quote starts a new
    day: the last price becomes the previous close, so the first trades after the open are measured
    against the right close. Trades from an older session are ignored, and an older trade in the same
    session counts for the high and low but doesn't move the price back. Returns false if ignored. */
export function applyTrade(q, price, ms) {
  if (!(price > 0) || !Number.isFinite(ms)) return false;
  const qd = sessionDay(q), td = nyParts(ms).day;
  if (qd && td < qd) return false;
  if (qd && td > qd && q.c > 0) { q.pc = q.c; q.o = price; q.h = price; q.l = price; }
  q.h = q.h > 0 ? Math.max(q.h, price) : price;
  q.l = q.l > 0 ? Math.min(q.l, price) : price;
  if (!(q.t > 0) || ms >= q.t * 1000) { q.c = price; q.t = Math.floor(ms / 1000); }
  if (q.pc > 0) { q.d = q.c - q.pc; q.dp = (q.d / q.pc) * 100; }
  return true;
}

/** A refreshed quote replacing one that live trades kept current. Finnhub's numbers win, except that
    a newer live price is kept, and a quote that live trades already moved into a newer session isn't
    pulled back to the old one. */
export function mergeQuote(old, fresh) {
  if (!old || !(old.c > 0)) return Object.assign({}, fresh);
  const od = sessionDay(old), fd = sessionDay(fresh);
  if (od && fd && od > fd) return old;
  const q = Object.assign({}, fresh);
  if (od === fd && old.t > fresh.t) {
    q.c = old.c;
    q.t = old.t;
    q.h = q.h > 0 ? Math.max(q.h, old.c) : old.c;
    q.l = q.l > 0 ? Math.min(q.l, old.c) : old.c;
    if (q.pc > 0) { q.d = q.c - q.pc; q.dp = (q.d / q.pc) * 100; }
  }
  return q;
}
