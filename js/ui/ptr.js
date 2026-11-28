/* Pull down at the top of Home to refresh (touch only; the refresh button and the R key do the same). */
import { $ } from "../util.js";
import { layerCount } from "./layers.js";

const THRESHOLD = 64, MAX = 112;

export function initPtr(refresh) {
  const view = $("v-home"), ptr = $("ptr"), icon = ptr.querySelector("svg");
  let y0 = null, x0 = 0, pulling = false, armed = false, busy = false;
  const place = (d) => { ptr.style.transform = "translateY(" + (d - 56) + "px)"; icon.style.transform = "rotate(" + d * 3 + "deg)"; };
  view.addEventListener("touchstart", (e) => {
    y0 = null;
    if (busy || e.touches.length !== 1 || view.scrollTop > 0 || layerCount()) return;
    y0 = e.touches[0].clientY;
    x0 = e.touches[0].clientX;
    pulling = false;
    armed = false;
  }, { passive: true });
  view.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!pulling) {
      if (dy > 8 && dy > Math.abs(dx) && view.scrollTop <= 0) { pulling = true; ptr.classList.remove("settle"); ptr.classList.add("on"); }
      else if (dy < -4 || Math.abs(dx) > 8) { y0 = null; return; }
      else return;
    }
    // Ours now: stop the page from rubber-banding while the indicator follows the finger.
    if (e.cancelable) e.preventDefault();
    const d = Math.min(MAX, dy * 0.55);
    place(d);
    const over = d >= THRESHOLD;
    if (over && !armed && navigator.vibrate) navigator.vibrate(8);
    armed = over;
  }, { passive: false });
  const end = () => {
    y0 = null;
    if (!pulling) return;
    pulling = false;
    ptr.classList.add("settle");
    if (!armed) { ptr.classList.remove("on"); place(0); return; }
    busy = true;
    place(THRESHOLD);
    ptr.classList.add("spin");
    Promise.resolve().then(refresh).catch(() => {}).finally(() => { busy = false; ptr.classList.remove("spin", "on"); place(0); });
  };
  view.addEventListener("touchend", end);
  view.addEventListener("touchcancel", end);
}
