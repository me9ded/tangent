/* Toasts. An optional action adds a button (Undo, Reload). A sticky toast (the update offer)
   comes back after any other toast has gone. */
import { $ } from "../util.js";

export const toastState = { sticky: null };
let timer = null, action = null;

export function showToast(msg, ms, act) {
  const toast = $("toast"), btn = $("toast-act");
  clearTimeout(timer);
  $("toast-msg").textContent = msg;
  action = act || null;
  btn.hidden = !act;
  btn.textContent = act ? act.label : "";
  toast.classList.toggle("has-act", !!act);
  toast.hidden = false;
  if (ms === Infinity) return;
  timer = setTimeout(hideToast, ms || (act ? 5000 : 2000));
}
export function hideToast() {
  clearTimeout(timer);
  $("toast").hidden = true;
  action = null;
  const s = toastState.sticky;
  if (s) showToast(s.msg, Infinity, s.action);
}
export function initToast() {
  $("toast-act").addEventListener("click", () => {
    const a = action;
    if (toastState.sticky && toastState.sticky.action === a) toastState.sticky = null;
    hideToast();
    if (a) a.run();
  });
}
