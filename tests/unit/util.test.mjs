import { test } from "node:test";
import assert from "node:assert/strict";
import { usd, pct, signedUsd, cleanName, initials } from "../../js/util.js";

test("money and percentages", () => {
  assert.equal(usd(1234.5), "$1,234.50");
  assert.equal(usd(0.1), "$0.10");
  assert.equal(usd(NaN), "–");
  assert.equal(usd(undefined), "–");
  assert.equal(pct(1.2345), "+1.23%");
  assert.equal(pct(-1.235), "−1.24%");
  assert.equal(pct(0), "0.00%");
  assert.equal(signedUsd(-8), "−$8.00");
  assert.equal(signedUsd(2), "+$2.00");
});

test("company names are tidied", () => {
  assert.equal(cleanName("BERKSHIRE HATHAWAY INC-CL B"), "Berkshire Hathaway");
  assert.equal(cleanName("ADVANCED MICRO DEVICES"), "Advanced Micro Devices");
  assert.equal(cleanName("TAIWAN SEMICONDUCTOR-SP ADR"), "Taiwan Semiconductor");
  assert.equal(cleanName(""), "");
});

test("initials for the logo placeholder", () => {
  assert.equal(initials("Meta Platforms"), "MP");
  assert.equal(initials("Apple"), "A");
  assert.equal(initials(""), "?");
});
