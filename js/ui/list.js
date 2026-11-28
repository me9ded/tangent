/* The watchlist. Rows are kept per symbol and repainted in place, so a refresh doesn't rebuild logos
   or flicker. In "Moves" order rows slide to their new places, but never while a finger is on the
   list. Swipe a row left to remove it (Undo puts it back); in "Mine" order, drag the handle. */
import { $, el, usd, reduced } from "../util.js";
import { S, quotes, saveWatch } from "../state.js";
import { dpOf } from "../market.js";
import { cachedProfile } from "../finnhub.js";
import { logoInto } from "../logos.js";
import { vizEl, paintViz } from "../chart.js";
import { chgButton, pxEl, paintChg } from "./bits.js";
import { showToast } from "./toast.js";
import { openPage } from "./stock.js";
import { removeStock } from "./watch.js";

function sorted() {
  const list = S.watch.slice();
  if (S.sortMode === "az") list.sort((a, b) => a.sym.localeCompare(b.sym));
  else if (S.sortMode === "moves") list.sort((a, b) => (dpOf(b.sym) ?? -1e9) - (dpOf(a.sym) ?? -1e9));
  return list;
}
const rows = new Map();
const GRIP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';

/* ---------- don't move rows under a finger ---------- */
const SETTLE_MS = 1000;
let touching = false, quietAt = 0, retryT = 0;
const busy = () => touching || Date.now() < quietAt;

function makeRow(w) {
  const li = el("li");
  li.dataset.sym = w.sym;
  const del = el("button", "wl-del", "Remove");
  del.type = "button";
  // A touch shortcut; the stock page's Watching button does the same for keyboards and screen readers.
  del.tabIndex = -1;
  del.setAttribute("aria-hidden", "true");
  del.addEventListener("click", (e) => { e.stopPropagation(); swipeAway(li); });
  const main = el("div", "wl-main");
  const grip = el("button", "wl-grip");
  grip.type = "button";
  grip.innerHTML = GRIP_ICON;
  grip.setAttribute("aria-label", "Move " + w.sym + ". Drag, or use the up and down arrow keys.");
  grip.addEventListener("pointerdown", (e) => startDrag(e, li));
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const from = S.watch.findIndex((x) => x.sym === w.sym);
    moveStock(from, from + (e.key === "ArrowUp" ? -1 : 1), { announce: true });
  });
  const row = el("button", "wl-row");
  row.type = "button";
  const logo = el("span", "logo");
  logoInto(logo, w.sym);
  const id = el("span", "wl-id");
  id.append(el("b", null, w.sym), el("small", null, w.name));
  row.append(logo, id, vizEl(w.sym));
  row.setAttribute("aria-label", w.name + ", open price page");
  row.addEventListener("click", () => openPage(w.sym, { opener: row }));
  const px = el("div", "wl-px");
  px.append(pxEl(w.sym), chgButton(w.sym));
  px.addEventListener("click", () => openPage(w.sym, { opener: row }));
  main.append(grip, row, px);
  li.append(del, main);
  initSwipe(li, main);
  return li;
}
function paintRow(li) {
  const sym = li.dataset.sym;
  const q = quotes.get(sym);
  li.querySelectorAll(".px").forEach((n) => { n.textContent = q ? usd(q.c) : "–"; });
  li.querySelectorAll("button.chg").forEach(paintChg);
  li.querySelectorAll(".viz").forEach(paintViz);
  const logo = li.querySelector(".logo");
  if (logo && !logo.classList.contains("has-logo") && (cachedProfile(sym) || {}).logo) logoInto(logo, sym);
}

/** Draws the list. opts.now skips the wait for fingers (the person asked for this order);
    opts.flip: false skips the slide (a drag already put the row where it goes). */
export function renderList(opts = {}) {
  document.querySelectorAll("#sort button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sort === S.sortMode ? "true" : "false"));
  const ul = $("wl");
  ul.classList.toggle("reorder", S.sortMode === "mine" && S.watch.length > 1);
  const list = sorted();
  const keep = new Set(list.map((w) => w.sym));
  for (const [s, li] of rows) if (!keep.has(s)) { if (li === openRow) openRow = null; li.remove(); rows.delete(s); }
  for (const w of list) {
    const li = rows.get(w.sym);
    if (li) paintRow(li);
    else rows.set(w.sym, makeRow(w));
  }
  $("wl-count").textContent = S.watch.length + (S.watch.length === 1 ? " stock" : " stocks");

  const want = list.map((w) => rows.get(w.sym));
  const shown = [...ul.children];
  const placed = want.filter((li) => li.isConnected);
  const moved = placed.some((li, i) => shown[i] !== li);
  if (moved && !opts.now && S.sortMode === "moves" && busy()) {
    // Someone's touching or scrolling the list: add new rows at the end now, reorder once it's quiet.
    for (const li of want) if (!li.isConnected) ul.append(li);
    clearTimeout(retryT);
    retryT = setTimeout(() => renderList(), Math.max(120, quietAt - Date.now() + 50));
    return;
  }
  if (moved && openRow) closeSwipe(openRow);
  const flip = moved && opts.flip !== false && !reduced && typeof Element.prototype.animate === "function";
  const before = flip ? new Map(placed.map((li) => [li, li.getBoundingClientRect().top])) : null;
  const focused = document.activeElement;
  want.forEach((li, i) => { if (ul.children[i] !== li) ul.insertBefore(li, ul.children[i] || null); });
  // Moving a node can drop focus; put it back (keyboard reordering relies on this).
  if (focused && focused !== document.activeElement && ul.contains(focused)) focused.focus({ preventScroll: true });
  if (before) for (const [li, top] of before) {
    const dy = top - li.getBoundingClientRect().top;
    if (Math.abs(dy) > 0.5) li.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "translateY(0)" }], { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }
}

