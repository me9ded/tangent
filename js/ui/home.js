/* Redraws everything that depends on the key, the list and the latest prices. */
import { $ } from "../util.js";
import { S, getKey } from "../state.js";
import { updateListDay } from "../market.js";
import { paintStatus } from "./status.js";
import { renderHero } from "./hero.js";
import { renderList } from "./list.js";
import { paintSettings } from "./settings.js";
import { paintSearchMarks } from "./searchtab.js";

export function render() {
  const has = !!getKey();
  $("setup").hidden = has && !S.keyBroken;
  $("key-broken").hidden = !S.keyBroken;
  updateListDay();
  paintStatus();
  renderHero();
  renderList();
  paintSettings();
  paintSearchMarks();
}
