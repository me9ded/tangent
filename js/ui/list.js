/* Today's movers and the watchlist. */
import { $, el, usd, pct } from "../util.js";
import { S, quotes, getKey, saveWatch } from "../state.js";
import { dpOf } from "../market.js";
import { cachedProfile } from "../finnhub.js";
import { logoInto } from "../logos.js";
import { vizEl, paintViz } from "../chart.js";
import { pill, pxEl, paintPill } from "./bits.js";
import { showToast } from "./toast.js";
import { openPage } from "./stock.js";

function moverRows() {
  return S.watch.map((w) => ({ sym: w.sym, name: w.name, dp: dpOf(w.sym), c: (quotes.get(w.sym) || {}).c })).filter((r) => r.dp != null).sort((a, b) => b.dp - a.dp);
}
export function renderSummary() {
  const box = $("sum");
  const rows = moverRows();
  if (!getKey() || rows.length < 2) { box.hidden = true; return; }
  box.hidden = false;
  const up = rows.filter((r) => r.dp > 0).length;
  const best = rows[0], worst = rows[rows.length - 1];
  $("sum-h").textContent = best.dp > 0 ? best.name + " leads, " + pct(best.dp) : "A red day: nothing on your list is up";
  $("sum-p").textContent = up + " of " + rows.length + " up today" + (worst.dp < 0 ? " · " + worst.name + " is weakest at " + pct(worst.dp) : "") + ".";
  const mv = $("mv");
  mv.textContent = "";
  const max = Math.max(0.5, ...rows.map((r) => Math.abs(r.dp)));
  // Long lists show the four biggest gainers and the four biggest losers; the full list is right below.
  const shown = rows.length > 8 ? [...rows.slice(0, 4), null, ...rows.slice(-4)] : rows;
  for (const r of shown) {
    if (!r) { mv.append(el("div", "mv-gap")); continue; }
    const b = el("button", "mv-row " + (r.dp > 0 ? "up" : r.dp < 0 ? "down" : "flat"));
    b.type = "button";
    const bar = el("span", "mv-bar");
    const fill = el("i");
    fill.style.width = (Math.abs(r.dp) / max) * 50 + "%";
    bar.append(fill);
    b.append(el("span", "mv-sym", r.sym), bar, el("span", "mv-val", pct(r.dp)));
    b.setAttribute("aria-label", r.name + " " + pct(r.dp) + " at " + usd(r.c));
    b.addEventListener("click", () => openPage(r.sym));
    mv.append(b);
  }
}

