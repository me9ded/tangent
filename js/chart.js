/* Charts drawn from the recorded history: the price page chart and the watchlist sparklines. */
import { $, el, usd } from "./util.js";
import { OPEN_MIN, CLOSE_MIN, minLabel, dayLabel } from "./time.js";
import { S, quotes } from "./state.js";
import { series } from "./history.js";
import { regular } from "./market.js";
import { rangeBar, paintRange } from "./ui/bits.js";

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

/* ---------- watchlist sparkline (in place of the range bar once a day has enough points) ---------- */

export const SPARK_MIN_POINTS = 10;
export function paintViz(box) {
  const sym = box.dataset.sym;
  const s = series(sym);
  const spark = box.querySelector(".spark"), rng = box.querySelector(".rng");
  // SVG elements have no .hidden property, so toggle the attribute.
  if (!s || s.pts.length < SPARK_MIN_POINTS) { spark.setAttribute("hidden", ""); rng.hidden = false; paintRange(rng); return; }
  rng.hidden = true;
  spark.removeAttribute("hidden");
  const W = 64, H = 22, q = quotes.get(sym) || {};
  const x = (m) => ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * W;
  const y = yScale(s.pts, q.pc, 2, H - 2);
  const { solid, gaps } = linePaths(s.pts, x, y);
  const last = s.pts[s.pts.length - 1][1];
  spark.classList.toggle("up", q.pc > 0 && last > q.pc);
  spark.classList.toggle("down", q.pc > 0 && last < q.pc);
  spark.innerHTML = (q.pc > 0 ? '<path class="base" d="M0 ' + y(q.pc).toFixed(1) + "H" + W + '"/>' : "") + '<path class="gap" d="' + gaps + '"/><path class="ln" d="' + solid + '"/>';
}
export function vizEl(sym) {
  const box = el("div", "viz");
  box.dataset.sym = sym;
  const spark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  spark.setAttribute("class", "spark");
  spark.setAttribute("viewBox", "0 0 64 22");
  spark.setAttribute("aria-hidden", "true");
  spark.setAttribute("hidden", "");
  box.append(rangeBar(sym, "day"), spark);
  paintViz(box);
  return box;
}

/* ---------- the price page chart. Drawn at the box's real pixel size so the dot and lines stay crisp. ---------- */

let scrubMin = null;
export function resetScrub() { scrubMin = null; }
export function paintChart() {
  const box = $("pg-chart");
  if (!box || !S.pageSym) return;
  const sym = S.pageSym, s = series(sym), q = quotes.get(sym) || {};
  const read = $("pg-chart-read"), lab = $("pg-chart-lab"), note = $("pg-chart-note");
  const svg = box.querySelector("svg");
  if (!s || s.pts.length < 2) {
    svg.innerHTML = "";
    box.classList.add("empty");
    lab.textContent = "Today";
    read.textContent = "";
    note.textContent = regular() ? "The chart fills in while Tangent is open. Keep it open to watch the day build." : "The chart fills in while Tangent is open during market hours.";
    return;
  }
  box.classList.remove("empty");
  const W = Math.max(200, box.clientWidth), H = 168, T = 10, B = H - 10;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  const x = (m) => ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * W;
  const y = yScale(s.pts, q.pc, T, B);
  const { solid, gaps } = linePaths(s.pts, x, y);
  const [lm, lp] = s.pts[s.pts.length - 1];
  const dir = q.pc > 0 ? (lp > q.pc ? "up" : lp < q.pc ? "down" : "") : "";
  box.classList.toggle("up", dir === "up");
  box.classList.toggle("down", dir === "down");
  const area = solid && !gaps ? solid + "L" + x(lm).toFixed(1) + " " + B + "L" + x(s.pts[0][0]).toFixed(1) + " " + B + "Z" : "";
  let html = "";
  if (area) html += '<path class="area" d="' + area + '"/>';
  if (q.pc > 0) html += '<path class="base" d="M0 ' + y(q.pc).toFixed(1) + "H" + W + '"/>';
  html += '<path class="gap" d="' + gaps + '"/><path class="ln" d="' + solid + '"/>';
  let readout = null;
  if (scrubMin != null) {
    let best = s.pts[0];
    for (const p of s.pts) if (Math.abs(p[0] - scrubMin) < Math.abs(best[0] - scrubMin)) best = p;
    readout = best;
    html += '<path class="cursor" d="M' + x(best[0]).toFixed(1) + " " + T + "V" + B + '"/><circle class="dot" r="4.5" cx="' + x(best[0]).toFixed(1) + '" cy="' + y(best[1]).toFixed(1) + '"/>';
  } else {
    html += '<circle class="dot now" r="4.5" cx="' + x(lm).toFixed(1) + '" cy="' + y(lp).toFixed(1) + '"/>';
  }
  svg.innerHTML = html;
  lab.textContent = dayLabel(s.day);
  read.textContent = readout ? minLabel(readout[0]) + " · " + usd(readout[1]) : "";
  const first = s.pts.find((p) => p[0] > OPEN_MIN) || s.pts[0];
  note.textContent = first[0] > OPEN_MIN + 15 || gaps ? "Recorded on this phone. Dashed parts are times Tangent wasn't open." : "Recorded on this phone from Finnhub prices.";
  box.setAttribute("aria-label", dayLabel(s.day) + ": " + s.pts.length + " minutes recorded, from " + usd(s.pts[0][1]) + " at " + minLabel(s.pts[0][0]) + " to " + usd(lp) + " at " + minLabel(lm) + (q.pc > 0 ? ", previous close " + usd(q.pc) : ""));
}
export function chartSection() {
  const sec = el("section", "sec chart-sec");
  const head = el("div", "chart-head");
  const lab = el("span", "lab", "Today");
  lab.id = "pg-chart-lab";
  const read = el("span", "chart-read");
  read.id = "pg-chart-read";
  head.append(lab, read);
  const box = el("div", "chart");
  box.id = "pg-chart";
  box.setAttribute("role", "img");
  box.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  const axis = el("div", "chart-axis");
  for (const [m, t] of [[OPEN_MIN, "9:30"], [720, "12:00"], [CLOSE_MIN, "4:00"]]) {
    const s = el("span", null, t);
    s.style.left = ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * 100 + "%";
    axis.append(s);
  }
  const note = el("p", "fine");
  note.id = "pg-chart-note";
  const scrub = (e) => {
    const r = box.getBoundingClientRect();
    scrubMin = Math.round(OPEN_MIN + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (CLOSE_MIN - OPEN_MIN));
    paintChart();
  };
  const stop = () => { if (scrubMin == null) return; scrubMin = null; paintChart(); };
  box.addEventListener("pointerdown", scrub);
  box.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) scrub(e); });
  box.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") stop(); });
  box.addEventListener("pointerleave", stop);
  box.addEventListener("pointercancel", stop);
  sec.append(head, box, axis, note);
  return sec;
}
