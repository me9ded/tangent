/* The market status line under the title, and the feed line at the bottom of the list. */
import { $, el, clock } from "../util.js";
import { S, getKey } from "../state.js";
import { statusLabel } from "../market.js";
import { isLive } from "../live.js";

export function paintStatus() {
  const s = $("mkt");
  s.textContent = "";
  s.classList.toggle("open", !!(S.mstatus.open || S.mstatus.session === "regular"));
  s.classList.toggle("streaming", isLive());
  s.append(el("i"), el("span", null, statusLabel()));
  if (isLive()) s.append(el("span", "live", "· Live"));
  else if (S.quotesAt && getKey()) s.append(el("span", "at", "· " + clock(S.quotesAt)));
  const fs = $("feed-state");
  if (fs) fs.textContent = isLive() ? "Live prices from Finnhub" : "Prices from Finnhub, refreshed every minute while the market trades";
}
