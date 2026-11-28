/* Layers: the stock page and sheets. Each one is a history entry, so the phone's back gesture closes
   it. While a layer is open, everything behind it is inert (no taps, no focus, hidden from screen
   readers); closing it puts focus back where it was, or on the same stock if that moved. */
import { $, esc, reduced } from "../util.js";

const stack = [];
export const layerCount = () => stack.length;
export const isOpen = (el) => stack.some((l) => l.el === el);

const below = () => (stack.length ? stack[stack.length - 1].el : $("app"));
const symOf = (n) => (n && n.closest && n.closest("[data-sym]") ? n.closest("[data-sym]").dataset.sym : null);

/** Opens a layer. opts: { opener, focus (element), url (e.g. "#AAPL"), onClose }. */
export function openLayer(el, opts = {}) {
  const opener = opts.opener !== undefined ? opts.opener : document.activeElement;
  below().inert = true;
  clearTimeout(el._closeT);
  el.classList.remove("closing");
  el.hidden = false;
  stack.push({ el, opener, sym: symOf(opener), onClose: opts.onClose });
  document.body.classList.add("layered");
  // Normally a new history entry. Back on an entry Tangent made for this depth (after a reload, or
  // Forward), reuse it, so the back gesture never needs an extra swipe.
  const here = !!(history.state && history.state.tangent === stack.length);
  try { history[here ? "replaceState" : "pushState"]({ tangent: stack.length }, "", opts.url || location.href); } catch (e) {}
  const f = opts.focus || el.querySelector("h1, h2");
  if (f) { if (!f.hasAttribute("tabindex")) f.tabIndex = -1; f.focus({ preventScroll: true }); }
}
/** Closes the top layer the way the phone's back gesture does. */
export const back = () => { if (stack.length) history.back(); };

function closeTop() {
  const top = stack.pop();
  if (!top) return;
  const under = below();
  under.inert = false;
  if (!stack.length) document.body.classList.remove("layered");
  hide(top.el);
  if (top.onClose) top.onClose();
  restoreFocus(top, under);
}
function hide(el) {
  if (reduced) { el.hidden = true; return; }
  el.classList.add("closing");
  const done = () => { clearTimeout(el._closeT); el.removeEventListener("animationend", onEnd); if (el.classList.contains("closing")) { el.classList.remove("closing"); el.hidden = true; } };
  const onEnd = (e) => { if (e.target === el || e.target.parentElement === el) done(); };
  el.addEventListener("animationend", onEnd);
  el._closeT = setTimeout(done, 400);
}
function restoreFocus(top, under) {
  const visible = (n) => n && n.isConnected && under.contains(n) && !n.closest("[hidden]") && !n.closest("[inert]");
  let t = top.opener;
  if (!visible(t) && top.sym) t = [...under.querySelectorAll('[data-sym="' + esc(top.sym) + '"] .wl-row, [data-sym="' + esc(top.sym) + '"] .res-open')].find(visible);
  if (!visible(t)) t = [...under.querySelectorAll(".view:not([hidden]) h1, h1, h2")].find(visible);
  if (t) { if (!t.matches("button, a, input, [tabindex]")) t.tabIndex = -1; t.focus({ preventScroll: !top.sym }); }
}

export function initLayers() {
  // Back (or forward) moves to a history entry with a known depth; close layers above it.
  window.addEventListener("popstate", () => {
    const depth = (history.state && history.state.tangent) || 0;
    while (stack.length > depth) closeTop();
  });
}