function sorted() {
  const list = S.watch.slice();
  if (S.sortMode === "az") list.sort((a, b) => a.sym.localeCompare(b.sym));
  else if (S.sortMode === "moves") list.sort((a, b) => (dpOf(b.sym) ?? -1e9) - (dpOf(a.sym) ?? -1e9));
  return list;
}
/* Rows are kept per symbol and only repainted, so a refresh doesn't rebuild logos or flicker. */
const rows = new Map();
const GRIP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';
function makeRow(w) {
  const li = el("li");
  li.dataset.sym = w.sym;
  const grip = el("button", "wl-grip");
  grip.type = "button";
  grip.innerHTML = GRIP_ICON;
  grip.setAttribute("aria-label", "Move " + w.sym + ". Drag, or use the up and down arrow keys.");
  grip.addEventListener("pointerdown", (e) => startDrag(e, li));
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const from = S.watch.findIndex((x) => x.sym === w.sym);
    moveStock(from, from + (e.key === "ArrowUp" ? -1 : 1), true);
  });
  const row = el("button", "wl-row");
  row.type = "button";
  const logo = el("span", "logo");
  logoInto(logo, w.sym);
  const id = el("span", "wl-id");
  id.append(el("b", null, w.sym), el("small", null, w.name));
  row.append(logo, id, vizEl(w.sym));
  row.setAttribute("aria-label", w.name + ", open price page");
  row.addEventListener("click", () => openPage(w.sym));
  const px = el("div", "wl-px");
  px.append(pxEl(w.sym), pill(w.sym));
  px.addEventListener("click", () => openPage(w.sym));
  li.append(grip, row, px);
  return li;
}
function paintRow(li) {
  const sym = li.dataset.sym;
  const q = quotes.get(sym);
  li.querySelectorAll(".px").forEach((n) => { n.textContent = q ? usd(q.c) : "–"; });
  li.querySelectorAll(".chg").forEach(paintPill);
  li.querySelectorAll(".viz").forEach(paintViz);
  const logo = li.querySelector(".logo");
  if (logo && !logo.classList.contains("has-logo") && (cachedProfile(sym) || {}).logo) logoInto(logo, sym);
}
export function renderList() {
  document.querySelectorAll("#sort button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sort === S.sortMode ? "true" : "false"));
  const ul = $("wl");
  ul.classList.toggle("reorder", S.sortMode === "mine" && S.watch.length > 1);
  const list = sorted();
  const keep = new Set(list.map((w) => w.sym));
  for (const [s, li] of rows) if (!keep.has(s)) { li.remove(); rows.delete(s); }
  const focused = document.activeElement;
  list.forEach((w, i) => {
    let li = rows.get(w.sym);
    if (!li) { li = makeRow(w); rows.set(w.sym, li); }
    else paintRow(li);
    if (ul.children[i] !== li) ul.insertBefore(li, ul.children[i] || null);
  });
  // Moving a node can drop focus; put it back (keyboard reordering relies on this).
  if (focused && focused !== document.activeElement && ul.contains(focused)) focused.focus({ preventScroll: true });
  $("wl-count").textContent = S.watch.length + (S.watch.length === 1 ? " stock" : " stocks");
}

/* Reordering, for the "Mine" sort. */
function moveStock(from, to, announce) {
  const watch = S.watch;
  if (from < 0 || from >= watch.length) return;
  to = Math.max(0, Math.min(watch.length - 1, to));
  if (to === from) return;
  const [w] = watch.splice(from, 1);
  watch.splice(to, 0, w);
  saveWatch();
  renderList();
  if (announce) showToast(w.sym + " moved to " + (to + 1) + " of " + watch.length, 1400);
}
function startDrag(e, li) {
  if (S.sortMode !== "mine" || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const grip = e.currentTarget;
  try { grip.setPointerCapture(e.pointerId); } catch (err) {}
  const main = $("main");
  const items = [...$("wl").children];
  const from = items.indexOf(li);
  if (from < 0) return;
  const scroll0 = main.scrollTop;
  // Positions in scroll-content coordinates, so autoscrolling while dragging stays correct.
  const mids = items.map((n) => { const r = n.getBoundingClientRect(); return r.top + scroll0 + r.height / 2; });
  const h = li.getBoundingClientRect().height;
  const y0 = e.clientY + scroll0;
  let lastY = e.clientY, to = from, raf = 0, done = false;
  li.classList.add("dragging");
  document.body.classList.add("dragging-row");
  const layout = () => {
    const dy = lastY + main.scrollTop - y0;
    li.style.transform = "translateY(" + dy + "px)";
    const mid = mids[from] + dy;
    to = from;
    for (let i = 0; i < items.length; i++) {
      if (i < from && mid < mids[i]) { to = i; break; }
    }
    for (let i = items.length - 1; i > from; i--) {
      if (mid > mids[i]) { to = i; break; }
    }
    items.forEach((n, i) => {
      if (i === from) return;
      const shift = from < to && i > from && i <= to ? -h : from > to && i >= to && i < from ? h : 0;
      n.style.transform = shift ? "translateY(" + shift + "px)" : "";
    });
  };
  const edge = () => {
    if (done) return;
    const r = main.getBoundingClientRect();
    const step = lastY < r.top + 56 ? -10 : lastY > r.bottom - 56 ? 10 : 0;
    if (step) { main.scrollTop += step; layout(); }
    raf = requestAnimationFrame(edge);
  };
  const move = (ev) => { lastY = ev.clientY; layout(); };
  const end = () => {
    done = true;
    cancelAnimationFrame(raf);
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", end);
    items.forEach((n) => { n.style.transform = ""; });
    li.classList.remove("dragging");
    document.body.classList.remove("dragging-row");
    moveStock(from, to, false);
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  raf = requestAnimationFrame(edge);
}
