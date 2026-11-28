/* The price page for one stock: a view pushed over the tabs (a dialog for screen readers) at #SYM,
   so a reload comes back to it and the back gesture closes it. Built once per open; after that the
   numbers update in place. Scrubbing the chart moves the headline to that moment. */
import { $, el, usd, asObj } from "../util.js";
import { S, quotes, yearCache, watchOf, names, nameOf, getKey } from "../state.js";
import { fh, profile } from "../finnhub.js";
import { recordQuote } from "../history.js";
import { nyClock, minLabel } from "../time.js";
import { mergeQuote, quoteWhen, dayShort } from "../quote.js";
import { logoInto, paintLogos } from "../logos.js";
import { chartSection, paintChart, resetScrub, scrubPoint } from "../chart.js";
import { liveSync, isLive } from "../live.js";
import { rangeBar, paintRange, chgInto, bothAbs, dirOf } from "./bits.js";
import { openLayer, isOpen, back } from "./layers.js";
import { addStock, removeStock } from "./watch.js";

const CELLS = [["o", "Open"], ["pc", "Previous close"], ["h", "Day high"], ["l", "Day low"], ["yh", "52-week high"], ["yl", "52-week low"]];

export function paintWatchBtn() {
  const wb = $("pg-watch");
  if (!S.pageSym || wb.dataset.armed === "1") return;
  const on = !!watchOf(S.pageSym);
  wb.setAttribute("aria-pressed", on ? "true" : "false");
  wb.textContent = on ? "Watching" : "Watch";
}
function paintDd(dd, d, dp) {
  dd.className = "dd";
  if (!Number.isFinite(d) || !Number.isFinite(dp)) { dd.textContent = ""; return; }
  const v = Math.round(d * 100) / 100;
  chgInto(dd, v, bothAbs(d, dp));
  dd.classList.toggle("up", v > 0);
  dd.classList.toggle("down", v < 0);
}
export function paintPageNumbers() {
  const sym = S.pageSym;
  if (!sym || !$("pg-px")) return;
  paintChart();
  const q = quotes.get(sym);
  const today = nyClock().day;
  const sp = scrubPoint();
  if (sp) {
    $("pg-px").textContent = usd(sp.price);
    paintDd($("pg-dd"), sp.pc > 0 ? sp.price - sp.pc : NaN, sp.pc > 0 ? ((sp.price - sp.pc) / sp.pc) * 100 : NaN);
    $("pg-when").textContent = (sp.day === today ? "Today" : dayShort(sp.day, today)) + " · " + minLabel(sp.min) + " ET";
  } else {
    $("pg-px").textContent = q ? usd(q.c) : "–";
    paintDd($("pg-dd"), q && q.d, q && q.dp);
    $("pg-when").textContent = q ? quoteWhen(q, today, isLive()) : "";
  }
  const m = yearCache.get(sym);
  const vals = { o: q && q.o, pc: q && q.pc, h: q && q.h, l: q && q.l, yh: m && m.hi, yl: m && m.lo };
  for (const [k] of CELLS) { const b = document.querySelector('#pg-grid [data-k="' + k + '"] b'); if (b) b.textContent = usd(vals[k]); }
}

export function openPage(sym, opts = {}) {
  const page = $("page");
  if (opts.name && !watchOf(sym)) names.set(sym, opts.name);
  const reopen = isOpen(page);
  S.pageSym = sym;
  resetScrub();

  const head = $("pg-head");
  head.textContent = "";
  const logo = el("span", "logo");
  logoInto(logo, sym);
  const id = el("div", "pg-id");
  const title = el("h2", null, sym);
  title.id = "pg-title";
  title.tabIndex = -1;
  const sub = el("small", null, nameOf(sym));
  id.append(title, sub);
  head.append(logo, id);
  $("pg-watch").dataset.armed = "";
  paintWatchBtn();

  const body = $("pg-body");
  body.textContent = "";
  body.scrollTop = 0;
  const top = el("section", "sec pg-hero");
  const px = el("div", "big-px");
  px.id = "pg-px";
  const line = el("p", "line");
  line.id = "pg-change";
  const dd = el("span", "dd");
  dd.id = "pg-dd";
  const when = el("span", "when");
  when.id = "pg-when";
  line.append(dd, when);
  top.append(px, line);
  const day = el("section", "sec");
  day.append(el("h3", "lab", "Today's range"), rangeBar(sym, "day", true));
  const year = el("section", "sec");
  year.append(el("h3", "lab", "52-week range"), rangeBar(sym, "year", true));
  const nums = el("section", "sec");
  const grid = el("div", "grid");
  grid.id = "pg-grid";
  for (const [k, label] of CELLS) {
    const c = el("div", "cell");
    c.dataset.k = k;
    c.append(el("span", null, label), el("b", null, "–"));
    grid.append(c);
  }
  nums.append(el("h3", "lab", "Stats"), grid);
  body.append(top, chartSection(paintPageNumbers), day, year, nums, el("p", "about", "Today's range marks the open and the previous close. Times are New York time (ET). Prices come from Finnhub and can lag a little."));
  paintPageNumbers();

  if (reopen) {
    try { history.replaceState(history.state, "", "#" + sym); } catch (e) {}
    title.focus({ preventScroll: true });
  } else {
    openLayer(page, { opener: opts.opener, focus: title, url: "#" + sym, onClose: () => { S.pageSym = null; resetScrub(); liveSync(); } });
  }
  liveSync();

  if (!getKey()) return;
  fh("/quote", { symbol: sym }, { high: true }).then((q) => {
    if (!(q && q.c > 0)) return;
    quotes.set(sym, mergeQuote(quotes.get(sym), q));
    recordQuote(sym, q);
    if (S.pageSym === sym) { paintPageNumbers(); body.querySelectorAll(".rng").forEach(paintRange); }
  }).catch(() => {});
  fh("/stock/metric", { symbol: sym, metric: "all" }, { ttl: 12 * 3600e3, high: true }).then((j) => {
    const m = asObj(j && j.metric);
    const hi = m["52WeekHigh"], lo = m["52WeekLow"];
    if (Number.isFinite(hi) && Number.isFinite(lo) && hi > lo) yearCache.set(sym, { hi, lo });
    if (S.pageSym === sym) { paintPageNumbers(); body.querySelectorAll('.rng[data-kind="year"]').forEach(paintRange); }
  }).catch(() => {});
  profile(sym, true).then((p) => {
    paintLogos(sym);
    if (p && typeof p.name === "string" && p.name && !watchOf(sym) && !names.has(sym)) {
      names.set(sym, p.name);
      if (S.pageSym === sym) sub.textContent = p.name;
    }
  }).catch(() => {});
}

export function initStock() {
  $("pg-back").addEventListener("click", back);
  const wb = $("pg-watch");
  wb.addEventListener("click", () => {
    const sym = S.pageSym;
    if (!sym) return;
    if (watchOf(sym)) {
      // Removing takes a second tap, so a stray tap doesn't drop a stock.
      if (wb.dataset.armed !== "1") {
        wb.dataset.armed = "1";
        wb.textContent = "Tap to remove";
        clearTimeout(wb._t);
        wb._t = setTimeout(() => { wb.dataset.armed = ""; paintWatchBtn(); }, 3500);
        return;
      }
      wb.dataset.armed = "";
      clearTimeout(wb._t);
      removeStock(sym);
    } else addStock(sym, nameOf(sym));
    paintWatchBtn();
  });
  window.addEventListener("resize", () => { if (S.pageSym) paintChart(); });
}
