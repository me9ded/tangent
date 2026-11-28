/* Small pieces drawn in several places: changes, prices and range bars. */
import { el, usd, store } from "../util.js";
import { S, quotes, yearCache, nameOf } from "../state.js";
import { sessionDay, onDay, dayShort } from "../quote.js";
import { nyClock } from "../time.js";

export const dirOf = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
const ARROW = { up: "▲", down: "▼" };
/** A change as text with ▲ or ▼ (screen readers hear "up" or "down" instead of the triangle). */
export function chgInto(node, v, text) {
  node.textContent = "";
  const dir = dirOf(v);
  if (dir) {
    const a = el("span", "arr", ARROW[dir] + " ");
    a.setAttribute("aria-hidden", "true");
    node.append(a, el("span", "sr", dir === "up" ? "Up " : "Down "));
  }
  node.append(text);
}
export const pctAbs = (v) => Math.abs(v).toFixed(2) + "%";
/** "$2.00 (1.01%)" without a sign; the arrow carries the direction. */
export const bothAbs = (d, dp) => usd(Math.abs(d)) + " (" + pctAbs(dp) + ")";

/** The change on a watchlist row: percent or dollars (tap to switch), plus the day when that row's
    numbers are from an older session than the rest of the list. */
export function paintChg(b) {
  const sym = b.dataset.sym, q = quotes.get(sym);
  const v = q && Number.isFinite(q.dp) ? q.dp : null;
  if (v == null) { b.classList.remove("up", "down"); b.textContent = "–"; b.setAttribute("aria-label", "No change data for " + sym); return; }
  const usdMode = S.chgMode === "usd";
  const d = Number.isFinite(q.d) ? q.d : 0;
  // Up or down by the number shown, rounded, so "0.00%" is never green or red (but a big stock's
  // +$28.00 still is when its percent rounds to 0.00%).
  const r2 = (x) => Math.round(x * 100) / 100;
  const shown = usdMode ? r2(d) : r2(v);
  b.classList.toggle("up", shown > 0);
  b.classList.toggle("down", shown < 0);
  const val = el("span", null);
  chgInto(val, shown, usdMode ? usd(Math.abs(d)) : pctAbs(v));
  b.textContent = "";
  b.append(val);
  const today = nyClock().day, day = sessionDay(q);
  if (day && S.listDay && day < S.listDay) b.append(el("span", "tag", dayShort(day, today)));
  const dir = Math.sign(r2(v) || r2(d));
  b.setAttribute("aria-label", nameOf(sym) + (dir > 0 ? " up " : dir < 0 ? " down " : " unchanged, ") + pctAbs(v) + ", " + usd(Math.abs(d)) + " " + onDay(day, today) + ". Tap to switch percent or dollars.");
}
export function chgButton(sym) {
  const b = el("button", "chg");
  b.type = "button";
  b.dataset.sym = sym;
  paintChg(b);
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    S.chgMode = S.chgMode === "pct" ? "usd" : "pct";
    store.set("chgMode", S.chgMode);
    document.querySelectorAll("button.chg[data-sym]").forEach(paintChg);
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
  box.setAttribute("role", "img");
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
  if (!v || !(Number.isFinite(v.lo) && Number.isFinite(v.hi) && v.hi > v.lo && Number.isFinite(v.cur))) {
    box.textContent = "";
    box.classList.add("empty");
    box.setAttribute("aria-label", "No range yet");
    return;
  }
  box.classList.remove("empty");
  const at = (x) => Math.max(0, Math.min(100, ((x - v.lo) / (v.hi - v.lo)) * 100)) + "%";
  // Built once, then only moved, so live ticks don't churn the page.
  let track = box.querySelector(".rng-track");
  if (!track) {
    track = el("div", "rng-track");
    for (const m of v.marks) { const t = el("i", "rng-mark"); t.dataset.mark = m.label; track.append(t); }
    track.append(el("b", "rng-dot"));
    box.append(track);
    if (box.classList.contains("big")) { const lab = el("div", "rng-labels"); lab.append(el("span"), el("span")); box.append(lab); }
  }
  for (const m of v.marks) {
    const t = track.querySelector('[data-mark="' + m.label + '"]');
    if (!t) continue;
    t.hidden = !Number.isFinite(m.v);
    if (Number.isFinite(m.v)) { t.style.left = at(m.v); t.title = m.label + " " + usd(m.v); }
  }
  track.querySelector(".rng-dot").style.left = at(v.cur);
  const lab = box.querySelector(".rng-labels");
  if (lab) { lab.children[0].textContent = usd(v.lo); lab.children[1].textContent = usd(v.hi); }
  const marks = v.marks.filter((m) => Number.isFinite(m.v)).map((m) => ", " + m.label.toLowerCase() + " " + usd(m.v)).join("");
  box.setAttribute("aria-label", "From " + usd(v.lo) + " to " + usd(v.hi) + ", now " + usd(v.cur) + marks);
}
