import { test } from "node:test";
import assert from "node:assert/strict";
import { usResults, US_TICKER } from "../../js/search.js";

const r = (symbol, type = "Common Stock") => ({ symbol, displaySymbol: symbol, description: symbol, type });

test("US tickers and share classes pass, foreign listings don't", () => {
  for (const ok of ["AAPL", "BRK.B", "BF.A", "T", "GOOGL"]) assert.ok(US_TICKER.test(ok), ok);
  for (const no of ["BRKB.MX", "AMD.SW", "BRK.B:XETRA", "VOD.L", "0700.HK", "aapl", "TOOLONGX"]) assert.ok(!US_TICKER.test(no), no);
});

test("results keep US stocks and funds, without duplicates", () => {
  const out = usResults({ result: [r("BRK.B"), r("BRKB.MX"), r("BRK.B"), r("SPY", "ETP"), r("ABCDW", "Warrant"), r("O", "REIT"), r("X", "")] });
  assert.deepEqual(out.map((x) => x.symbol), ["BRK.B", "SPY", "O", "X"]);
});

test("at most 12 results, and junk input is safe", () => {
  assert.equal(usResults({ result: Array.from({ length: 30 }, (_, i) => r("A" + i)) }).length, 12);
  assert.deepEqual(usResults(null), []);
  assert.deepEqual(usResults({ result: [null, { symbol: 5 }] }), []);
});
