/* Charts drawn from the recorded history: the price page chart and the watchlist sparklines. */
import { $, el, usd } from "./util.js";
import { OPEN_MIN, CLOSE_MIN, minLabel, dayLabel } from "./time.js";
import { S, quotes } from "./state.js";
import { series } from "./history.js";
import { regular } from "./market.js";
import { sessionDay } from "./quote.js";

/* ---------- pure geometry (unit-tested) ---------- */

/** Line path through recorded points. Gaps longer than 15 minutes (Tangent wasn't open) go into a
    separate path that's drawn dashed, so a straight line never pretends to be data. Numbers only:
    no text goes into the SVG. */
export function linePaths(pts, x, y) {
  let solid = "", gaps = "";
  pts.forEach(([m, p], i) => {
    const X = x(m).toFixed(1), Y = y(p).toFixed(1);
    if (i === 0) { solid += "M" + X + " " + Y; return; }
    const [pm, pp] = pts[i - 1];
    if (m - pm > 15) { gaps += "M" + x(pm).toFixed(1) + " " + y(pp).toFixed(1) + "L" + X + " " + Y; solid += "M" + X + " " + Y; }
    else solid += "L" + X + " " + Y;
  });
  return { solid, gaps };
}
/** Maps a price to a y between top and bottom, fitting the points and the previous close with a margin. */
export function yScale(pts, pc, top, bottom) {
  let lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  if (pc > 0) { lo = Math.min(lo, pc); hi = Math.max(hi, pc); }
  if (hi - lo < hi * 0.002) { const mid = (hi + lo) / 2; lo = mid * 0.999; hi = mid * 1.001; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  return (p) => bottom - ((p - lo) / (hi - lo)) * (bottom - top);
}

/** The previous close a day's chart is measured against: recorded with that day, or the quote's own
    when the quote is from that same day. null when unknown (then the chart has no baseline or color). */
export function closeFor(s, q) {
  if (s.pc > 0) return s.pc;
  return q && q.pc > 0 && sessionDay(q) === s.day ? q.pc : null;
}

/* ---------- watchlist sparkline, once a day has enough points ---------- */

export const SPARK_MIN_POINTS = 10;
export function paintViz(box) {
  const sym = box.dataset.sym;
  const s = series(sym);
  if (!s || s.pts.length < SPARK_MIN_POINTS) { box.hidden = true; return; }
  box.hidden = false;
  const spark = box.querySelector(".spark");
  const W = 60, H = 24, pc = closeFor(s, quotes.get(sym));
  const x = (m) => ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * W;
  const y = yScale(s.pts, pc, 2, H - 2);
  const { solid, gaps } = linePaths(s.pts, x, y);
  const last = s.pts[s.pts.length - 1][1];
  spark.classList.toggle("up", pc > 0 && last > pc);
  spark.classList.toggle("down", pc > 0 && last < pc);
  spark.innerHTML = (pc > 0 ? '<path class="base" d="M0 ' + y(pc).toFixed(1) + "H" + W + '"/>' : "") + '<path class="gap" d="' + gaps + '"/><path class="ln" d="' + solid + '"/>';
}
export function vizEl(sym) {
  const box = el("span", "viz");
  box.dataset.sym = sym;
  const spark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  spark.setAttribute("class", "spark");
  spark.setAttribute("viewBox", "0 0 60 24");
  spark.setAttribute("aria-hidden", "true");
  box.append(spark);
  paintViz(box);
  return box;
}

/* ---------- the price page chart. Drawn at the box's real pixel size so the dot and lines stay crisp. ---------- */

/* While a finger (or the mouse) is on the chart, the stock page's headline shows that moment instead
   of the latest price. */
let scrubMin = null, scrubbed = null, onScrub = null;
export function resetScrub() { scrubMin = null; scrubbed = null; }
/** The point under the finger: { min, price, day, pc }, or null when not scrubbing. */
export const scrubPoint = () => scrubbed;
export function paintChart() {
  const box = $("pg-chart");
  if (!box || !S.pageSym) return;
  const sym = S.pageSym, s = series(sym);
  const lab = $("pg-chart-lab"), note = $("pg-chart-note");
  const svg = box.querySelector("svg");
  if (!s || s.pts.length < 2) {
    scrubbed = null;
    svg.innerHTML = "";
    box.classList.add("empty");
    lab.textContent = "Today";
    note.textContent = regular() ? "The chart fills in while Tangent is open. Keep it open to watch the day build." : "The chart fills in while Tangent is open during market hours.";
    box.setAttribute("aria-label", "No chart yet");
    return;
  }
  box.classList.remove("empty");
  const pc = closeFor(s, quotes.get(sym));
  const W = Math.max(200, box.clientWidth), H = 180, T = 10, B = H - 10;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  const x = (m) => ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * W;
  const y = yScale(s.pts, pc, T, B);
  const { solid, gaps } = linePaths(s.pts, x, y);
  const [lm, lp] = s.pts[s.pts.length - 1];
  const dir = pc > 0 ? (lp > pc ? "up" : lp < pc ? "down" : "") : "";
  box.classList.toggle("up", dir === "up");
  box.classList.toggle("down", dir === "down");
  const area = solid && !gaps ? solid + "L" + x(lm).toFixed(1) + " " + B + "L" + x(s.pts[0][0]).toFixed(1) + " " + B + "Z" : "";
  let html = "";
  if (area) html += '<path class="area" d="' + area + '"/>';
  if (pc > 0) html += '<path class="base" d="M0 ' + y(pc).toFixed(1) + "H" + W + '"/>';
  html += '<path class="gap" d="' + gaps + '"/><path class="ln" d="' + solid + '"/>';
  scrubbed = null;
  if (scrubMin != null) {
    let best = s.pts[0];
    for (const p of s.pts) if (Math.abs(p[0] - scrubMin) < Math.abs(best[0] - scrubMin)) best = p;
    scrubbed = { min: best[0], price: best[1], day: s.day, pc };
    html += '<path class="cursor" d="M' + x(best[0]).toFixed(1) + " " + T + "V" + B + '"/><circle class="dot" r="4.5" cx="' + x(best[0]).toFixed(1) + '" cy="' + y(best[1]).toFixed(1) + '"/>';
  } else {
    html += '<circle class="dot now" r="4.5" cx="' + x(lm).toFixed(1) + '" cy="' + y(lp).toFixed(1) + '"/>';
  }
  svg.innerHTML = html;
  lab.textContent = dayLabel(s.day);
  const first = s.pts.find((p) => p[0] > OPEN_MIN) || s.pts[0];
  note.textContent = first[0] > OPEN_MIN + 15 || gaps ? "Recorded on this phone. Dashed parts are times Tangent wasn't open." : "Recorded on this phone from Finnhub prices.";
  box.setAttribute("aria-label", dayLabel(s.day) + ": " + s.pts.length + " minutes recorded, from " + usd(s.pts[0][1]) + " at " + minLabel(s.pts[0][0]) + " to " + usd(lp) + " at " + minLabel(lm) + " New York time" + (pc > 0 ? ", previous close " + usd(pc) : ""));
}
/** The chart's section. scrubbed() is called whenever the finger moves to another point or lets go. */
export function chartSection(scrubbed) {
  onScrub = scrubbed || null;
  const sec = el("section", "sec chart-sec");
  const head = el("div", "chart-head");
  const lab = el("h3", "lab", "Today");
  lab.id = "pg-chart-lab";
  head.append(lab);
  const box = el("div", "chart");
  box.id = "pg-chart";
  box.setAttribute("role", "img");
  box.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  const axis = el("div", "chart-axis");
  for (const [m, t] of [[OPEN_MIN, "9:30 AM"], [720, "12 PM"], [CLOSE_MIN, "4 PM ET"]]) {
    const s = el("span", null, t);
    s.style.left = ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * 100 + "%";
    axis.append(s);
  }
  const note = el("p", "fine");
  note.id = "pg-chart-note";
  const changed = () => (onScrub ? onScrub() : paintChart());
  const scrub = (e) => {
    if (box.classList.contains("empty")) return;
    const r = box.getBoundingClientRect();
    scrubMin = Math.round(OPEN_MIN + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (CLOSE_MIN - OPEN_MIN));
    changed();
  };
  const stop = () => { if (scrubMin == null) return; scrubMin = null; changed(); };
  box.addEventListener("pointerdown", scrub);
  box.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) scrub(e); });
  box.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") stop(); });
  box.addEventListener("pointerleave", stop);
  box.addEventListener("pointercancel", stop);
  sec.append(head, box, axis, note);
  return sec;
}
