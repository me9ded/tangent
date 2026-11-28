/* Tangent: live prices for the stocks you follow. This file wires everything up; the other modules
   only define things, so they can be imported (and unit-tested) without a page. */
import { $, store } from "./util.js";
import { S, quotes, loadState, getKey } from "./state.js";
import { fhQ } from "./finnhub.js";
import { clockStatus, marketStatus, trading, saveQuotes } from "./market.js";
import { hist, loadHist } from "./history.js";
import { US_TICKER } from "./search.js";
import { live, liveSync, liveClose, isLive } from "./live.js";
import { refreshAll } from "./refresh.js";
import { render } from "./ui/home.js";
import { renderList, initList } from "./ui/list.js";
import { paintStatus } from "./ui/status.js";
import { openPage, initStock } from "./ui/stock.js";
import { initToast, showToast, toastState } from "./ui/toast.js";
import { initLayers, back, layerCount } from "./ui/layers.js";
import { initNav, showTab, currentTab } from "./ui/nav.js";
import { initSearch } from "./ui/searchtab.js";
import { initSettings } from "./ui/settings.js";
import { initKey, connectKey, keepStorage } from "./ui/key.js";
import { initInstall } from "./ui/install.js";
import { initPtr } from "./ui/ptr.js";

loadState();
loadHist();
S.mstatus = clockStatus();
S.offline = navigator.onLine === false;
initToast();
initLayers();
initNav();
initList();
initStock();
initSearch();
initSettings();
initKey();
initInstall();

/* ---------- refreshing ---------- */
$("refresh").addEventListener("click", () => {
  if (!getKey()) { $("key-input").focus(); return; }
  refreshAll(true);
});
initPtr(() => (getKey() ? refreshAll(true) : undefined));
let lastStatusCheck = 0;
setInterval(() => {
  if (document.hidden || !getKey()) return;
  const now = Date.now();
  if (now - lastStatusCheck > 5 * 60000) { lastStatusCheck = now; marketStatus().then(() => { paintStatus(); liveSync(); }); }
  const every = !trading() ? 15 * 60000 : isLive() ? 5 * 60000 : 60000;
  if (now - S.quotesAt >= every) refreshAll(true, true);
  else paintStatus();
}, 15000);
// Phones freeze or kill backgrounded apps, so save what the chart has recorded on the way out.
window.addEventListener("pagehide", saveQuotes);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { saveQuotes(); liveClose(); return; }
  if (getKey() && Date.now() - S.quotesAt > 60000) refreshAll(true, true);
  else liveSync();
});
window.addEventListener("offline", () => { S.offline = true; liveClose(); paintStatus(); });
window.addEventListener("online", () => { S.offline = false; paintStatus(); if (getKey()) refreshAll(true, true); });

/* ---------- sorting ---------- */
document.querySelectorAll("#sort button").forEach((b) => b.addEventListener("click", () => {
  const was = S.sortMode;
  S.sortMode = b.dataset.sort;
  store.set("wlSort", S.sortMode);
  renderList({ now: true });
  if (S.sortMode === "mine" && was !== "mine" && S.watch.length > 1 && !store.get("toldReorder", false)) {
    store.set("toldReorder", true);
    showToast("Drag the handle to put your stocks in order", 2600);
  }
}));
$("add").addEventListener("click", () => showTab("search", { focusEl: $("search-input") }));

/* ---------- keyboard ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && layerCount()) { back(); return; }
  if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey || layerCount()) return;
  if (e.key === "r" && currentTab() === "home") $("refresh").click();
  else if (e.key === "/") { e.preventDefault(); showTab("search", { focusEl: $("search-input") }); }
});

/* ---------- start ---------- */
// A stock page's address is #SYM, so a reload (or a link) opens it again, with Home behind it. From a
// link, Home becomes this history entry and the page gets a new one; a reload reuses the page's entry.
const symFromHash = () => { try { const s = decodeURIComponent(location.hash.slice(1)); return US_TICKER.test(s) ? s : null; } catch (e) { return null; } };
const startSym = symFromHash();
if (location.hash && !(startSym && history.state && history.state.tangent)) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
render();
refreshAll(false, true);
if (getKey()) keepStorage();
if (startSym) openPage(startSym, { opener: null });
window.addEventListener("hashchange", () => { const s = symFromHash(); if (s && s !== S.pageSym) openPage(s, { opener: null }); });

/* Updates: a new service worker waits until you tap Reload, so the app never swaps under you. */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const sw = navigator.serviceWorker;
  // Reload only when you tapped Reload, not when the very first worker takes control.
  let asked = false, reloading = false;
  sw.addEventListener("controllerchange", () => {
    if (!asked || reloading) return;
    reloading = true;
    location.reload();
  });
  const offerUpdate = (w) => {
    if (!w || !sw.controller || toastState.sticky) return;
    toastState.sticky = { msg: "A new version of Tangent is ready", action: { label: "Reload", run: () => { asked = true; w.postMessage({ type: "skip-waiting" }); } } };
    if ($("toast").hidden) showToast(toastState.sticky.msg, Infinity, toastState.sticky.action);
  };
  const register = async () => {
    let reg;
    try { reg = await sw.register("./sw.js"); } catch (e) { return; }
    // Some browsers (and blocked or test setups) resolve without a registration.
    if (!reg) return;
    if (reg.waiting) offerUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (w) w.addEventListener("statechange", () => { if (w.state === "installed") offerUpdate(w); });
    });
    // Installed apps can stay open for days; look for a new version whenever Tangent comes back.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
  };
  // Modules run after the document is parsed, possibly after "load" has already fired.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}

// Hooks for automated tests; harmless in normal use.
window.__tangent = { quotes, live, fhQ, hist, S, watch: () => S.watch, openPage, showTab, showToast, refreshAll, connectKey, mstatus: () => S.mstatus, isLive };
