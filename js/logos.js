/* Company logos: initials until Finnhub's profile (cached a week) has a logo URL. */
import { sleep, esc, initials } from "./util.js";
import { S, watchOf, getKey } from "./state.js";
import { fhQ, profile, cachedProfile } from "./finnhub.js";

export function logoInto(slot, sym) {
  slot.dataset.logo = sym;
  const w = watchOf(sym);
  slot.textContent = initials(w ? w.name : sym);
  const p = cachedProfile(sym);
  if (p && p.logo) {
    const im = new Image();
    im.alt = "";
    im.onload = () => { slot.textContent = ""; slot.classList.add("has-logo"); slot.append(im); };
    im.src = p.logo;
  } else warmLogos();
}
export const paintLogos = (sym) => document.querySelectorAll('[data-logo="' + esc(sym) + '"]').forEach((s) => { if (!s.classList.contains("has-logo")) logoInto(s, sym); });

/* Fetches missing logos in the background, slowly, so it never competes with prices. */
let warming = false;
export async function warmLogos() {
  if (warming || !getKey()) return;
  warming = true;
  await sleep(3000);
  try {
    for (const w of S.watch.slice()) {
      if (!getKey()) break;
      if (cachedProfile(w.sym)) continue;
      while (fhQ.times.filter((t) => Date.now() - t < 60000).length > 14) await sleep(2500);
      try { await profile(w.sym); paintLogos(w.sym); } catch (e) { if (e.code === "badkey") break; }
      await sleep(700);
    }
  } finally { warming = false; }
}
