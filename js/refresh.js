/* Refreshing prices: on start, on the refresh button, pull to refresh, coming back online, and on a
   timer while Tangent is on screen. */
import { $ } from "./util.js";
import { S, getKey } from "./state.js";
import { marketStatus, refreshQuotes } from "./market.js";
import { warmLogos } from "./logos.js";
import { liveSync, liveClose } from "./live.js";
import { render } from "./ui/home.js";
import { paintStatus } from "./ui/status.js";
import { showToast } from "./ui/toast.js";

export async function refreshAll(force, quiet) {
  if (!getKey()) { render(); return; }
  const btn = $("refresh");
  btn.classList.add("spin");
  try {
    await Promise.all([marketStatus(), refreshQuotes(force)]);
    render();
    warmLogos();
  } catch (e) {
    if (e.code === "badkey") { S.keyBroken = true; liveClose(); render(); }
    else {
      // Can't reach Finnhub: say so where the time of the prices is shown.
      if (e.code === "net") { S.offline = true; paintStatus(); }
      if (!quiet) showToast(e.code === "rate" ? "Finnhub asked us to slow down. Try again in a minute." : "Couldn't refresh. Showing the last prices.", 2800);
    }
  } finally {
    btn.classList.remove("spin");
    liveSync();
  }
}
