(() => {
  "use strict";

  /* ======================= setup ======================= */
  const FH = "https://finnhub.io/api/v1";
  const FH_WS = "wss://ws.finnhub.io";
  const DEFAULT_WATCH = [
    ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"], ["META", "Meta Platforms"],
    ["NVDA", "Nvidia"], ["AMD", "AMD"], ["AVGO", "Broadcom"], ["TSM", "TSMC"], ["ASML", "ASML"], ["INTC", "Intel"],
    ["SHOP", "Shopify"], ["CLS", "Celestica"], ["OTEX", "OpenText"],
    ["TSLA", "Tesla"], ["NFLX", "Netflix"], ["PLTR", "Palantir"]
  ].map(([sym, name]) => ({ sym, name }));

  const store = {
    get(k, d) { try { const v = localStorage.getItem("tangent." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("tangent." + k, JSON.stringify(v)); } catch (e) {} }
  };
  const asArr = (v) => (Array.isArray(v) ? v : []);
  const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  const storedWatch = store.get("watch", null);
  let watch = (Array.isArray(storedWatch) ? storedWatch : DEFAULT_WATCH)
    .filter((w) => w && typeof w.sym === "string" && typeof w.name === "string")
    .map((w) => ({ sym: w.sym, name: w.name }))
    .slice(0, 40);
  const MAX_WATCH = 40;
  const saveWatch = () => store.set("watch", watch);
  const watchOf = (sym) => watch.find((w) => w.sym === sym) || null;
  const getKey = () => { const k = store.get("fhkey", ""); return typeof k === "string" ? k.trim() : ""; };
  let sortMode = store.get("wlSort", "moves");
  if (!["moves", "az", "mine"].includes(sortMode)) sortMode = "moves";
  let chgMode = store.get("chgMode", "pct") === "usd" ? "usd" : "pct";

  /* ======================= utils ======================= */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const usd = (v) => (Number.isFinite(v) ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");
  const pct = (v) => (Number.isFinite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%" : "–");
  const signedUsd = (v) => (Number.isFinite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + usd(Math.abs(v)) : "–");
  const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  function cleanName(s) {
    s = String(s || "").replace(/\b(inc|corp|corporation|ltd|limited|plc|co|holdings?|group|class [a-c]|cl [a-c]|sa|nv|ag|adr|spons?|sponsored|ord|shs|common stock)\b\.?/gi, "").replace(/[-,/]+\s*$/, "").replace(/\s+/g, " ").trim();
    return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) || s;
  }
  const initials = (name) => String(name || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";

  const toast = $("toast");
  let toastTimer = null;
  function showToast(msg, ms) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, ms || 2000);
  }

  /* ======================= Finnhub requests ======================= */
  function fhError(code, msg) { const e = new Error(msg || code); e.code = code; return e; }
  const mem = new Map();
  const disk = asObj(store.get("fhcache", {}));
  {
    let pruned = false;
    for (const k of Object.keys(disk)) if (!k.startsWith("/stock/profile2?") || !disk[k] || typeof disk[k].t !== "number") { delete disk[k]; pruned = true; }
    if (pruned) store.set("fhcache", disk);
  }
  function cacheGet(k, ttl) { const m = mem.get(k) || disk[k]; return m && Date.now() - m.t < ttl ? m.v : undefined; }
  function cachePut(k, v, persist) {
    const e = { t: Date.now(), v };
    mem.set(k, e);
    if (persist) {
      disk[k] = e;
      const keys = Object.keys(disk);
      if (keys.length > 120) keys.sort((a, b) => disk[a].t - disk[b].t).slice(0, keys.length - 120).forEach((x) => delete disk[x]);
      store.set("fhcache", disk);
    }
  }
  /* Finnhub's free plan allows 60 calls a minute. Tangent stays under 50 and spaces them out;
     background work stops at 34 so anything you tap can still go through right away. */
  const fhQ = { times: [], chain: Promise.resolve(), pausedUntil: 0 };
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
  function fh(path, params, opts) {
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

  /* ======================= prices ======================= */
  const quotes = new Map(Object.entries(asObj(store.get("lastQuotes", {}))).filter(([, q]) => q && Number.isFinite(q.c) && q.c > 0));
  let quotesAt = Number(store.get("lastQuotesAt", 0)) || 0;
  let keyBroken = false;
  let editingKey = false;
  let quoteJob = null;
  function saveQuotes() {
    store.set("lastQuotes", Object.fromEntries([...quotes].filter(([s]) => watchOf(s))));
    store.set("lastQuotesAt", quotesAt);
  }
  function refreshQuotes(force) {
    if (!getKey()) return Promise.resolve(quotes);
    if (!force && quotes.size && Date.now() - quotesAt < 55000) return Promise.resolve(quotes);
    if (quoteJob) return quoteJob;
    quoteJob = (async () => {
      const res = await Promise.allSettled(watch.map((w) => fh("/quote", { symbol: w.sym }, { high: true }).then((q) => [w.sym, q])));
      let ok = 0, bad = false, lastErr = null;
      for (const r of res) {
        if (r.status === "fulfilled") {
          const [s, q] = r.value;
          if (q && Number.isFinite(q.c) && q.c > 0) { quotes.set(s, Object.assign({}, q)); ok++; }
        } else { lastErr = r.reason; if (r.reason && r.reason.code === "badkey") bad = true; }
      }
      keyBroken = bad && !ok;
      if (!ok && lastErr) throw lastErr;
      quotesAt = Date.now();
      saveQuotes();
      return quotes;
    })().finally(() => { quoteJob = null; });
    return quoteJob;
  }
  const dpOf = (sym) => { const q = quotes.get(sym); return q && Number.isFinite(q.dp) ? q.dp : null; };

  /* market hours */
  function nyClock() {
    const parts = {};
    for (const p of new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date())) parts[p.type] = p.value;
    return { wd: parts.weekday, min: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
  }
  function clockStatus() {
    const { wd, min } = nyClock();
    if (wd === "Sat" || wd === "Sun") return { open: false, session: null };
    if (min >= 570 && min < 960) return { open: true, session: "regular" };
    if (min >= 240 && min < 570) return { open: false, session: "pre-market" };
    if (min >= 960 && min < 1200) return { open: false, session: "post-market" };
    return { open: false, session: null };
  }
  let mstatus = clockStatus();
  async function marketStatus() {
    try {
      const j = await fh("/stock/market-status", { exchange: "US" }, { ttl: 60000, high: true });
      mstatus = j && typeof j.isOpen === "boolean" ? { open: j.isOpen, session: j.session || (j.isOpen ? "regular" : null), holiday: j.holiday || null } : clockStatus();
    } catch (e) { mstatus = clockStatus(); }
    return mstatus;
  }
  const regular = () => !!(mstatus.open || mstatus.session === "regular");
  const trading = () => mstatus.open || mstatus.session === "regular" || mstatus.session === "pre-market" || mstatus.session === "post-market";
  function statusLabel() {
    if (mstatus.open || mstatus.session === "regular") return "Market open";
    if (mstatus.session === "pre-market") return "Pre-market";
    if (mstatus.session === "post-market") return "After hours";
    return mstatus.holiday ? "Closed for " + mstatus.holiday : "Market closed";
  }

  /* logos */
  function profile(sym, high) { return fh("/stock/profile2", { symbol: sym }, { ttl: 7 * 864e5, persist: true, high }); }
  const cachedProfile = (sym) => cacheGet("/stock/profile2?" + new URLSearchParams({ symbol: sym }).toString(), 7 * 864e5);
  function logoInto(slot, sym) {
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
  const paintLogos = (sym) => document.querySelectorAll('[data-logo="' + esc(sym) + '"]').forEach((s) => { if (!s.classList.contains("has-logo")) logoInto(s, sym); });
  let warming = false;
  async function warmLogos() {
    if (warming || !getKey()) return;
    warming = true;
    await sleep(3000);
    try {
      for (const w of watch.slice()) {
        if (!getKey()) break;
        if (cachedProfile(w.sym)) continue;
        while (fhQ.times.filter((t) => Date.now() - t < 60000).length > 14) await sleep(2500);
        try { await profile(w.sym); paintLogos(w.sym); } catch (e) { if (e.code === "badkey") break; }
        await sleep(700);
      }
    } finally { warming = false; }
  }

  /* ======================= live trades (WebSocket) ======================= */
  const live = { ws: null, open: false, subs: new Set(), retry: 0, timer: 0, lastTick: 0 };
  const liveWanted = () => !!getKey() && !keyBroken && !document.hidden && regular() && watch.length > 0;
  function liveSync() {
    if (!liveWanted()) { liveClose(); return; }
    if (!live.ws) liveOpen();
    else if (live.open) liveSubscribe();
  }
  function liveOpen() {
    clearTimeout(live.timer);
    let ws;
    try { ws = new WebSocket(FH_WS + "?token=" + encodeURIComponent(getKey())); }
    catch (e) { liveRetry(); return; }
    live.ws = ws;
    live.open = false;
    live.subs = new Set();
    ws.addEventListener("open", () => { if (live.ws !== ws) return; live.open = true; live.retry = 0; liveSubscribe(); paintStatus(); });
    ws.addEventListener("message", (ev) => {
      if (live.ws !== ws) return;
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && m.type === "trade" && Array.isArray(m.data)) onTrades(m.data);
    });
    ws.addEventListener("close", () => {
      if (live.ws !== ws) return;
      live.ws = null;
      live.open = false;
      paintStatus();
      if (liveWanted()) liveRetry();
    });
    ws.addEventListener("error", () => { try { ws.close(1000); } catch (e) {} });
  }
  function liveClose() {
    clearTimeout(live.timer);
    if (!live.ws) return;
    const ws = live.ws;
    live.ws = null;
    live.open = false;
    try { ws.close(1000); } catch (e) {}
    paintStatus();
  }
  function liveRetry() {
    clearTimeout(live.timer);
    live.retry = Math.min(live.retry + 1, 6);
    live.timer = setTimeout(liveSync, Math.min(60000, 1500 * 2 ** live.retry));
  }
  function liveSend(o) { try { if (live.ws && live.open) live.ws.send(JSON.stringify(o)); } catch (e) {} }
  function liveSubscribe() {
    const want = new Set(watch.map((w) => w.sym));
    if (pageSym) want.add(pageSym);
    for (const s of want) if (!live.subs.has(s)) { liveSend({ type: "subscribe", symbol: s }); live.subs.add(s); }
    for (const s of [...live.subs]) if (!want.has(s)) { liveSend({ type: "unsubscribe", symbol: s }); live.subs.delete(s); }
  }
  const isLive = () => live.open && Date.now() - live.lastTick < 90000;
  const ticks = new Map();
  let tickRaf = 0, lastSave = 0, lastSummary = 0;
  function onTrades(list) {
    const latest = new Map();
    for (const t of list) {
      if (!t || typeof t.s !== "string" || !Number.isFinite(t.p) || t.p <= 0) continue;
      const prev = latest.get(t.s);
      if (!prev || (t.t || 0) >= (prev.t || 0)) latest.set(t.s, t);
    }
    for (const [s, t] of latest) {
      const q = quotes.get(s);
      if (!q || !(q.pc > 0)) continue;
      const before = q.c;
      q.c = t.p;
      q.d = t.p - q.pc;
      q.dp = (q.d / q.pc) * 100;
      { q.h = Math.max(q.h || t.p, t.p); q.l = q.l > 0 ? Math.min(q.l, t.p) : t.p; }
      if (t.t) q.t = Math.floor(t.t / 1000);
      const dir = t.p > before ? 1 : t.p < before ? -1 : 0;
      if (dir || !ticks.has(s)) ticks.set(s, dir);
    }
    if (!latest.size) return;
    live.lastTick = Date.now();
    if (!tickRaf) tickRaf = requestAnimationFrame(paintTicks);
  }
  function paintTicks() {
    tickRaf = 0;
    const now = Date.now();
    for (const [s, dir] of ticks) {
      document.querySelectorAll('.px[data-px="' + esc(s) + '"]').forEach((n) => {
        n.textContent = usd(quotes.get(s).c);
        if (dir && !reduced) {
          n.classList.remove("tick-up", "tick-down");
          void n.offsetWidth;
          n.classList.add(dir > 0 ? "tick-up" : "tick-down");
          clearTimeout(n._t);
          n._t = setTimeout(() => n.classList.remove("tick-up", "tick-down"), 220);
        }
      });
      document.querySelectorAll('.chg[data-sym="' + esc(s) + '"]').forEach(paintPill);
      document.querySelectorAll('.rng[data-sym="' + esc(s) + '"]').forEach(paintRange);
    }
    ticks.clear();
    if (pageSym) paintPageNumbers();
    if (now - lastSummary > 2000) { lastSummary = now; renderSummary(); }
    if (now - lastSave > 10000) { lastSave = now; quotesAt = now; saveQuotes(); }
    paintStatus();
  }

  /* ======================= drawing ======================= */
  function paintPill(b) {
    const q = quotes.get(b.dataset.sym);
    const v = q && Number.isFinite(q.dp) ? q.dp : null;
    b.classList.toggle("up", v > 0);
    b.classList.toggle("down", v < 0);
    const arrow = v > 0 ? "▲ " : v < 0 ? "▼ " : "";
    if (v == null) b.textContent = "–";
    else if (chgMode === "usd" && !b.classList.contains("fixed")) b.textContent = arrow + usd(Math.abs(q.d));
    else b.textContent = arrow + Math.abs(v).toFixed(2) + "%";
    b.setAttribute("aria-label", v == null ? "No change data" : (v >= 0 ? "Up " : "Down ") + Math.abs(v).toFixed(2) + " percent, " + usd(Math.abs(q.d)) + ". Tap to switch percent or dollars.");
  }
  function pill(sym, fixed) {
    const b = el("button", "chg" + (fixed ? " fixed big" : ""));
    b.type = "button";
    b.dataset.sym = sym;
    paintPill(b);
    if (!fixed) b.addEventListener("click", (e) => {
      e.stopPropagation();
      chgMode = chgMode === "pct" ? "usd" : "pct";
      store.set("chgMode", chgMode);
      document.querySelectorAll(".chg[data-sym]").forEach(paintPill);
    });
    return b;
  }
  function pxEl(sym, cls) {
    const q = quotes.get(sym);
    const n = el("span", "px" + (cls ? " " + cls : ""), q ? usd(q.c) : "–");
    n.dataset.px = sym;
    return n;
  }
  /* A range bar: track from low to high, a dot at the current price, ticks for reference prices. */
  function rangeBar(sym, kind, big) {
    const box = el("div", "rng" + (big ? " big" : ""));
    box.dataset.sym = sym;
    box.dataset.kind = kind;
    paintRange(box);
    return box;
  }
  function rangeValues(box) {
    const q = quotes.get(box.dataset.sym);
    if (!q) return null;
    if (box.dataset.kind === "year") {
      const m = yearCache.get(box.dataset.sym);
      if (!m) return null;
      return { lo: Math.min(m.lo, q.c), hi: Math.max(m.hi, q.c), cur: q.c, marks: [] };
    }
    return { lo: q.l, hi: q.h, cur: q.c, marks: [{ v: q.o, label: "Open" }, { v: q.pc, label: "Previous close" }] };
  }
  function paintRange(box) {
    const v = rangeValues(box);
    box.textContent = "";
    if (!v || !(Number.isFinite(v.lo) && Number.isFinite(v.hi) && v.hi > v.lo && Number.isFinite(v.cur))) { box.classList.add("empty"); return; }
    box.classList.remove("empty");
    const at = (x) => Math.max(0, Math.min(100, ((x - v.lo) / (v.hi - v.lo)) * 100));
    const track = el("div", "rng-track");
    for (const m of v.marks) {
      if (!Number.isFinite(m.v)) continue;
      const t = el("i", "rng-mark");
      t.style.left = at(m.v) + "%";
      t.title = m.label + " " + usd(m.v);
      track.append(t);
    }
    const dot = el("b", "rng-dot");
    dot.style.left = at(v.cur) + "%";
    track.append(dot);
    box.append(track);
    if (box.classList.contains("big")) {
      const lab = el("div", "rng-labels");
      lab.append(el("span", null, usd(v.lo)), el("span", null, usd(v.hi)));
      box.append(lab);
    }
    box.setAttribute("aria-label", "Range " + usd(v.lo) + " to " + usd(v.hi) + ", now " + usd(v.cur));
  }

  function paintStatus() {
    const s = $("mkt");
    s.textContent = "";
    s.classList.toggle("open", !!(mstatus.open || mstatus.session === "regular"));
    s.classList.toggle("streaming", isLive());
    s.append(el("i"), el("span", null, statusLabel()));
    if (isLive()) s.append(el("span", "live", "· Live"));
    else if (quotesAt && getKey()) s.append(el("span", "at", "· " + clock(quotesAt)));
    const fs = $("feed-state");
    if (fs) fs.textContent = isLive() ? "Live prices from Finnhub" : "Prices from Finnhub, refreshed every minute while the market trades";
  }

  function moverRows() {
    return watch.map((w) => ({ sym: w.sym, name: w.name, dp: dpOf(w.sym), c: (quotes.get(w.sym) || {}).c })).filter((r) => r.dp != null).sort((a, b) => b.dp - a.dp);
  }
  function renderSummary() {
    const box = $("sum");
    const rows = moverRows();
    if (!getKey() || rows.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    const up = rows.filter((r) => r.dp > 0).length;
    const best = rows[0], worst = rows[rows.length - 1];
    $("sum-h").textContent = best.dp > 0 ? best.name + " leads, " + pct(best.dp) : "A red day: nothing on your list is up";
    $("sum-p").textContent = up + " of " + rows.length + " up today" + (worst.dp < 0 ? " · " + worst.name + " is weakest at " + pct(worst.dp) : "") + ".";
    const mv = $("mv");
    mv.textContent = "";
    const max = Math.max(0.5, ...rows.map((r) => Math.abs(r.dp)));
    // Long lists show the four biggest gainers and the four biggest losers; the full list is right below.
    const shown = rows.length > 8 ? [...rows.slice(0, 4), null, ...rows.slice(-4)] : rows;
    for (const r of shown) {
      if (!r) { mv.append(el("div", "mv-gap")); continue; }
      const b = el("button", "mv-row " + (r.dp > 0 ? "up" : r.dp < 0 ? "down" : "flat"));
      b.type = "button";
      const bar = el("span", "mv-bar");
      const fill = el("i");
      fill.style.width = (Math.abs(r.dp) / max) * 50 + "%";
      bar.append(fill);
      b.append(el("span", "mv-sym", r.sym), bar, el("span", "mv-val", pct(r.dp)));
      b.setAttribute("aria-label", r.name + " " + pct(r.dp) + " at " + usd(r.c));
      b.addEventListener("click", () => openPage(r.sym));
      mv.append(b);
    }
  }

  function sorted() {
    const list = watch.slice();
    if (sortMode === "az") list.sort((a, b) => a.sym.localeCompare(b.sym));
    else if (sortMode === "moves") list.sort((a, b) => (dpOf(b.sym) ?? -1e9) - (dpOf(a.sym) ?? -1e9));
    return list;
  }
  function renderList() {
    document.querySelectorAll("#sort button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sort === sortMode ? "true" : "false"));
    const ul = $("wl");
    ul.textContent = "";
    for (const w of sorted()) {
      const li = el("li");
      const row = el("button", "wl-row");
      row.type = "button";
      const logo = el("span", "logo");
      logoInto(logo, w.sym);
      const id = el("span", "wl-id");
      id.append(el("b", null, w.sym), el("small", null, w.name));
      row.append(logo, id, rangeBar(w.sym, "day"));
      row.setAttribute("aria-label", w.name + ", open price page");
      row.addEventListener("click", () => openPage(w.sym));
      const px = el("div", "wl-px");
      px.append(pxEl(w.sym), pill(w.sym));
      px.addEventListener("click", () => openPage(w.sym));
      li.append(row, px);
      ul.append(li);
    }
    $("wl-count").textContent = watch.length + (watch.length === 1 ? " stock" : " stocks");
  }
  function render() {
    const has = !!getKey();
    $("setup").hidden = has && !keyBroken && !editingKey;
    $("key-change").textContent = editingKey ? "Keep current key" : "Change key";
    $("key-broken").hidden = !keyBroken;
    $("key-row").hidden = !has;
    paintStatus();
    renderSummary();
    renderList();
  }

  /* ======================= refreshing ======================= */
  async function refreshAll(force, quiet) {
    if (!getKey()) { render(); return; }
    const btn = $("refresh");
    btn.classList.add("spin");
    try {
      await Promise.all([marketStatus(), refreshQuotes(force)]);
      render();
      warmLogos();
    } catch (e) {
      if (e.code === "badkey") { keyBroken = true; liveClose(); render(); }
      else if (!quiet) showToast(e.code === "rate" ? "Finnhub asked us to slow down. Try again in a minute." : "Couldn't refresh. Showing the last prices.", 2800);
    } finally {
      btn.classList.remove("spin");
      liveSync();
    }
  }
  $("refresh").addEventListener("click", () => {
    if (!getKey()) { $("key-input").focus(); return; }
    refreshAll(true);
  });
  let lastStatusCheck = 0;
  setInterval(() => {
    if (document.hidden || !getKey()) return;
    const now = Date.now();
    if (now - lastStatusCheck > 5 * 60000) { lastStatusCheck = now; marketStatus().then(() => { paintStatus(); liveSync(); }); }
    const every = !trading() ? 15 * 60000 : isLive() ? 5 * 60000 : 60000;
    if (now - quotesAt >= every) refreshAll(true, true);
    else paintStatus();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { liveClose(); return; }
    if (getKey() && Date.now() - quotesAt > 60000) refreshAll(true, true);
    else liveSync();
  });
  document.querySelectorAll("#sort button").forEach((b) => b.addEventListener("click", () => { sortMode = b.dataset.sort; store.set("wlSort", sortMode); renderList(); }));

  /* ======================= key ======================= */
  async function connectKey(key) {
    key = String(key || "").trim();
    const msg = $("key-msg"), btn = $("key-go");
    if (!key) { msg.textContent = "Paste your key first."; return false; }
    btn.disabled = true;
    msg.textContent = "Checking your key…";
    try {
      const q = await fh("/quote", { symbol: "AAPL" }, { key, high: true });
      if (!q || !Number.isFinite(q.c)) throw fhError("http");
      store.set("fhkey", key);
      keyBroken = false;
      editingKey = false;
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
  $("key-form").addEventListener("submit", (e) => { e.preventDefault(); connectKey($("key-input").value); });
  $("key-change").addEventListener("click", () => {
    editingKey = !editingKey;
    render();
    if (editingKey) { $("main").scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); $("key-input").focus({ preventScroll: true }); }
  });
  $("key-remove").addEventListener("click", () => {
    const b = $("key-remove");
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to remove"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Remove key"; }, 4000); return; }
    store.set("fhkey", "");
    keyBroken = false;
    editingKey = false;
    b.dataset.armed = "";
    b.textContent = "Remove key";
    liveClose();
    render();
    showToast("Key removed from this phone");
  });

  /* ======================= overlays & back button ======================= */
  const overlays = [];
  function pushOverlay(close) {
    overlays.push(close);
    try { history.pushState({ tangent: overlays.length }, ""); } catch (e) {}
  }
  const back = () => { if (overlays.length) history.back(); };
  window.addEventListener("popstate", () => { const close = overlays.pop(); if (close) close(); });

  /* ======================= add a stock ======================= */
  const addSheet = $("add-sheet");
  let addTok = 0, addTimer = null;
  async function symbolSearch(q) {
    const j = await fh("/search", { q }, { ttl: 3600e3, high: true });
    return asArr(j && j.result).filter((r) => r && r.symbol && !/[.:]/.test(r.symbol) && (!r.type || /common stock|adr|etp|etf|reit/i.test(r.type))).slice(0, 12);
  }
  function openAdd() {
    if (!getKey()) { showToast("Connect your Finnhub key first."); $("key-input").focus(); return; }
    addSheet.hidden = false;
    $("add-input").value = "";
    $("add-results").textContent = "";
    $("add-msg").textContent = "Search by company name or ticker. US-listed stocks and ETFs.";
    pushOverlay(() => { addSheet.hidden = true; });
    $("add-input").focus();
  }
  $("add").addEventListener("click", openAdd);
  addSheet.addEventListener("click", (e) => { if (e.target === addSheet || e.target.closest("[data-close]")) back(); });
  $("add-input").addEventListener("input", () => {
    clearTimeout(addTimer);
    const q = $("add-input").value.trim();
    if (!q) { $("add-results").textContent = ""; return; }
    addTimer = setTimeout(() => runSearch(q), 300);
  });
  $("add-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("add-input").value.trim(); if (q) runSearch(q); });
  async function runSearch(q) {
    const my = ++addTok;
    $("add-msg").textContent = "Searching…";
    try {
      const res = await symbolSearch(q);
      if (my !== addTok) return;
      const ul = $("add-results");
      ul.textContent = "";
      $("add-msg").textContent = res.length ? "" : "No US-listed stocks match that. Try the ticker.";
      for (const r of res) {
        const li = el("li");
        const b = el("button");
        b.type = "button";
        const on = !!watchOf(r.symbol);
        b.append(el("b", null, r.displaySymbol || r.symbol), el("span", null, cleanName(r.description)), el("em", null, on ? "On your list" : "Add"));
        b.disabled = on;
        b.addEventListener("click", () => addStock(r.symbol, cleanName(r.description) || r.symbol));
        li.append(b);
        ul.append(li);
      }
    } catch (e) {
      if (my === addTok) $("add-msg").textContent = e.code === "rate" ? "Finnhub is busy. Try again in a moment." : "Search didn't work. Check your connection.";
    }
  }
  function addStock(sym, name) {
    if (watchOf(sym)) return;
    if (watch.length >= MAX_WATCH) { showToast("Your list is full at " + MAX_WATCH + " stocks. Remove one first.", 2800); return; }
    watch.push({ sym, name });
    saveWatch();
    if (!addSheet.hidden) back();
    showToast(sym + " added");
    render();
    liveSync();
    fh("/quote", { symbol: sym }, { high: true }).then((q) => { if (q && q.c > 0) { quotes.set(sym, Object.assign({}, q)); saveQuotes(); render(); } }).catch(() => {});
  }
  function removeStock(sym) {
    watch = watch.filter((w) => w.sym !== sym);
    saveWatch();
    showToast(sym + " removed");
    render();
    liveSync();
  }

  /* ======================= price page ======================= */
  const page = $("page");
  let pageSym = null;
  const yearCache = new Map();
  function paintPageNumbers() {
    const q = quotes.get(pageSym);
    const ch = $("pg-change");
    if (ch) {
      ch.textContent = "";
      if (q) ch.append(el("span", "dd " + (q.d > 0 ? "up" : q.d < 0 ? "down" : ""), signedUsd(q.d)), pill(pageSym, true));
      ch.append(el("span", "when", "today · " + (isLive() ? "live" : q && q.t ? "as of " + clock(q.t * 1000) : statusLabel())));
    }
    const grid = $("pg-grid");
    if (grid) {
      const m = yearCache.get(pageSym);
      const cells = [
        ["Open", q && q.o], ["Previous close", q && q.pc],
        ["Day high", q && q.h], ["Day low", q && q.l],
        ["52-week high", m && m.hi], ["52-week low", m && m.lo]
      ];
      grid.textContent = "";
      for (const [label, v] of cells) {
        const c = el("div", "cell");
        c.append(el("span", null, label), el("b", null, usd(v)));
        grid.append(c);
      }
    }
  }
  function openPage(sym) {
    pageSym = sym;
    const w = watchOf(sym) || { sym, name: sym };
    page.hidden = false;
    pushOverlay(() => { page.hidden = true; pageSym = null; liveSync(); });
    liveSync();

    const head = $("pg-head");
    head.textContent = "";
    const logo = el("span", "logo");
    logoInto(logo, sym);
    const id = el("span", "pg-id");
    id.append(el("b", null, sym), el("small", null, w.name));
    const wb = el("button", "watchbtn");
    wb.type = "button";
    const paintWb = () => { const on = !!watchOf(sym); wb.setAttribute("aria-pressed", on ? "true" : "false"); wb.textContent = on ? "Watching" : "Watch"; };
    paintWb();
    wb.addEventListener("click", () => {
      if (watchOf(sym)) {
        if (wb.dataset.armed !== "1") { wb.dataset.armed = "1"; wb.textContent = "Tap to remove"; setTimeout(() => { wb.dataset.armed = ""; paintWb(); }, 3500); return; }
        wb.dataset.armed = "";
        removeStock(sym);
      } else addStock(sym, w.name);
      paintWb();
    });
    head.append(logo, id, wb);

    const body = $("pg-body");
    body.textContent = "";
    body.scrollTop = 0;
    const top = el("section", "sec");
    top.append(pxEl(sym, "big-px"));
    const ch = el("div", "line");
    ch.id = "pg-change";
    top.append(ch);
    const day = el("section", "sec");
    day.append(el("div", "lab", "Today's range"), rangeBar(sym, "day", true));
    const year = el("section", "sec");
    year.append(el("div", "lab", "52-week range"), rangeBar(sym, "year", true));
    const nums = el("section", "sec");
    const grid = el("div", "grid");
    grid.id = "pg-grid";
    nums.append(grid);
    body.append(top, day, year, nums, el("p", "about", "Today's range marks the open and the previous close. Prices come from Finnhub and can lag a little."));
    paintPageNumbers();

    if (!getKey()) return;
    fh("/quote", { symbol: sym }, { high: true }).then((q) => {
      if (!(q && q.c > 0)) return;
      const keep = quotes.get(sym);
      if (!(keep && isLive() && keep.t >= q.t)) quotes.set(sym, Object.assign({}, q));
      if (pageSym === sym) { paintPageNumbers(); body.querySelectorAll(".rng").forEach(paintRange); body.querySelectorAll(".px").forEach((n) => { n.textContent = usd(quotes.get(sym).c); }); }
    }).catch(() => {});
    fh("/stock/metric", { symbol: sym, metric: "all" }, { ttl: 12 * 3600e3, high: true }).then((j) => {
      const m = asObj(j && j.metric);
      const hi = m["52WeekHigh"], lo = m["52WeekLow"];
      if (Number.isFinite(hi) && Number.isFinite(lo) && hi > lo) yearCache.set(sym, { hi, lo });
      if (pageSym === sym) { paintPageNumbers(); body.querySelectorAll('.rng[data-kind="year"]').forEach(paintRange); }
    }).catch(() => {});
    profile(sym, true).then(() => paintLogos(sym)).catch(() => {});
  }
  $("pg-back").addEventListener("click", back);

  /* ======================= install ======================= */
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("install").hidden = false; });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; $("install").hidden = true; showToast("Tangent is on your home screen", 3000); });
  $("install").hidden = isStandalone() || !(isIOS || isAndroid);
  const SHARE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
  const DOTS_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  function renderInstall() {
    const body = $("install-body");
    body.textContent = "";
    if (deferredPrompt) {
      body.append(el("p", null, "One tap and Tangent gets its own icon and opens full screen."));
      const b = el("button", "bigbtn", "Install Tangent");
      b.type = "button";
      b.addEventListener("click", async () => { const p = deferredPrompt; deferredPrompt = null; try { await p.prompt(); await p.userChoice; } catch (e) {} back(); });
      body.append(b);
      return;
    }
    const steps = el("ol", "steps");
    const step = (html) => { const li = el("li"); const sp = el("span"); sp.innerHTML = html; li.append(sp); steps.append(li); };
    if (isIOS) {
      step("In Safari, tap the Share button " + SHARE_ICON + ".");
      step("Scroll down and tap <b>Add to Home Screen</b>.");
      step("Tap <b>Add</b>.");
    } else {
      step("In Chrome, tap the menu " + DOTS_ICON + " at the top right.");
      step("Tap <b>Install app</b> or <b>Add to Home screen</b>.");
      step("Confirm.");
    }
    body.append(steps);
  }
  const installSheet = $("install-sheet");
  $("install").addEventListener("click", () => { renderInstall(); installSheet.hidden = false; pushOverlay(() => { installSheet.hidden = true; }); });
  installSheet.addEventListener("click", (e) => { if (e.target === installSheet || e.target.closest("[data-close]")) back(); });

  /* ======================= keyboard ======================= */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlays.length) { back(); return; }
    if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "r" && !overlays.length) $("refresh").click();
  });

  /* ======================= start ======================= */
  render();
  refreshAll(false, true);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
  }

  // Hooks for automated tests; harmless in normal use.
  window.__tangent = { quotes, live, fhQ, watch: () => watch, openPage, refreshAll, connectKey, mstatus: () => mstatus, isLive };
})();
