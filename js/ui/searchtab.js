/* The Search tab: find US stocks and ETFs, tap one to see its page, or + to add it to the watchlist.
   The last 8 stocks opened from here are listed when the search box is empty. */
import { $, el, store, asArr, cleanName } from "../util.js";
import { watchOf, getKey, names } from "../state.js";
import { fh } from "../finnhub.js";
import { usResults, US_TICKER } from "../search.js";
import { logoInto } from "../logos.js";
import { openPage } from "./stock.js";
import { addStock } from "./watch.js";
import { showTab } from "./nav.js";

const RECENT_MAX = 8;
const HINT = "US-listed stocks and ETFs. Tap one to see its price, or + to add it to your watchlist.";
const PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
let tok = 0, timer = null;

const recent = () => asArr(store.get("recentSearch", [])).filter((r) => r && typeof r.sym === "string" && US_TICKER.test(r.sym) && typeof r.name === "string").slice(0, RECENT_MAX);
function remember(sym, name) {
  store.set("recentSearch", [{ sym, name }, ...recent().filter((r) => r.sym !== sym)].slice(0, RECENT_MAX));
  renderRecent();
}
function paintAdd(b, sym) {
  const on = !!watchOf(sym);
  // aria-disabled, not disabled: a disabled button would drop the focus of whoever just pressed it.
  b.setAttribute("aria-disabled", on ? "true" : "false");
  b.innerHTML = on ? CHECK : PLUS;
  b.setAttribute("aria-label", on ? sym + " is on your watchlist" : "Add " + sym + " to your watchlist");
}
export function paintSearchMarks() { document.querySelectorAll(".res li[data-sym] .res-add").forEach((b) => paintAdd(b, b.closest("li").dataset.sym)); }

function row(sym, name) {
  if (!watchOf(sym)) names.set(sym, name);
  const li = el("li");
  li.dataset.sym = sym;
  const open = el("button", "res-open");
  open.type = "button";
  const logo = el("span", "logo");
  logoInto(logo, sym);
  const txt = el("span");
  txt.append(el("b", null, sym), el("small", null, name));
  open.append(logo, txt);
  open.addEventListener("click", () => { remember(sym, name); openPage(sym, { name, opener: open }); });
  const add = el("button", "res-add");
  add.type = "button";
  paintAdd(add, sym);
  add.addEventListener("click", () => { if (!watchOf(sym) && addStock(sym, name)) paintSearchMarks(); });
  li.append(open, add);
  return li;
}
function renderRecent() {
  const list = recent(), ul = $("recent-list");
  ul.textContent = "";
  for (const r of list) ul.append(row(r.sym, r.name));
  $("recent").hidden = !list.length || !!$("search-input").value.trim();
}
const say = (t) => { $("search-msg").textContent = t; };

async function runSearch(q) {
  const my = ++tok;
  const ul = $("search-results");
  if (!getKey()) {
    ul.textContent = "";
    say("Search needs your Finnhub key.");
    const li = el("li");
    const b = el("button", "link pad", "Connect it on Home");
    b.type = "button";
    b.addEventListener("click", () => showTab("home", { focusEl: $("key-input") }));
    li.append(b);
    ul.append(li);
    return;
  }
  say("Searching…");
  try {
    const res = usResults(await fh("/search", { q, exchange: "US" }, { ttl: 3600e3, high: true }));
    if (my !== tok) return;
    ul.textContent = "";
    say(res.length ? res.length + (res.length === 1 ? " result" : " results") : "No US-listed stocks match that. Try the ticker.");
    for (const r of res) ul.append(row(r.symbol, cleanName(r.description) || r.symbol));
  } catch (e) {
    if (my === tok) say(e.code === "rate" ? "Finnhub is busy. Try again in a moment." : "Search didn't work. Check your connection.");
  }
}
export function initSearch() {
  const input = $("search-input");
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { tok++; $("search-results").textContent = ""; say(HINT); renderRecent(); return; }
    $("recent").hidden = true;
    timer = setTimeout(() => runSearch(q), 300);
  });
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    clearTimeout(timer);
    // Puts the keyboard away so the results are visible.
    input.blur();
    runSearch(q);
  });
  $("recent-clear").addEventListener("click", () => { store.set("recentSearch", []); renderRecent(); input.focus(); });
  say(HINT);
  renderRecent();
}
