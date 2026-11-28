/* Adding stocks to the watchlist and removing them (with Undo, back in the same place). */
import { S, MAX_WATCH, quotes, watchOf, saveWatch } from "../state.js";
import { fh } from "../finnhub.js";
import { saveQuotes } from "../market.js";
import { mergeQuote } from "../quote.js";
import { liveSync } from "../live.js";
import { showToast } from "./toast.js";
import { render } from "./home.js";
import { paintWatchBtn } from "./stock.js";

/** Returns true if the stock is on the list afterwards. */
export function addStock(sym, name) {
  if (watchOf(sym)) return true;
  if (S.watch.length >= MAX_WATCH) { showToast("Your list is full at " + MAX_WATCH + " stocks. Remove one first.", 2800); return false; }
  S.watch.push({ sym, name: name || sym });
  saveWatch();
  showToast(sym + " added");
  render();
  paintWatchBtn();
  liveSync();
  fh("/quote", { symbol: sym }, { high: true }).then((q) => {
    if (!(q && q.c > 0)) return;
    quotes.set(sym, mergeQuote(quotes.get(sym), q));
    saveQuotes();
    render();
  }).catch(() => {});
  return true;
}
export function removeStock(sym) {
  const at = S.watch.findIndex((w) => w.sym === sym);
  if (at < 0) return;
  const gone = S.watch[at];
  S.watch.splice(at, 1);
  saveWatch();
  showToast(sym + " removed", 5000, { label: "Undo", run: () => restoreStock(gone, at) });
  render();
  paintWatchBtn();
  liveSync();
}
function restoreStock(w, at) {
  if (watchOf(w.sym) || S.watch.length >= MAX_WATCH) return;
  S.watch.splice(Math.min(at, S.watch.length), 0, w);
  saveWatch();
  render();
  paintWatchBtn();
  liveSync();
}
