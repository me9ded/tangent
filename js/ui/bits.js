/* Small pieces drawn in several places: the change pill, a price, and range bars. */
import { el, usd, store } from "../util.js";
import { S, quotes, yearCache } from "../state.js";

export function paintPill(b) {
  const q = quotes.get(b.dataset.sym);
  const v = q && Number.isFinite(q.dp) ? q.dp : null;
  b.classList.toggle("up", v > 0);
  b.classList.toggle("down", v < 0);
  const arrow = v > 0 ? "▲ " : v < 0 ? "▼ " : "";
  if (v == null) b.textContent = "–";
  else if (S.chgMode === "usd" && !b.classList.contains("fixed")) b.textContent = arrow + usd(Math.abs(q.d));
  else b.textContent = arrow + Math.abs(v).toFixed(2) + "%";
  b.setAttribute("aria-label", v == null ? "No change data" : (v >= 0 ? "Up " : "Down ") + Math.abs(v).toFixed(2) + " percent, " + usd(Math.abs(q.d)) + ". Tap to switch percent or dollars.");
}
export function pill(sym, fixed) {
  const b = el("button", "chg" + (fixed ? " fixed big" : ""));
  b.type = "button";
  b.dataset.sym = sym;
  paintPill(b);
  if (!fixed) b.addEventListener("click", (e) => {
    e.stopPropagation();
    S.chgMode = S.chgMode === "pct" ? "usd" : "pct";
    store.set("chgMode", S.chgMode);
    document.querySelectorAll(".chg[data-sym]").forEach(paintPill);
  });
  return b;
}
export function pxEl(sym, cls) {
  const q = quotes.get(sym);
  const n = el("span", "px" + (cls ? " " + cls : ""), q ? usd(q.c) : "–");
  n.dataset.px = sym;
  return n;
}

/* A range bar: track from low to high, a dot at the current price, ticks for reference prices. */
export function rangeBar(sym, kind, big) {
  const box = el("div", "rng" + (big ? " big" : ""));
  box.dataset.sym = sym;
  box.dataset.kind = kind;
  paintRange(box);
  return box;
}
function rangeValues(box) {
  const q = quotes.get(box.dataset.sym);
  if (!q) return null;
  if (box.dataset.kind === "year") {
    const m = yearCache.get(box.dataset.sym);
    if (!m) return null;
    return { lo: Math.min(m.lo, q.c), hi: Math.max(m.hi, q.c), cur: q.c, marks: [] };
  }
  return { lo: q.l, hi: q.h, cur: q.c, marks: [{ v: q.o, label: "Open" }, { v: q.pc, label: "Previous close" }] };
}
export function paintRange(box) {
  const v = rangeValues(box);
  box.textContent = "";
  if (!v || !(Number.isFinite(v.lo) && Number.isFinite(v.hi) && v.hi > v.lo && Number.isFinite(v.cur))) { box.classList.add("empty"); return; }
  box.classList.remove("empty");
  const at = (x) => Math.max(0, Math.min(100, ((x - v.lo) / (v.hi - v.lo)) * 100));
  const track = el("div", "rng-track");
  for (const m of v.marks) {
    if (!Number.isFinite(m.v)) continue;
    const t = el("i", "rng-mark");
    t.style.left = at(m.v) + "%";
    t.title = m.label + " " + usd(m.v);
    track.append(t);
  }
  const dot = el("b", "rng-dot");
  dot.style.left = at(v.cur) + "%";
  track.append(dot);
  box.append(track);
  if (box.classList.contains("big")) {
    const lab = el("div", "rng-labels");
    lab.append(el("span", null, usd(v.lo)), el("span", null, usd(v.hi)));
    box.append(lab);
  }
  box.setAttribute("aria-label", "Range " + usd(v.lo) + " to " + usd(v.hi) + ", now " + usd(v.cur));
}
