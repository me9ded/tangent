/* Connecting, changing and removing the Finnhub key. */
import { $, store, reduced } from "../util.js";
import { S } from "../state.js";
import { fh, fhError } from "../finnhub.js";
import { liveClose } from "../live.js";
import { refreshAll } from "../refresh.js";
import { render } from "./home.js";
import { showToast } from "./toast.js";

export async function connectKey(key) {
  key = String(key || "").trim();
  const msg = $("key-msg"), btn = $("key-go");
  if (!key) { msg.textContent = "Paste your key first."; return false; }
  btn.disabled = true;
  msg.textContent = "Checking your key…";
  try {
    const q = await fh("/quote", { symbol: "AAPL" }, { key, high: true });
    if (!q || !Number.isFinite(q.c)) throw fhError("http");
    store.set("fhkey", key);
    S.keyBroken = false;
    S.editingKey = false;
    liveClose();
    $("key-input").value = "";
    msg.textContent = "Your key stays on this phone. Tangent only sends it to Finnhub.";
    showToast("Live prices connected");
    await refreshAll(true);
    return true;
  } catch (e) {
    msg.textContent = e.code === "badkey" ? "Finnhub didn't accept that key. Copy it again from your Finnhub dashboard and paste the whole thing."
      : e.code === "rate" ? "Finnhub is rate-limiting right now. Wait a minute and try again."
      : "Couldn't reach Finnhub. Check your connection and try again.";
    return false;
  } finally { btn.disabled = false; }
}
export function initKey() {
  $("key-form").addEventListener("submit", (e) => { e.preventDefault(); connectKey($("key-input").value); });
  $("key-change").addEventListener("click", () => {
    S.editingKey = !S.editingKey;
    render();
    if (S.editingKey) { $("main").scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); $("key-input").focus({ preventScroll: true }); }
  });
  $("key-remove").addEventListener("click", () => {
    const b = $("key-remove");
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to remove"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Remove key"; }, 4000); return; }
    store.set("fhkey", "");
    S.keyBroken = false;
    S.editingKey = false;
    b.dataset.armed = "";
    b.textContent = "Remove key";
    liveClose();
    render();
    showToast("Key removed from this phone");
  });
}
