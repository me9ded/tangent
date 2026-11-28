/* The status line under the title: is the market open, and when are these prices from (New York time). */
import { $, el } from "../util.js";
import { S, getKey } from "../state.js";
import { statusLabel, regular, latestQuoteMs } from "../market.js";
import { nyClock } from "../time.js";
import { priceTime } from "../quote.js";
import { isLive } from "../live.js";

export function paintStatus() {
  const s = $("mkt");
  const live = isLive() && !S.offline;
  s.textContent = "";
  s.classList.toggle("open", regular() && !S.offline);
  s.classList.toggle("streaming", live);
  s.classList.toggle("offline", S.offline);
  s.append(el("i"), el("span", null, S.offline ? "Offline" : statusLabel()));
  const t = getKey() ? latestQuoteMs() : 0;
  if (live) s.append(el("span", "live", "· Live"));
  else if (t) s.append(el("span", "at", "· " + (S.offline ? "prices from " : "") + priceTime(t, nyClock().day)));
  const fs = $("feed-state");
  if (fs) fs.textContent = !getKey() ? "" : live ? "Live prices from Finnhub right now." : "Prices from Finnhub: live while the market is open, otherwise refreshed every minute or so.";
}
