/* Connecting the Finnhub key, from the setup card on Home or from Settings. */
import { $, store } from "../util.js";
import { S } from "../state.js";
import { fh, fhError } from "../finnhub.js";
import { liveClose } from "../live.js";
import { refreshAll } from "../refresh.js";
import { showToast } from "./toast.js";

const homeUI = () => ({ input: $("key-input"), btn: $("key-go"), msg: $("key-msg") });

/** Asks the browser to keep Tangent's storage (the key, the list, the charts) when space runs low. */
export function keepStorage() {
  try {
    const st = navigator.storage;
    if (st && st.persist && st.persisted) st.persisted().then((p) => p || st.persist()).catch(() => {});
  } catch (e) {}
}

export async function connectKey(key, ui = homeUI()) {
  key = String(key || "").trim();
  const { input, btn, msg } = ui;
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
    input.value = "";
    msg.textContent = "Your key stays on this phone. Tangent only sends it to Finnhub.";
    keepStorage();
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
}
