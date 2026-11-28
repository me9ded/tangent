/* The main screen: setup card, status, movers and the watchlist. */
import { $ } from "../util.js";
import { S, getKey } from "../state.js";
import { paintStatus } from "./status.js";
import { renderSummary, renderList } from "./list.js";

export function render() {
  const has = !!getKey();
  $("setup").hidden = has && !S.keyBroken && !S.editingKey;
  $("key-change").textContent = S.editingKey ? "Keep current key" : "Change key";
  $("key-broken").hidden = !S.keyBroken;
  $("key-row").hidden = !has;
  paintStatus();
  renderSummary();
  renderList();
}
