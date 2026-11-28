/* "Put Tangent on your home screen": the browser's install prompt where there is one, steps otherwise. */
import { $, el } from "../util.js";
import { showToast } from "./toast.js";
import { openLayer, back } from "./layers.js";

const SHARE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
const DOTS_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
let deferredPrompt = null;

export function initInstall() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const offer = (on) => { $("install").hidden = !on; $("install-group").hidden = !on; };
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; offer(true); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; offer(false); showToast("Tangent is on your home screen", 3000); });
  offer(!isStandalone() && (isIOS || isAndroid));

  function renderInstall() {
    const body = $("install-body");
    body.textContent = "";
    if (deferredPrompt) {
      body.append(el("p", null, "One tap and Tangent gets its own icon and opens full screen."));
      const b = el("button", "bigbtn", "Install Tangent");
      b.type = "button";
      b.addEventListener("click", async () => { const p = deferredPrompt; deferredPrompt = null; try { await p.prompt(); await p.userChoice; } catch (e) {} back(); });
      body.append(b);
      return;
    }
    const steps = el("ol", "steps");
    const step = (html) => { const li = el("li"); const sp = el("span"); sp.innerHTML = html; li.append(sp); steps.append(li); };
    if (isIOS) {
      step("In Safari, tap the Share button " + SHARE_ICON + ".");
      step("Scroll down and tap <b>Add to Home Screen</b>.");
      step("Tap <b>Add</b>.");
    } else {
      step("In Chrome, tap the menu " + DOTS_ICON + " at the top right.");
      step("Tap <b>Install app</b> or <b>Add to Home screen</b>.");
      step("Confirm.");
    }
    body.append(steps);
  }
  const installSheet = $("install-sheet");
  const open = (e) => { renderInstall(); openLayer(installSheet, { opener: e.currentTarget, focus: $("install-title") }); };
  $("install").addEventListener("click", open);
  $("install-open").addEventListener("click", open);
  installSheet.addEventListener("click", (e) => { if (e.target === installSheet || e.target.closest("[data-close]")) back(); });
}
