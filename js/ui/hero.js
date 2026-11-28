/* "Your list": the average move of the watchlist, and the movers chart. Updated in place (keyed by
   symbol), so a live update never rebuilds a button someone is about to tap or has focused. */
import { $, el, usd, pct } from "../util.js";
import { S, quotes, getKey } from "../state.js";
import { dpOf } from "../market.js";
import { nyClock } from "../time.js";
import { onDay } from "../quote.js";
import { chgInto, pctAbs, dirOf } from "./bits.js";
import { openPage } from "./stock.js";

const MOVERS_MIN = 4;
const mvRows = new Map();
let gap = null;

export function renderHero() {
  const box = $("hero");
  const rows = S.watch.map((w) => ({ sym: w.sym, name: w.name, dp: dpOf(w.sym), c: (quotes.get(w.sym) || {}).c })).filter((r) => r.dp != null);
  if (!getKey() || rows.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  rows.sort((a, b) => b.dp - a.dp);
  const avg = rows.reduce((s, r) => s + r.dp, 0) / rows.length;
  const up = rows.filter((r) => r.dp > 0).length;
  $("hero-lab").textContent = "Your list " + onDay(S.listDay, nyClock().day);
  // Rounded first, so a flat "0.00%" gets no arrow and no color.
  const v = Math.round(avg * 100) / 100;
  const val = $("hero-val");
  chgInto(val, v, pctAbs(v));
  val.className = "hero-val " + dirOf(v);
  $("hero-sub").textContent = "Average move of " + rows.length + " stocks · " + (up ? up + " up" : "none up");
  paintMovers(rows.length >= MOVERS_MIN ? rows : []);
}

function paintMovers(rows) {
  const mv = $("mv");
  // Long lists show the four biggest gainers and the four biggest losers; the full list is right below.
  const shown = rows.length > 8 ? [...rows.slice(0, 4), null, ...rows.slice(-4)] : rows;
  const keep = new Set(shown.filter(Boolean).map((r) => r.sym));
  for (const [s, b] of mvRows) if (!keep.has(s)) { b.remove(); mvRows.delete(s); }
  const max = Math.max(0.5, ...rows.map((r) => Math.abs(r.dp)));
  const want = shown.map((r) => {
    if (!r) return gap || (gap = el("div", "mv-gap"));
    let b = mvRows.get(r.sym);
    if (!b) {
      b = el("button", "mv-row");
      b.type = "button";
      b.dataset.sym = r.sym;
      const bar = el("span", "mv-bar");
      bar.append(el("i"));
      b.append(el("span", "mv-sym", r.sym), bar, el("span", "mv-val"));
      b.addEventListener("click", () => openPage(r.sym, { opener: b }));
      mvRows.set(r.sym, b);
    }
    b.className = "mv-row " + (r.dp > 0 ? "up" : r.dp < 0 ? "down" : "flat");
    b.querySelector(".mv-bar i").style.width = (Math.abs(r.dp) / max) * 50 + "%";
    b.querySelector(".mv-val").textContent = pct(r.dp);
    b.setAttribute("aria-label", r.name + " " + pct(r.dp).replace("−", "minus ") + " at " + usd(r.c));
    return b;
  });
  if (!want.includes(gap) && gap) gap.remove();
  // Reorder only what moved, so focus stays put.
  want.forEach((n, i) => { if (mv.children[i] !== n) mv.insertBefore(n, mv.children[i] || null); });
  while (mv.children.length > want.length) mv.lastChild.remove();
}
