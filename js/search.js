/* Which Finnhub search results Tangent offers. Pure, so the unit tests can check it. */
import { asArr } from "./util.js";

/* US tickers: plain (AAPL), or a share class after a dot (BRK.B, BF.A). Foreign listings come back
   as AMD.SW, BRKB.MX or BRK.B:XETRA, so a two-letter suffix or a colon means another exchange. */
export const US_TICKER = /^[A-Z0-9]{1,6}(\.[A-E])?$/;

/** US-listed stocks and funds from a /search response, without duplicates, at most 12. */
export function usResults(json) {
  const seen = new Set();
  return asArr(json && json.result).filter((r) => {
    if (!r || typeof r.symbol !== "string" || !US_TICKER.test(r.symbol) || seen.has(r.symbol)) return false;
    seen.add(r.symbol);
    return !r.type || /common stock|adr|etp|etf|reit/i.test(r.type);
  }).slice(0, 12);
}
