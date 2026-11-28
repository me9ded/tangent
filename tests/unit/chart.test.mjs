import { test } from "node:test";
import assert from "node:assert/strict";
import { linePaths, yScale, closeFor } from "../../js/chart.js";

const ident = (v) => v;

test("points less than 15 minutes apart are one solid line", () => {
  const { solid, gaps } = linePaths([[0, 10], [1, 11], [15, 12]], ident, ident);
  assert.equal(solid, "M0.0 10.0L1.0 11.0L15.0 12.0");
  assert.equal(gaps, "");
});

test("a longer gap is drawn separately (dashed) and the line restarts after it", () => {
  const { solid, gaps } = linePaths([[0, 10], [1, 11], [30, 12], [31, 13]], ident, ident);
  assert.equal(gaps, "M1.0 11.0L30.0 12.0");
  assert.equal(solid, "M0.0 10.0L1.0 11.0M30.0 12.0L31.0 13.0");
});

test("the scale fits the points and the previous close, higher prices higher up", () => {
  const y = yScale([[0, 100], [1, 110]], 90, 0, 100);
  assert.ok(y(90) <= 100 && y(110) >= 0, "previous close and high are both inside");
  assert.ok(y(110) < y(100) && y(100) < y(90), "higher price, smaller y");
  // An 8% margin keeps the line off the edges.
  assert.ok(y(110) > 0 && y(90) < 100);
});

test("a flat day doesn't divide by zero", () => {
  const y = yScale([[0, 50], [1, 50]], 50, 0, 100);
  assert.ok(Number.isFinite(y(50)));
  assert.ok(Math.abs(y(50) - 50) < 1e-9, "flat line sits in the middle");
});

test("a day's chart is measured against that day's own previous close", () => {
  const tue = Date.UTC(2026, 10, 24, 21, 0) / 1000, wed = Date.UTC(2026, 10, 25, 16, 0) / 1000;
  assert.equal(closeFor({ day: "2026-11-24", pc: 195 }, { pc: 198, t: tue }), 195, "recorded with the day");
  assert.equal(closeFor({ day: "2026-11-25", pc: null }, { pc: 198, t: wed }), 198, "the quote is from that day");
  assert.equal(closeFor({ day: "2026-11-24", pc: null }, { pc: 198, t: wed }), null, "the quote is a later day's: unknown");
});
