/* The price page for one stock. */
import { $, el, usd, signedUsd, clock, asObj } from "../util.js";
import { S, quotes, yearCache, watchOf, getKey } from "../state.js";
import { fh, profile } from "../finnhub.js";
import { statusLabel } from "../market.js";
import { recordQuote } from "../history.js";
import { logoInto, paintLogos } from "../logos.js";
import { chartSection, paintChart, resetScrub } from "../chart.js";
import { liveSync, isLive } from "../live.js";
import { pxEl, pill, rangeBar, paintRange } from "./bits.js";
import { pushOverlay } from "./overlays.js";
import { addStock, removeStock } from "./add.js";

export function paintWatchBtn() {
  const wb = $("pg-watch");
  if (!wb || !S.pageSym || wb.dataset.armed === "1") return;
  const on = !!watchOf(S.pageSym);
  wb.setAttribute("aria-pressed", on ? "true" : "false");
  wb.textContent = on ? "Watching" : "Watch";
}
export function paintPageNumbers() {
  paintChart();
  const q = quotes.get(S.pageSym);
  const ch = $("pg-change");
  if (ch) {
    ch.textContent = "";
    if (q) ch.append(el("span", "dd " + (q.d > 0 ? "up" : q.d < 0 ? "down" : ""), signedUsd(q.d)), pill(S.pageSym, true));
    ch.append(el("span", "when", "today · " + (isLive() ? "live" : q && q.t ? "as of " + clock(q.t * 1000) : statusLabel())));
  }
  const grid = $("pg-grid");
  if (grid) {
    const m = yearCache.get(S.pageSym);
    const cells = [
      ["Open", q && q.o], ["Previous close", q && q.pc],
      ["Day high", q && q.h], ["Day low", q && q.l],
      ["52-week high", m && m.hi], ["52-week low", m && m.lo]
    ];
    grid.textContent = "";
    for (const [label, v] of cells) {
      const c = el("div", "cell");
      c.append(el("span", null, label), el("b", null, usd(v)));
      grid.append(c);
    }
  }
}
export function openPage(sym) {
  const page = $("page");
  S.pageSym = sym;
  const w = watchOf(sym) || { sym, name: sym };
  page.hidden = false;
  resetScrub();
  pushOverlay(() => { page.hidden = true; S.pageSym = null; resetScrub(); liveSync(); });
  liveSync();

  const head = $("pg-head");
  head.textContent = "";
  const logo = el("span", "logo");
  logoInto(logo, sym);
  const id = el("span", "pg-id");
  id.append(el("b", null, sym), el("small", null, w.name));
  const wb = el("button", "watchbtn");
  wb.type = "button";
  wb.id = "pg-watch";
  wb.addEventListener("click", () => {
    if (watchOf(sym)) {
      if (wb.dataset.armed !== "1") { wb.dataset.armed = "1"; wb.textContent = "Tap to remove"; setTimeout(() => { wb.dataset.armed = ""; paintWatchBtn(); }, 3500); return; }
      wb.dataset.armed = "";
      removeStock(sym);
    } else addStock(sym, w.name);
    paintWatchBtn();
  });
  head.append(logo, id, wb);
  paintWatchBtn();

  const body = $("pg-body");
  body.textContent = "";
  body.scrollTop = 0;
  const top = el("section", "sec");
  top.append(pxEl(sym, "big-px"));
  const ch = el("div", "line");
  ch.id = "pg-change";
  top.append(ch);
  const day = el("section", "sec");
  day.append(el("div", "lab", "Today's range"), rangeBar(sym, "day", true));
  const year = el("section", "sec");
  year.append(el("div", "lab", "52-week range"), rangeBar(sym, "year", true));
  const nums = el("section", "sec");
  const grid = el("div", "grid");
  grid.id = "pg-grid";
  nums.append(grid);
  body.append(top, chartSection(), day, year, nums, el("p", "about", "Today's range marks the open and the previous close. Prices come from Finnhub and can lag a little."));
  paintPageNumbers();

  if (!getKey()) return;
  fh("/quote", { symbol: sym }, { high: true }).then((q) => {
    if (!(q && q.c > 0)) return;
    const keep = quotes.get(sym);
    if (!(keep && isLive() && keep.t >= q.t)) quotes.set(sym, Object.assign({}, q));
    recordQuote(sym, q);
    if (S.pageSym === sym) { paintPageNumbers(); body.querySelectorAll(".rng").forEach(paintRange); body.querySelectorAll(".px").forEach((n) => { n.textContent = usd(quotes.get(sym).c); }); }
  }).catch(() => {});
  fh("/stock/metric", { symbol: sym, metric: "all" }, { ttl: 12 * 3600e3, high: true }).then((j) => {
    const m = asObj(j && j.metric);
    const hi = m["52WeekHigh"], lo = m["52WeekLow"];
    if (Number.isFinite(hi) && Number.isFinite(lo) && hi > lo) yearCache.set(sym, { hi, lo });
    if (S.pageSym === sym) { paintPageNumbers(); body.querySelectorAll('.rng[data-kind="year"]').forEach(paintRange); }
  }).catch(() => {});
  profile(sym, true).then(() => paintLogos(sym)).catch(() => {});
}
