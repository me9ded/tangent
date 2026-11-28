/* Quotes for the watchlist and whether the US market is open. */
import { store } from "./util.js";
import { nyClock } from "./time.js";
import { S, quotes, watchOf, getKey } from "./state.js";
import { fh } from "./finnhub.js";
import { recordQuote, saveHist } from "./history.js";

let quoteJob = null;
export function saveQuotes() {
  store.set("lastQuotes", Object.fromEntries([...quotes].filter(([s]) => watchOf(s))));
  store.set("lastQuotesAt", S.quotesAt);
  saveHist();
}
export function refreshQuotes(force) {
  if (!getKey()) return Promise.resolve(quotes);
  if (!force && quotes.size && Date.now() - S.quotesAt < 55000) return Promise.resolve(quotes);
  if (quoteJob) return quoteJob;
  quoteJob = (async () => {
    const res = await Promise.allSettled(S.watch.map((w) => fh("/quote", { symbol: w.sym }, { high: true }).then((q) => [w.sym, q])));
    let ok = 0, bad = false, lastErr = null;
    for (const r of res) {
      if (r.status === "fulfilled") {
        const [s, q] = r.value;
        if (q && Number.isFinite(q.c) && q.c > 0) { quotes.set(s, Object.assign({}, q)); recordQuote(s, q); ok++; }
      } else { lastErr = r.reason; if (r.reason && r.reason.code === "badkey") bad = true; }
    }
    S.keyBroken = bad && !ok;
    if (!ok && lastErr) throw lastErr;
    S.quotesAt = Date.now();
    saveQuotes();
    return quotes;
  })().finally(() => { quoteJob = null; });
  return quoteJob;
}
export const dpOf = (sym) => { const q = quotes.get(sym); return q && Number.isFinite(q.dp) ? q.dp : null; };

/* Market hours from the clock, used until (or when) Finnhub's market status isn't available. */
export function clockStatus() {
  const { wd, min } = nyClock();
  if (wd === "Sat" || wd === "Sun") return { open: false, session: null };
  if (min >= 570 && min < 960) return { open: true, session: "regular" };
  if (min >= 240 && min < 570) return { open: false, session: "pre-market" };
  if (min >= 960 && min < 1200) return { open: false, session: "post-market" };
  return { open: false, session: null };
}
export async function marketStatus() {
  try {
    const j = await fh("/stock/market-status", { exchange: "US" }, { ttl: 60000, high: true });
    S.mstatus = j && typeof j.isOpen === "boolean" ? { open: j.isOpen, session: j.session || (j.isOpen ? "regular" : null), holiday: j.holiday || null } : clockStatus();
  } catch (e) { S.mstatus = clockStatus(); }
  return S.mstatus;
}
export const regular = () => !!(S.mstatus.open || S.mstatus.session === "regular");
export const trading = () => S.mstatus.open || S.mstatus.session === "regular" || S.mstatus.session === "pre-market" || S.mstatus.session === "post-market";
export function statusLabel() {
  const m = S.mstatus;
  if (m.open || m.session === "regular") return "Market open";
  if (m.session === "pre-market") return "Pre-market";
  if (m.session === "post-market") return "After hours";
  return m.holiday ? "Closed for " + m.holiday : "Market closed";
}
