import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHist, recordAt, recordIn, recordQuoteIn, seriesIn } from "../../js/history.js";

const nyWed = (h, m) => Date.UTC(2026, 10, 25, h + 5, m); // EST

test("points stay in minute order; a minute keeps its latest price", () => {
  const h = {};
  recordAt(h, "AAPL", "2026-11-25", 600, 200);
  recordAt(h, "AAPL", "2026-11-25", 590, 199);
  recordAt(h, "AAPL", "2026-11-25", 610, 201);
  recordAt(h, "AAPL", "2026-11-25", 600, 200.5);
  assert.deepEqual(h["2026-11-25"].AAPL, [[590, 199], [600, 200.5], [610, 201]]);
  assert.equal(recordAt(h, "AAPL", "2026-11-25", 600, 200.5), false, "same price is no change");
  assert.equal(recordAt(h, "AAPL", "2026-11-25", 600, 150, true), false, "keepExisting doesn't overwrite");
});

test("prices are rounded to 4 decimals", () => {
  const h = {};
  recordAt(h, "X", "2026-11-25", 600, 1.234567);
  assert.equal(h["2026-11-25"].X[0][1], 1.2346);
});

test("only the regular session on weekdays is recorded", () => {
  const h = {};
  assert.equal(recordIn(h, "AAPL", nyWed(9, 29), 1), false, "before 9:30");
  assert.equal(recordIn(h, "AAPL", nyWed(9, 30), 1), true);
  assert.equal(recordIn(h, "AAPL", nyWed(16, 0), 1), true, "4:00 itself is the close");
  assert.equal(recordIn(h, "AAPL", nyWed(16, 1), 1), false, "after hours");
  assert.equal(recordIn(h, "AAPL", Date.UTC(2026, 10, 28, 16, 0), 1), false, "Saturday");
  assert.equal(recordIn(h, "AAPL", nyWed(11, 0), 0), false, "no price");
  assert.equal(recordIn(h, "AAPL", NaN, 5), false, "no time");
});

test("a quote anchors the open at 9:30 without overwriting it", () => {
  const h = {};
  recordQuoteIn(h, "AAPL", { c: 200, o: 197, t: nyWed(11, 30) / 1000 });
  assert.deepEqual(h["2026-11-25"].AAPL, [[570, 197], [690, 200]]);
  recordQuoteIn(h, "AAPL", { c: 201, o: 150, t: nyWed(11, 31) / 1000 });
  assert.equal(h["2026-11-25"].AAPL[0][1], 197);
  assert.equal(recordQuoteIn(h, "MSFT", { c: 400, o: 399, t: nyWed(8, 0) / 1000 }), false, "pre-market quotes add nothing");
});

test("only the two most recent days are kept", () => {
  const h = {};
  for (const d of ["2026-11-23", "2026-11-24", "2026-11-25"]) recordAt(h, "A", d, 600, 1);
  assert.deepEqual(Object.keys(h).sort(), ["2026-11-24", "2026-11-25"]);
});

test("stored history is cleaned up", () => {
  const h = parseHist({
    "2026-11-25": { AAPL: [[600, 200], [500, 1], ["x", 2], [601, -1], null], MSFT: [] },
    "not a day": { AAPL: [[600, 1]] },
    "2026-11-24": "junk"
  });
  assert.deepEqual(h, { "2026-11-25": { AAPL: [[600, 200]] }, "2026-11-24": {} });
  assert.deepEqual(parseHist(null), {});
});

test("a stock's series is its most recent day with points", () => {
  const h = { "2026-11-24": { AAPL: [[600, 1]] }, "2026-11-25": { MSFT: [[600, 2]] } };
  assert.deepEqual(seriesIn(h, "AAPL"), { day: "2026-11-24", pts: [[600, 1]] });
  assert.deepEqual(seriesIn(h, "MSFT"), { day: "2026-11-25", pts: [[600, 2]] });
  assert.equal(seriesIn(h, "NVDA"), null);
});
