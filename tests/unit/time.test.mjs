import { test } from "node:test";
import assert from "node:assert/strict";
import { nyParts, minLabel, dayLabel, OPEN_MIN, CLOSE_MIN } from "../../js/time.js";

const at = (iso) => nyParts(Date.parse(iso));

test("the session is 9:30 to 4:00 New York time", () => {
  assert.equal(OPEN_MIN, 9 * 60 + 30);
  assert.equal(CLOSE_MIN, 16 * 60);
});

test("9:30 in New York in summer (EDT) and winter (EST)", () => {
  assert.deepEqual(at("2026-07-01T13:30:00Z"), { day: "2026-07-01", wd: "Wed", min: 570 });
  assert.deepEqual(at("2026-11-25T14:30:00Z"), { day: "2026-11-25", wd: "Wed", min: 570 });
});

test("clocks spring forward on 2026-03-08", () => {
  assert.equal(at("2026-03-08T06:59:00Z").min, 1 * 60 + 59); // 1:59 EST
  assert.equal(at("2026-03-08T07:00:00Z").min, 3 * 60);      // 3:00 EDT
  // The first trading day after the change opens at 13:30 UTC.
  assert.equal(at("2026-03-09T13:30:00Z").min, OPEN_MIN);
});

test("clocks fall back on 2026-11-01", () => {
  assert.equal(at("2026-11-01T05:59:00Z").min, 1 * 60 + 59); // 1:59 EDT
  assert.equal(at("2026-11-01T06:00:00Z").min, 1 * 60);      // 1:00 EST again
  assert.equal(at("2026-11-02T14:30:00Z").min, OPEN_MIN);
});

test("the New York date, not UTC's, decides the day", () => {
  assert.equal(at("2026-11-26T04:59:00Z").day, "2026-11-25"); // 11:59 PM Wed in New York
  assert.equal(at("2026-11-26T05:00:00Z").day, "2026-11-26");
  assert.equal(at("2026-11-28T15:00:00Z").wd, "Sat");
});

test("minute labels", () => {
  assert.equal(minLabel(570), "9:30 AM");
  assert.equal(minLabel(720), "12:00 PM");
  assert.equal(minLabel(960), "4:00 PM");
  assert.equal(minLabel(0), "12:00 AM");
});

test("day labels", () => {
  assert.equal(dayLabel("2026-11-25", "2026-11-25"), "Today");
  assert.equal(dayLabel("2026-11-25", "2026-11-26"), "Wed, Nov 25");
});