/* ---------- swipe left to remove ---------- */
const REVEAL = 96;
let openRow = null;
function setSwipe(li, x) {
  li.querySelector(".wl-main").style.transform = x ? "translateX(" + x + "px)" : "";
  li.classList.toggle("open", x !== 0);
  if (x) openRow = li;
  else if (openRow === li) openRow = null;
}
export function closeSwipe(li) { li.querySelector(".wl-main").classList.add("settle"); setSwipe(li, 0); }
function swipeAway(li) {
  const main = li.querySelector(".wl-main");
  main.classList.add("settle");
  main.style.transform = "translateX(" + -li.offsetWidth + "px)";
  setTimeout(() => removeStock(li.dataset.sym), reduced ? 0 : 200);
}
function initSwipe(li, main) {
  let sx = 0, sy = 0, x = 0, base = 0, w = 0, mode = null, pid = null;
  main.addEventListener("pointerdown", (e) => {
    if (mode || e.button !== 0 || e.target.closest(".wl-grip") || $("wl").classList.contains("dragging")) return;
    if (openRow && openRow !== li) closeSwipe(openRow);
    sx = e.clientX; sy = e.clientY; pid = e.pointerId; mode = "maybe";
    base = li.classList.contains("open") ? -REVEAL : 0;
    w = li.offsetWidth;
  });
  main.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid || !mode) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === "maybe") {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { mode = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (!base && dx > 0) { mode = null; return; }
      mode = "swipe";
      try { main.setPointerCapture(pid); } catch (err) {}
      main.classList.remove("settle");
    }
    x = Math.min(0, Math.max(-w, base + dx));
    main.style.transform = "translateX(" + x + "px)";
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    const was = mode;
    mode = null;
    pid = null;
    if (was !== "swipe") return;
    li._swipedAt = Date.now();
    main.classList.add("settle");
    if (e.type === "pointercancel") setSwipe(li, 0);
    else if (x < -w * 0.5) swipeAway(li);
    else setSwipe(li, x < -REVEAL / 2 ? -REVEAL : 0);
  };
  main.addEventListener("pointerup", end);
  main.addEventListener("pointercancel", end);
  // The tap that ends a swipe, or a tap on a row that's swiped open, shouldn't open the stock.
  li.addEventListener("click", (e) => {
    if (e.target.closest(".wl-del")) return;
    const justSwiped = Date.now() - (li._swipedAt || 0) < 350;
    if (!justSwiped && !li.classList.contains("open")) return;
    e.stopPropagation();
    e.preventDefault();
    if (!justSwiped) closeSwipe(li);
  }, true);
}

/* ---------- reordering, for the "Mine" sort ---------- */
function moveStock(from, to, opts = {}) {
  const watch = S.watch;
  if (from < 0 || from >= watch.length) return;
  to = Math.max(0, Math.min(watch.length - 1, to));
  if (to === from) return;
  const [w] = watch.splice(from, 1);
  watch.splice(to, 0, w);
  saveWatch();
  renderList({ now: true, flip: opts.flip });
  if (opts.announce) showToast(w.sym + " moved to " + (to + 1) + " of " + watch.length, 1400);
}
function startDrag(e, li) {
  if (S.sortMode !== "mine" || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const grip = e.currentTarget;
  try { grip.setPointerCapture(e.pointerId); } catch (err) {}
  const view = $("v-home");
  const ul = $("wl");
  const items = [...ul.children];
  const from = items.indexOf(li);
  if (from < 0) return;
  const scroll0 = view.scrollTop;
  // Positions in scroll-content coordinates, so autoscrolling while dragging stays correct.
  const mids = items.map((n) => { const r = n.getBoundingClientRect(); return r.top + scroll0 + r.height / 2; });
  const h = li.getBoundingClientRect().height;
  const y0 = e.clientY + scroll0;
  let lastY = e.clientY, to = from, raf = 0, done = false;
  li.classList.add("dragging");
  ul.classList.add("dragging");
  document.body.classList.add("dragging-row");
  const layout = () => {
    const dy = lastY + view.scrollTop - y0;
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
    const r = view.getBoundingClientRect();
    const step = lastY < r.top + 56 ? -10 : lastY > r.bottom - 56 ? 10 : 0;
    if (step) { view.scrollTop += step; layout(); }
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
    ul.classList.remove("dragging");
    document.body.classList.remove("dragging-row");
    moveStock(from, to, { flip: false });
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  raf = requestAnimationFrame(edge);
}

export function initList() {
  const ul = $("wl"), view = $("v-home");
  const quiet = () => { quietAt = Date.now() + SETTLE_MS; };
  ul.addEventListener("pointerdown", () => { touching = true; quiet(); });
  for (const t of ["pointerup", "pointercancel"]) window.addEventListener(t, () => { if (touching) { touching = false; quiet(); } });
  view.addEventListener("scroll", quiet, { passive: true });
  // A tap anywhere else closes a row that's swiped open.
  document.addEventListener("pointerdown", (e) => { if (openRow && !openRow.contains(e.target)) closeSwipe(openRow); }, true);
}
