/* App state shared between modules. Modules change fields on S (imported bindings can't be reassigned). */
import { store, asObj } from "./util.js";

export const MAX_WATCH = 40;
export const DEFAULT_WATCH = [
  ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"], ["META", "Meta Platforms"],
  ["NVDA", "Nvidia"], ["AMD", "AMD"], ["AVGO", "Broadcom"], ["TSM", "TSMC"], ["ASML", "ASML"], ["INTC", "Intel"],
  ["SHOP", "Shopify"], ["CLS", "Celestica"], ["OTEX", "OpenText"],
  ["TSLA", "Tesla"], ["NFLX", "Netflix"], ["PLTR", "Palantir"]
].map(([sym, name]) => ({ sym, name }));

export const S = {
  watch: [],
  sortMode: "moves",
  chgMode: "pct",
  /** The stock whose price page is open, or null. */
  pageSym: null,
  keyBroken: false,
  editingKey: false,
  /** When the watchlist's quotes were last refreshed (ms). */
  quotesAt: 0,
  /** Market status: { open, session, holiday }. */
  mstatus: { open: false, session: null }
};
/** Latest quote per symbol: Finnhub's { c, d, dp, h, l, o, pc, t }, kept current by live trades. */
export const quotes = new Map();
/** 52-week high and low per symbol, from /stock/metric. */
export const yearCache = new Map();

export function loadState() {
  const storedWatch = store.get("watch", null);
  S.watch = (Array.isArray(storedWatch) ? storedWatch : DEFAULT_WATCH)
    .filter((w) => w && typeof w.sym === "string" && typeof w.name === "string")
    .map((w) => ({ sym: w.sym, name: w.name }))
    .slice(0, MAX_WATCH);
  const sm = store.get("wlSort", "moves");
  S.sortMode = ["moves", "az", "mine"].includes(sm) ? sm : "moves";
  S.chgMode = store.get("chgMode", "pct") === "usd" ? "usd" : "pct";
  for (const [s, q] of Object.entries(asObj(store.get("lastQuotes", {})))) if (q && Number.isFinite(q.c) && q.c > 0) quotes.set(s, q);
  S.quotesAt = Number(store.get("lastQuotesAt", 0)) || 0;
}
export const saveWatch = () => store.set("watch", S.watch);
export const watchOf = (sym) => S.watch.find((w) => w.sym === sym) || null;
export const getKey = () => { const k = store.get("fhkey", ""); return typeof k === "string" ? k.trim() : ""; };
