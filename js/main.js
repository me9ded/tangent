/* Tangent: live prices for the stocks you follow. This file wires everything up; the other modules
   only define things, so they can be imported (and unit-tested) without a page. */
import { $, store } from "./util.js";
import { S, quotes, loadState, getKey } from "./state.js";
import { fhQ } from "./finnhub.js";
import { clockStatus, marketStatus, trading, saveQuotes } from "./market.js";
import { hist, loadHist } from "./history.js";
import { paintChart } from "./chart.js";
import { live, liveSync, liveClose, isLive } from "./live.js";
import { refreshAll } from "./refresh.js";
import { render } from "./ui/home.js";
import { renderList } from "./ui/list.js";
import { paintStatus } from "./ui/status.js";
import { openPage } from "./ui/stock.js";
import { initToast, showToast, toastState } from "./ui/toast.js";
import { initOverlays, back, overlayCount } from "./ui/overlays.js";
import { initAdd } from "./ui/add.js";
import { initKey, connectKey } from "./ui/key.js";
import { initInstall } from "./ui/install.js";

loadState();
loadHist();
S.mstatus = clockStatus();
initToast();
initOverlays();
initAdd();
initKey();
initInstall();

/* ---------- refreshing ---------- */
$("refresh").addEventListener("click", () => {
  if (!getKey()) { $("key-input").focus(); return; }
  refreshAll(true);
});
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

/* ---------- sorting ---------- */
document.querySelectorAll("#sort button").forEach((b) => b.addEventListener("click", () => {
  const was = S.sortMode;
  S.sortMode = b.dataset.sort;
  store.set("wlSort", S.sortMode);
  renderList();
  if (S.sortMode === "mine" && was !== "mine" && S.watch.length > 1 && !store.get("toldReorder", false)) {
    store.set("toldReorder", true);
    showToast("Drag the handle to put your stocks in order", 2600);
  }
}));

$("pg-back").addEventListener("click", back);
window.addEventListener("resize", () => { if (S.pageSym) paintChart(); });

/* ---------- keyboard ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlayCount()) { back(); return; }
  if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "r" && !overlayCount()) $("refresh").click();
});

/* ---------- start ---------- */
render();
refreshAll(false, true);

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
window.__tangent = { quotes, live, fhQ, hist, watch: () => S.watch, openPage, refreshAll, connectKey, mstatus: () => S.mstatus, isLive };
