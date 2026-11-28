/* The tab bar. Tabs don't add history entries (back closes layers, not tabs). Each view keeps its
   own scroll position, and focus moves to the view's heading so screen readers announce it. */
import { $, reduced } from "../util.js";

export const TABS = ["home", "search", "settings"];
let current = "home";
const scrollTops = {};
const listeners = [];
export const currentTab = () => current;
export const onTab = (fn) => listeners.push(fn);

export function showTab(name, opts = {}) {
  if (!TABS.includes(name)) name = "home";
  const view = $("v-" + name);
  if (name === current) {
    // Tapping the current tab again goes back to its top.
    if (opts.fromTap) view.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  } else {
    scrollTops[current] = $("v-" + current).scrollTop;
    for (const t of TABS) $("v-" + t).hidden = t !== name;
    if (scrollTops[name] != null) view.scrollTop = scrollTops[name];
    current = name;
  }
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  if (opts.focus !== false) {
    const target = opts.focusEl || view.querySelector("h1");
    if (target) target.focus({ preventScroll: true });
  }
  for (const fn of listeners) fn(name);
}
export function initNav() {
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab, { fromTap: true })));
}
