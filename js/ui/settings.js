/* Settings: the Finnhub key, appearance, installing, and about. */
import { $, store } from "../util.js";
import { S, getKey } from "../state.js";
import { liveClose } from "../live.js";
import { connectKey } from "./key.js";
import { render } from "./home.js";
import { showToast } from "./toast.js";

const THEME_BG = { light: "#fbf9f6", dark: "#101012" };
/** "system", "light" or "dark". js/theme.js applies the saved choice before the page draws. */
export function applyTheme(t) {
  const root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
  // The browser bar follows the chosen theme too.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", THEME_BG[t] || ((m.getAttribute("media") || "").includes("dark") ? THEME_BG.dark : THEME_BG.light));
  });
}

export function paintSettings() {
  const has = !!getKey();
  $("set-key-state").textContent = !has ? "Not connected. Add a key to get prices." : S.keyBroken ? "Finnhub stopped accepting this key. Add a fresh one." : "Connected. Your key stays on this phone.";
  $("key-change").textContent = S.editingKey ? "Cancel" : has ? "Change key" : "Add key";
  $("key-remove").hidden = !has || S.editingKey;
  $("set-key-form").hidden = !S.editingKey;
  $("set-key-msg").hidden = !S.editingKey;
}

export function initSettings() {
  const ui = { input: $("set-key-input"), btn: $("set-key-go"), msg: $("set-key-msg") };
  $("key-change").addEventListener("click", () => {
    S.editingKey = !S.editingKey;
    ui.msg.textContent = "Your key stays on this phone. Tangent only sends it to Finnhub.";
    paintSettings();
    if (S.editingKey) ui.input.focus();
  });
  $("set-key-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await connectKey(ui.input.value, ui)) { S.editingKey = false; paintSettings(); $("key-change").focus(); }
  });
  $("key-remove").addEventListener("click", () => {
    const b = $("key-remove");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "Tap again to remove";
      clearTimeout(b._t);
      b._t = setTimeout(() => { b.dataset.armed = ""; b.textContent = "Remove key"; }, 4000);
      return;
    }
    clearTimeout(b._t);
    store.set("fhkey", "");
    S.keyBroken = false;
    S.editingKey = false;
    b.dataset.armed = "";
    b.textContent = "Remove key";
    liveClose();
    render();
    showToast("Key removed from this phone");
    $("key-change").focus();
  });

  const saved = store.get("theme", "system");
  const theme = ["light", "dark"].includes(saved) ? saved : "system";
  document.querySelectorAll('#theme input[name="theme"]').forEach((r) => {
    r.checked = r.value === theme;
    r.addEventListener("change", () => { if (!r.checked) return; store.set("theme", r.value); applyTheme(r.value); });
  });

  const v = (document.querySelector('meta[name="version"]') || {}).content || "";
  $("version").textContent = v === "tangent-dev" || !v ? "Development version" : "Version " + v.replace(/^tangent-/, "");
}
