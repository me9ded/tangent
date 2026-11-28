/* Adding stocks (the search sheet) and removing them. */
import { $, el, cleanName } from "../util.js";
import { S, MAX_WATCH, quotes, watchOf, saveWatch, getKey } from "../state.js";
import { fh } from "../finnhub.js";
import { saveQuotes } from "../market.js";
import { usResults } from "../search.js";
import { liveSync } from "../live.js";
import { showToast } from "./toast.js";
import { pushOverlay, back } from "./overlays.js";
import { render } from "./home.js";
import { paintWatchBtn } from "./stock.js";

let addTok = 0, addTimer = null;
const addSheet = () => $("add-sheet");

async function symbolSearch(q) {
  return usResults(await fh("/search", { q, exchange: "US" }, { ttl: 3600e3, high: true }));
}
function openAdd() {
  if (!getKey()) { showToast("Connect your Finnhub key first."); $("key-input").focus(); return; }
  addSheet().hidden = false;
  $("add-input").value = "";
  $("add-results").textContent = "";
  $("add-msg").textContent = "Search by company name or ticker. US-listed stocks and ETFs.";
  pushOverlay(() => { addSheet().hidden = true; });
  $("add-input").focus();
}
async function runSearch(q) {
  const my = ++addTok;
  $("add-msg").textContent = "Searching…";
  try {
    const res = await symbolSearch(q);
    if (my !== addTok) return;
    const ul = $("add-results");
    ul.textContent = "";
    $("add-msg").textContent = res.length ? "" : "No US-listed stocks match that. Try the ticker.";
    for (const r of res) {
      const li = el("li");
      const b = el("button");
      b.type = "button";
      const on = !!watchOf(r.symbol);
      b.append(el("b", null, r.displaySymbol || r.symbol), el("span", null, cleanName(r.description)), el("em", null, on ? "On your list" : "Add"));
      b.disabled = on;
      b.addEventListener("click", () => addStock(r.symbol, cleanName(r.description) || r.symbol));
      li.append(b);
      ul.append(li);
    }
  } catch (e) {
    if (my === addTok) $("add-msg").textContent = e.code === "rate" ? "Finnhub is busy. Try again in a moment." : "Search didn't work. Check your connection.";
  }
}
export function addStock(sym, name) {
  if (watchOf(sym)) return;
  if (S.watch.length >= MAX_WATCH) { showToast("Your list is full at " + MAX_WATCH + " stocks. Remove one first.", 2800); return; }
  S.watch.push({ sym, name });
  saveWatch();
  if (!addSheet().hidden) back();
  showToast(sym + " added");
  render();
  liveSync();
  fh("/quote", { symbol: sym }, { high: true }).then((q) => { if (q && q.c > 0) { quotes.set(sym, Object.assign({}, q)); saveQuotes(); render(); } }).catch(() => {});
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
export function initAdd() {
  $("add").addEventListener("click", openAdd);
  addSheet().addEventListener("click", (e) => { if (e.target === addSheet() || e.target.closest("[data-close]")) back(); });
  $("add-input").addEventListener("input", () => {
    clearTimeout(addTimer);
    const q = $("add-input").value.trim();
    if (!q) { $("add-results").textContent = ""; return; }
    addTimer = setTimeout(() => runSearch(q), 300);
  });
  $("add-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("add-input").value.trim(); if (q) runSearch(q); });
}
