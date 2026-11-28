import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionDay, dayShort, onDay, priceTime, quoteWhen, latestDay, applyTrade, mergeQuote } from "../../js/quote.js";

const ny = (day, h, m) => { const [y, mo, d] = day.split("-").map(Number); return Date.UTC(y, mo - 1, d, h + 5, m); }; // EST dates in Nov
const TUE = "2026-11-24", WED = "2026-11-25";
const quote = (over) => ({ c: 200, d: 2, dp: 1.0101, h: 205, l: 195, o: 197, pc: 198, t: ny(TUE, 16, 0) / 1000, ...over });

test("a quote's session is the New York day of its last trade", () => {
  assert.equal(sessionDay(quote()), TUE);
  assert.equal(sessionDay(quote({ t: ny(TUE, 23, 59) / 1000 })), TUE);
  assert.equal(sessionDay({ c: 1 }), null);
  assert.equal(sessionDay(null), null);
});

test("days are named briefly: weekday within a week, else the date", () => {
  assert.equal(dayShort(TUE, WED), "Tue");
  assert.equal(dayShort("2026-11-20", WED), "Fri");
  assert.equal(dayShort("2026-11-18", WED), "Nov 18");
  assert.equal(onDay(WED, WED), "today");
  assert.equal(onDay(TUE, WED), "on Tue");
  assert.equal(onDay(null, WED), "today");
});

test("price times are New York time, with the weekday when it isn't today", () => {
  assert.equal(priceTime(ny(WED, 10, 59), WED), "10:59 AM ET");
  assert.equal(priceTime(ny(TUE, 16, 0), WED), "Tue 4:00 PM ET");
});

test("the stock page says honestly when its numbers are from", () => {
  assert.equal(quoteWhen(quote({ t: ny(WED, 10, 59) / 1000 }), WED, false), "Today · 10:59 AM ET");
  assert.equal(quoteWhen(quote({ t: ny(WED, 10, 59) / 1000 }), WED, true), "Today · Live");
  assert.equal(quoteWhen(quote({ t: ny(WED, 16, 0) / 1000 }), WED, false), "Today · At close");
  assert.equal(quoteWhen(quote(), WED, false), "Tue close");
  assert.equal(quoteWhen(quote({ t: ny(TUE, 14, 31) / 1000 }), WED, false), "Tue · 2:31 PM ET");
  assert.equal(quoteWhen({ c: 1 }, WED, false), "");
});

test("the list's day is its newest quote's", () => {
  assert.equal(latestDay([quote(), quote({ t: ny(WED, 10, 0) / 1000 }), undefined]), WED);
  assert.equal(latestDay([]), null);
});

test("a trade from a new session measures against the last close", () => {
  const q = quote();
  assert.equal(applyTrade(q, 204, ny(WED, 9, 30)), true);
  assert.equal(q.pc, 200, "yesterday's last price is the previous close");
  assert.equal(q.c, 204);
  assert.equal(q.d, 4);
  assert.equal(q.dp, 2);
  assert.deepEqual([q.o, q.h, q.l], [204, 204, 204], "a new day's open, high and low");
  assert.equal(sessionDay(q), WED);
});

test("within a session, trades update the price, high and low", () => {
  const q = quote({ t: ny(WED, 10, 0) / 1000 });
  applyTrade(q, 210, ny(WED, 10, 1));
  applyTrade(q, 190, ny(WED, 10, 2));
  assert.deepEqual([q.c, q.h, q.l], [190, 210, 190]);
  assert.equal(q.pc, 198, "same session: the close doesn't move");
  assert.equal(q.d, -8);
});

test("an older trade counts for the high and low but doesn't move the price back", () => {
  const q = quote({ t: ny(WED, 10, 59) / 1000 });
  applyTrade(q, 230, ny(WED, 10, 0));
  assert.equal(q.c, 200);
  assert.equal(q.h, 230);
  assert.equal(q.t, ny(WED, 10, 59) / 1000);
});

test("trades from an older session, or without a price, are ignored", () => {
  const q = quote({ t: ny(WED, 10, 0) / 1000 });
  assert.equal(applyTrade(q, 150, ny(TUE, 15, 0)), false);
  assert.equal(applyTrade(q, -1, ny(WED, 10, 1)), false);
  assert.equal(applyTrade(q, 201, NaN), false);
  assert.equal(q.c, 200);
});

test("a refresh keeps a newer live price but takes Finnhub's other numbers", () => {
  const live = quote({ c: 203, h: 206, t: ny(WED, 11, 0) / 1000 });
  const fresh = quote({ c: 202, h: 205, l: 194, o: 196, pc: 198, t: ny(WED, 10, 59) / 1000 });
  const q = mergeQuote(live, fresh);
  assert.equal(q.c, 203);
  assert.equal(q.t, ny(WED, 11, 0) / 1000);
  assert.equal(q.o, 196);
  assert.equal(q.l, 194);
  assert.equal(q.d, 5);
});

test("a refresh doesn't pull a quote that live trades moved into a new session back to the old one", () => {
  const live = quote({ c: 204, pc: 200, t: ny(WED, 9, 31) / 1000 });
  const stale = quote();
  assert.equal(mergeQuote(live, stale), live);
});

test("otherwise the refreshed quote wins", () => {
  const fresh = quote({ c: 205, t: ny(WED, 11, 0) / 1000 });
  assert.deepEqual(mergeQuote(quote({ t: ny(WED, 10, 0) / 1000 }), fresh), fresh);
  assert.deepEqual(mergeQuote(undefined, fresh), fresh);
  assert.notEqual(mergeQuote(undefined, fresh), fresh, "a copy, so later trades don't edit Finnhub's object");
});
