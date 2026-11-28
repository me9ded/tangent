/* Finnhub REST calls: a rate limiter, an in-flight de-duplicator and a small cache. */
import { store, asObj, sleep } from "./util.js";
import { getKey } from "./state.js";

const FH = "https://finnhub.io/api/v1";

export function fhError(code, msg) { const e = new Error(msg || code); e.code = code; return e; }

const mem = new Map();
let disk = null;
/* Only company profiles (logos) are kept across launches. */
function diskCache() {
  if (disk) return disk;
  disk = asObj(store.get("fhcache", {}));
  let pruned = false;
  for (const k of Object.keys(disk)) if (!k.startsWith("/stock/profile2?") || !disk[k] || typeof disk[k].t !== "number") { delete disk[k]; pruned = true; }
  if (pruned) store.set("fhcache", disk);
  return disk;
}
export function cacheGet(k, ttl) { const m = mem.get(k) || diskCache()[k]; return m && Date.now() - m.t < ttl ? m.v : undefined; }
function cachePut(k, v, persist) {
  const e = { t: Date.now(), v };
  mem.set(k, e);
  if (persist) {
    const d = diskCache();
    d[k] = e;
    const keys = Object.keys(d);
    if (keys.length > 120) keys.sort((a, b) => d[a].t - d[b].t).slice(0, keys.length - 120).forEach((x) => delete d[x]);
    store.set("fhcache", d);
  }
}

/* Finnhub's free plan allows 60 calls a minute. Tangent stays under 50 and spaces them out;
   background work stops at 34 so anything you tap can still go through right away. */
export const fhQ = { times: [], chain: Promise.resolve(), pausedUntil: 0 };
async function fhSlot(high) {
  const cap = high ? 50 : 34;
  for (;;) {
    const now = Date.now();
    if (now < fhQ.pausedUntil) {
      // After a 429, things you asked for fail fast so old prices stay on screen; background work just waits.
      if (high) throw fhError("rate");
      await sleep(fhQ.pausedUntil - now);
      continue;
    }
    fhQ.times = fhQ.times.filter((t) => now - t < 60000);
    if (fhQ.times.length < cap) {
      const last = fhQ.times[fhQ.times.length - 1] || 0;
      if (now - last < 110) { await sleep(110 - (now - last)); continue; }
      fhQ.times.push(now);
      return;
    }
    await sleep(Math.max(80, 60000 - (now - fhQ.times[fhQ.times.length - cap]) + 60));
  }
}
const inflight = new Map();
/** A Finnhub call. opts: { high, ttl, persist, key }. */
export function fh(path, params, opts) {
  opts = opts || {};
  const ck = path + "?" + new URLSearchParams(params || {}).toString();
  if (opts.ttl) {
    const hit = cacheGet(ck, opts.ttl);
    if (hit !== undefined) return Promise.resolve(hit);
  }
  if (!opts.key && inflight.has(ck)) return inflight.get(ck);
  const p = fhCall(path, params, opts, ck);
  if (!opts.key) {
    inflight.set(ck, p);
    p.catch(() => {}).finally(() => { if (inflight.get(ck) === p) inflight.delete(ck); });
  }
  return p;
}
async function fhCall(path, params, opts, ck) {
  const key = opts.key || getKey();
  if (!key) throw fhError("nokey");
  if (opts.high) await fhSlot(true);
  else {
    const slot = fhQ.chain.then(() => fhSlot(false));
    fhQ.chain = slot.catch(() => {});
    await slot;
  }
  const qs = new URLSearchParams(params || {});
  qs.set("token", key);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  let r;
  try { r = await fetch(FH + path + "?" + qs.toString(), { signal: ctl.signal }); }
  catch (e) { throw fhError("net"); }
  finally { clearTimeout(t); }
  if (r.status === 401) throw fhError("badkey");
  if (r.status === 403) throw fhError("noaccess");
  if (r.status === 429) { fhQ.pausedUntil = Date.now() + 15000; throw fhError("rate"); }
  if (!r.ok) throw fhError("http", "HTTP " + r.status);
  const j = await r.json();
  if (j && typeof j === "object" && !Array.isArray(j) && typeof j.error === "string") throw fhError(/key/i.test(j.error) ? "badkey" : "noaccess", j.error);
  if (opts.ttl) cachePut(ck, j, opts.persist);
  return j;
}

/* Company profiles carry the logo; they change rarely, so they're kept for a week. */
const PROFILE_TTL = 7 * 864e5;
export function profile(sym, high) { return fh("/stock/profile2", { symbol: sym }, { ttl: PROFILE_TTL, persist: true, high }); }
export const cachedProfile = (sym) => cacheGet("/stock/profile2?" + new URLSearchParams({ symbol: sym }).toString(), PROFILE_TTL);
