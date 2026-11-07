(() => {
  "use strict";

  /* ======================= config ======================= */
  const WIKI = "https://en.wikipedia.org";
  const API = WIKI + "/w/api.php";
  const REST = WIKI + "/api/rest_v1";
  const ALT = "https://api.wikimedia.org/feed/v1/wikipedia/en";
  const THUMB_W = 960; // one of Wikimedia's standard thumbnail widths

  const KINDS = {
    news:     { label: "In the news",        h: 25 },
    trend:    { label: "Trending",           h: 292 },
    featured: { label: "Featured article",   h: 80 },
    picture:  { label: "Picture of the day", h: 245 },
    otd:      { label: "On this day",        h: 192 },
    random:   { label: "Random article",     h: 150 },
    topic:    { label: "Topic",              h: 335 },
    related:  { label: "Related",            h: 335 },
    quiz:     { label: "Quick quiz",         h: 55 },
    lesson:   { label: "Lesson",             h: 265 }
  };
  const MODES = [
    { id: "foryou", name: "For you" },
    { id: "news", name: "News" },
    { id: "trend", name: "Trending" },
    { id: "otd", name: "On this day" },
    { id: "random", name: "Random" }
  ];
  const COLLECTIONS = [
    { name: "The universe", h: 292, titles: ["Black hole", "Big Bang", "Saturn", "Neutron star", "Exoplanet", "Dark matter", "Voyager 1", "Milky Way"] },
    { name: "Computers and code", h: 250, titles: ["Transistor", "Turing machine", "Linux kernel", "Moore's law", "Internet", "Public-key cryptography", "Compiler", "Semiconductor device fabrication"] },
    { name: "How your mind works", h: 15, titles: ["Memory", "Sleep", "Cognitive bias", "Dopamine", "Placebo", "Flow (psychology)", "Procrastination", "Dunning–Kruger effect"] },
    { name: "Ancient worlds", h: 80, titles: ["Roman Empire", "Ancient Egypt", "Silk Road", "Mongol Empire", "Maya civilization", "Library of Alexandria", "Pompeii", "Indus Valley Civilisation"] },
    { name: "Money", h: 150, titles: ["Inflation", "Compound interest", "Stock market", "Bitcoin", "Great Depression", "Index fund", "Supply and demand", "Central bank"] },
    { name: "Planet Earth", h: 192, titles: ["Plate tectonics", "Volcano", "Amazon rainforest", "Great Barrier Reef", "Ice age", "Water cycle", "Mariana Trench", "Sahara"] }
  ];
  const REVIEW_DAYS = [1, 3, 7, 16, 35, 90];

  /* ======================= storage ======================= */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("tangent." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("tangent." + k, JSON.stringify(v)); } catch (e) {} }
  };
  const asArr = (v) => (Array.isArray(v) ? v : []);
  const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const okItem = (i) => i && typeof i.key === "string" && typeof i.title === "string" && KINDS[i.kind];
  const readSet = new Set(asArr(store.get("read", [])).filter((x) => typeof x === "string"));
  const saved = new Map(asArr(store.get("saved", [])).filter(okItem).map((i) => [i.key, i]));
  const liked = new Map(asArr(store.get("liked", [])).filter(okItem).map((i) => [i.key, i]));
  let topics = asArr(store.get("topics", [])).filter((t) => typeof t === "string" && t.trim()).slice(0, 12);
  const days = new Set(asArr(store.get("days", [])).filter((x) => typeof x === "string"));
  const lessons = asObj(store.get("lessons", {}));
  const reviews = asObj(store.get("reviews", {}));
  for (const k of Object.keys(reviews)) if (!reviews[k] || !okItem(reviews[k].item) || typeof reviews[k].due !== "string") delete reviews[k];
  const qstats = Object.assign({ n: 0, ok: 0 }, asObj(store.get("qstats", {})));
  let dailyQuiz = asObj(store.get("dailyQuiz", {}));
  const todayKey = () => new Date().toLocaleDateString("en-CA");
  const dayPlus = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
  let daily = store.get("daily", null);
  if (!daily || daily.d !== todayKey() || !Array.isArray(daily.ids)) daily = { d: todayKey(), ids: [] };
  const firstVisit = !store.get("visited", false);
  store.set("visited", true);
  let since = store.get("since", null);
  if (!since) { since = new Date().toISOString(); store.set("since", since); }
  const storySeen = asObj(store.get("storySeen", {}));

  const hasTopic = (t) => topics.some((x) => x.toLowerCase() === String(t).toLowerCase());
  const validMode = (m) => MODES.some((x) => x.id === m) || (typeof m === "string" && m.startsWith("t:") && topics.includes(m.slice(2)));
  let mode = store.get("mode", "foryou");
  if (!validMode(mode)) mode = "foryou";

  /* ======================= utils ======================= */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pad = (n) => String(n).padStart(2, "0");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const mobileUrl = (t) => "https://en.m.wikipedia.org/wiki/" + encodeURIComponent(String(t).replace(/ /g, "_"));
  const fmtDate = (d) => d.toLocaleDateString("en", { month: "short", day: "numeric" });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const parser = new DOMParser();
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));
  const cap1 = (s) => { s = String(s || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const pickRand = (a) => (a && a.length ? a[Math.floor(Math.random() * a.length)] : null);
  function htmlText(html) {
    if (!html) return "";
    try { return (parser.parseFromString(String(html), "text/html").body.textContent || "").replace(/\s+/g, " ").trim(); } catch (e) { return ""; }
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const yearText = (y) => (y < 0 ? -y + " BC" : String(y));

  async function getJSON(url, timeout = 12000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  function actionUrl(params) {
    const u = new URL(API);
    const all = Object.assign({ action: "query", format: "json", formatversion: "2", origin: "*" }, params);
    for (const k of Object.keys(all)) u.searchParams.set(k, String(all[k]));
    return u.toString();
  }
  const PAGE = { prop: "extracts|pageimages|description", exintro: 1, explaintext: 1, exlimit: "max", piprop: "thumbnail", pithumbsize: THUMB_W, pilicense: "any" };

  /* ======================= Wikipedia -> items ======================= */
  function resizeThumb(url, w) {
    const parts = String(url).split("/");
    const last = parts.pop();
    const r = last.replace(/(^|-)\d+px-/, "$1" + w + "px-");
    return r === last ? null : parts.join("/") + "/" + r;
  }
  function pickImg(s) {
    const o = s && s.originalimage, t = s && s.thumbnail;
    if (!o && !t) return null;
    const viewable = /\.(jpe?g|png|gif|webp|svg)$/i;
    if (o && o.source && o.width && o.width <= THUMB_W && viewable.test(o.source)) return { src: o.source, w: o.width, h: o.height };
    if (t && t.source) {
      const resized = resizeThumb(t.source, THUMB_W);
      if (o && o.width > THUMB_W && resized) return { src: resized, w: THUMB_W, h: Math.round((o.height * THUMB_W) / o.width), fallback: t.source };
      return { src: t.source, w: t.width, h: t.height };
    }
    return o && o.source && viewable.test(o.source) ? { src: o.source, w: o.width, h: o.height } : null;
  }
  function fromSummary(s, kind) {
    if (!s || !s.title || s.type === "disambiguation") return null;
    const title = (s.titles && s.titles.normalized) || s.normalizedtitle || String(s.title).replace(/_/g, " ");
    const url = (s.content_urls && s.content_urls.mobile && s.content_urls.mobile.page) || mobileUrl(title);
    return { key: title, kind, title, hook: title, desc: s.description || "", text: String(s.extract || "").trim(), img: pickImg(s), url, meta: {} };
  }
  function fromAction(p, kind) {
    if (!p || p.missing || p.invalid || !p.title) return null;
    const img = p.thumbnail && p.thumbnail.source ? { src: p.thumbnail.source, w: p.thumbnail.width, h: p.thumbnail.height } : null;
    return { key: p.title, kind, title: p.title, hook: p.title, desc: p.description || "", text: String(p.extract || "").trim(), img, url: mobileUrl(p.title), meta: {} };
  }
  const SKIP_TITLE = /^(Main Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:|Category:|Template:|User:|Draft:)/;
  function solid(it, min) {
    if (!it || !it.text || it.text.length < (min || 120)) return false;
    if (SKIP_TITLE.test(it.title)) return false;
    if (/may (also )?refer to/i.test(it.text.slice(0, 240)) && it.text.length < 500) return false;
    if (/disambiguation|Wikimedia list article|Wikimedia (category|template|project page)/i.test(it.desc)) return false;
    return true;
  }
  function otdItem(e) {
    if (!e || !e.text) return null;
    const pages = (e.pages || []).filter((p) => p && p.title && !/^\d+( BC)?$/.test(String(p.title).replace(/_/g, " ")));
    const p = pages.find((x) => x.extract && x.extract.length > 120) || pages[0];
    const it = p ? fromSummary(p, "otd") : null;
    if (!it) return null;
    it.hook = String(e.text).replace(/\s+/g, " ").trim();
    it.meta = { year: Number(e.year) };
    return it;
  }

  /* Pool of recently seen articles, used to build quiz answer choices. */
  const pool = new Map();
  function addPool(it) {
    if (!it || !it.key || it.kind === "picture" || it.kind === "quiz") return;
    pool.delete(it.key);
    pool.set(it.key, it);
    if (pool.size > 500) pool.delete(pool.keys().next().value);
  }
  const poolArr = () => [...pool.values()];

  /* ---------- daily feed: news, trending, featured, picture, on this day ---------- */
  const dayCache = new Map();
  function dayDate(off) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - off); return d; }
  function dayFeed(off) {
    if (dayCache.has(off)) return dayCache.get(off);
    const p = (async () => {
      const d = dayDate(off);
      const path = "/featured/" + d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
      let j;
      try { j = await getJSON(REST + "/feed" + path); }
      catch (e) { j = await getJSON(ALT + path); }
      return parseDay(j || {}, d, off);
    })();
    dayCache.set(off, p);
    p.catch(() => { if (dayCache.get(off) === p) dayCache.delete(off); });
    return p;
  }
  async function safeDay(off) { try { return await dayFeed(off); } catch (e) { return null; } }
  async function today() { return (await safeDay(0)) || (await safeDay(1)); }

  function parseDay(j, d, off) {
    const label = off === 0 ? "Today" : fmtDate(d);
    const out = { tfa: null, picture: null, news: [], trend: [], otd: [] };

    if (j.tfa) {
      const it = fromSummary(j.tfa, "featured");
      if (it && it.text) { it.meta = { date: label }; out.tfa = it; }
    }

    if (j.image) {
      const im = j.image;
      const img = pickImg({ originalimage: im.image, thumbnail: im.thumbnail });
      const caption = htmlText(im.description && im.description.html) || (im.description && im.description.text) || "";
      if (img) {
        const name = String(im.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").trim();
        out.picture = {
          key: im.title || "potd:" + d.toDateString(), kind: "picture", title: name || "Picture of the day",
          hook: name || "Picture of the day", desc: "", text: caption, img,
          url: im.file_page || "https://commons.wikimedia.org/wiki/" + encodeURIComponent(String(im.title || "").replace(/ /g, "_")),
          meta: { date: label, credit: htmlText(im.artist && im.artist.html) || (im.artist && im.artist.text) || "", license: (im.license && im.license.type) || "" }
        };
      }
    }

    for (const n of j.news || []) {
      const links = (n.links || []).filter(Boolean);
      if (!links.length) continue;
      let main = links[0];
      try {
        const doc = parser.parseFromString(n.story || "", "text/html");
        const a = doc.querySelector("b a[href]") || (doc.querySelector("a[href] b") || {}).parentElement;
        if (a) {
          const t = (a.getAttribute("title") || decodeURIComponent((a.getAttribute("href") || "").replace(/^\.\//, ""))).replace(/_/g, " ");
          const m = links.find((l) => ((l.titles && l.titles.normalized) || String(l.title).replace(/_/g, " ")) === t);
          if (m) main = m;
        }
      } catch (e) {}
      const it = fromSummary(main, "news");
      const story = htmlText(n.story);
      if (!it || !story) continue;
      it.hook = story;
      out.news.push(it);
    }

    const mr = j.mostread || {};
    let rank = 0;
    for (const a of mr.articles || []) {
      const it = fromSummary(a, "trend");
      if (!it || !solid(it, 60)) continue;
      it.meta = { rank: ++rank, views: a.views, hist: (a.view_history || []).map((v) => v && v.views).filter(Number.isFinite) };
      out.trend.push(it);
    }

    for (const e of j.onthisday || []) { const it = otdItem(e); if (it) out.otd.push(it); }
    [out.tfa, ...out.trend, ...out.news, ...out.otd].forEach(addPool);
    return out;
  }

  /* ---------- sources (async generators) ---------- */
  async function* dayGen(off0, offN, pick) {
    let miss = 0;
    for (let off = off0; off < offN; off++) {
      const d = await safeDay(off);
      if (!d) { if (++miss >= 2) throw new Error("offline"); continue; }
      miss = 0;
      for (const it of pick(d)) yield it;
    }
  }
  const newsGen = () => dayGen(0, 5, (d) => d.news);
  const trendGen = () => dayGen(0, 10, (d) => d.trend);
  const featuredGen = () => dayGen(0, 60, (d) => [d.tfa, d.picture].filter(Boolean));
  async function* otdGen() {
    const d = await safeDay(0);
    if (d) for (const it of d.otd) yield it;
    const now = dayDate(0);
    const md = pad(now.getMonth() + 1) + "/" + pad(now.getDate());
    let j = null;
    try { j = await getJSON(REST + "/feed/onthisday/events/" + md); }
    catch (e) {
      try { j = await getJSON(ALT + "/onthisday/events/" + md); }
      catch (e2) { if (!d) throw e2; return; }
    }
    for (const e of shuffle((j && j.events) || [])) { const it = otdItem(e); if (it) { addPool(it); yield it; } }
  }

  async function randomBatch() {
    const j = await getJSON(actionUrl(Object.assign({ generator: "random", grnnamespace: 0, grnlimit: 20 }, PAGE)));
    const pages = (j.query && j.query.pages) || [];
    const items = pages.map((p) => fromAction(p, "random")).filter(Boolean);
    items.forEach((it) => { if (solid(it, 120)) addPool(it); });
    return items.filter((it) => it.img && solid(it, 280) && !/^(List|Lists|Index|Outline|Timeline|Glossary) of /i.test(it.title));
  }
  let nextRandom = null;
  function takeRandom() {
    const p = nextRandom || randomBatch();
    nextRandom = randomBatch();
    nextRandom.catch(() => {});
    return p;
  }
  async function* randomGen() {
    let fails = 0, empty = 0;
    for (;;) {
      let batch;
      try { batch = await takeRandom(); fails = 0; }
      catch (e) { nextRandom = null; if (++fails >= 3) throw e; await sleep(700 * fails); continue; }
      if (!batch.length) { if (++empty >= 6) return; continue; }
      empty = 0;
      for (const it of batch) yield it;
    }
  }

  async function searchBatch(q, offset, limit) {
    const j = await getJSON(actionUrl(Object.assign({ generator: "search", gsrsearch: q, gsrnamespace: 0, gsrlimit: limit || 20, gsroffset: offset || 0 }, PAGE)));
    const pages = ((j.query && j.query.pages) || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    const next = j.continue && j.continue.gsroffset != null ? j.continue.gsroffset : null;
    return { pages, next };
  }
  async function* searchGen(q, kind, label, why) {
    let offset = 0, fails = 0;
    while (offset != null && offset < 400) {
      let r;
      try { r = await searchBatch(q, offset); fails = 0; }
      catch (e) { if (++fails >= 3) throw e; await sleep(700 * fails); continue; }
      for (const p of r.pages) {
        const it = fromAction(p, kind);
        if (it && solid(it, 100)) { it.meta = { label, why }; addPool(it); yield it; }
      }
      offset = r.next;
    }
  }
  const likedGens = () => [...liked.values()].slice(-6).reverse().map((x) => searchGen("morelike:" + x.title, "related", x.title, "liked"));
  const topicGens = () => topics.map((q) => searchGen(q, "topic", q));

  /* ======================= quizzes ======================= */
  const NOW_YEAR = new Date().getFullYear();
  function sentences(text) {
    return (String(text || "").replace(/\s+/g, " ").match(/[^.!?]+(?:[.!?]+["'\u201d\u2019)\]]*|$)/g) || []).map((s) => s.trim()).filter(Boolean);
  }
  function nearYears(y, n) {
    const out = new Set();
    const spans = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
    const lo = y < 1000 ? 1 : 1000;
    for (let g = 0; out.size < n && g < 300; g++) {
      const c = y + spans[Math.floor(Math.random() * spans.length)] * (Math.random() < 0.5 ? -1 : 1);
      if (c !== y && c <= NOW_YEAR && c >= lo) out.add(c);
    }
    return [...out];
  }
  const YEAR_RE = /\b(1[0-9]{3}|20[0-9]{2})\b/g;
  const NOT_YEAR_AFTER = /^\s?(km|kilomet|miles?\b|met(re|er)s?\b|m\b|ft\b|feet|kg|tonn?es?|tons?\b|people|persons|%|percent|species|units|copies|square|sq\b|hectares|acres|yards|inhabitants|residents|troops|soldiers|employees|students|members)/i;
  function yearCloze(text, subject) {
    const cands = [];
    for (const s of sentences(text)) {
      if (s.length < 40 || s.length > 280) continue;
      const ys = s.match(YEAR_RE);
      if (!ys || ys.length !== 1) continue;
      const y = Number(ys[0]);
      if (y > NOW_YEAR) continue;
      const at = s.indexOf(ys[0]);
      const before = s.slice(Math.max(0, at - 2), at), after = s.slice(at + 4);
      if (/[$£€¥#]\s?$/.test(before) || /[\d,.]$/.test(before.trim()) || NOT_YEAR_AFTER.test(after) || /^[,.]\d/.test(after)) continue;
      cands.push({ s, y });
    }
    if (!cands.length) return null;
    const c = cands[Math.floor(Math.random() * Math.min(cands.length, 4))];
    const wrong = nearYears(c.y, 3);
    if (wrong.length < 3) return null;
    const opts = shuffle([c.y, ...wrong]).map(String);
    return { type: "choice", kicker: "Fill in the year", prompt: "Which year completes the sentence?", context: c.s.replace(String(c.y), "____"), options: opts, answer: opts.indexOf(String(c.y)), explain: c.s, mark: String(c.y), subject };
  }
  function descMatch(it, list) {
    if (!it || !it.desc || it.desc.length < 6) return null;
    const mine = it.desc.toLowerCase();
    const seen = new Set([mine]);
    const picked = [];
    for (const o of shuffle(list || [])) {
      if (!o || o.key === it.key || !o.desc || o.desc.length < 6) continue;
      const d = o.desc.toLowerCase();
      if (seen.has(d) || d.includes(it.title.toLowerCase())) continue;
      seen.add(d);
      picked.push(cap1(o.desc));
      if (picked.length === 3) break;
    }
    if (picked.length < 3) return null;
    const right = cap1(it.desc);
    const opts = shuffle([right, ...picked]);
    return { type: "choice", kicker: "What is it?", prompt: "Which best describes " + it.title + "?", options: opts, answer: opts.indexOf(right), explain: it.title + ": " + it.desc + ".", subject: it };
  }
  function picMatch(it, list) {
    if (!it || !it.img || !it.img.src) return null;
    const used = new Set([it.img.src]);
    const others = [];
    for (const o of shuffle(list || [])) {
      if (!o || o.key === it.key || !o.img || !o.img.src || used.has(o.img.src)) continue;
      used.add(o.img.src);
      others.push(o);
      if (others.length === 3) break;
    }
    if (others.length < 3) return null;
    const opts = shuffle([it, ...others]);
    return { type: "pics", kicker: "Picture match", prompt: "Which picture goes with " + it.title + "?", context: it.desc ? cap1(it.desc) + "." : "", options: opts.map((o) => ({ src: o.img.src, fallback: o.img.fallback, label: o.title })), answer: opts.indexOf(it), explain: "That's " + it.title + ".", subject: it };
  }
  function otdYear(it) {
    const y = it && it.meta && it.meta.year;
    if (!Number.isFinite(y) || y < 1) return null;
    const wrong = nearYears(y, 3);
    if (wrong.length < 3) return null;
    const opts = shuffle([y, ...wrong]).map(String);
    return { type: "choice", kicker: "On this day", prompt: "In what year did this happen?", context: it.hook, options: opts, answer: opts.indexOf(String(y)), explain: "It happened on this day in " + y + ".", mark: String(y), subject: it };
  }
  function trendTop(list) {
    const c = (list || []).filter((t) => t.meta && Number.isFinite(t.meta.views)).slice(0, 25);
    if (c.length < 4) return null;
    for (let tries = 0; tries < 5; tries++) {
      const pick = shuffle(c).slice(0, 4);
      const views = pick.map((p) => p.meta.views);
      const max = Math.max(...views);
      if (views.filter((v) => v === max).length !== 1) continue;
      const best = pick[views.indexOf(max)];
      const opts = shuffle(pick);
      return { type: "choice", kicker: "Most read", prompt: "Which of these did the most people read on Wikipedia yesterday?", options: opts.map((o) => o.title), answer: opts.indexOf(best), explain: best.title + " had " + nf.format(best.meta.views) + " reads.", subject: best };
    }
    return null;
  }
  function reviewQuestion(item) {
    const makers = shuffle([() => yearCloze(item.text, item), () => descMatch(item, poolArr()), () => picMatch(item, poolArr())]);
    for (const m of makers) { const q = m(); if (q) return q; }
    return null;
  }
  function quizItem(q, review) {
    return { key: "quiz:" + q.kicker + ":" + (q.subject ? q.subject.key : "") + ":" + q.options.map((o) => (typeof o === "string" ? o : o.label)).join("|"), kind: "quiz", title: q.subject ? q.subject.title : "Quiz", hook: q.prompt, q, subject: q.subject, meta: { review: !!review } };
  }
  async function* quizGen() {
    const d = await today();
    const due = dueReviews();
    const otd = shuffle((d && d.otd) || []);
    const tr = (d && d.trend) || [];
    const trImg = shuffle(tr.filter((x) => x.img));
    const trDesc = shuffle(tr.filter((x) => x.desc));
    let ri = 0, a = 0, b = 0, c = 0, made = 0, fails = 0;
    const makers = [
      () => { while (ri < due.length) { const r = due[ri++]; const q = reviewQuestion(r.item); if (q) return quizItem(q, true); } return null; },
      () => (a < otd.length ? (q => q && quizItem(q))(otdYear(otd[a++])) : null),
      () => (b < trImg.length ? (q => q && quizItem(q))(picMatch(trImg[b++], poolArr())) : null),
      () => (q => q && quizItem(q))(trendTop(tr)),
      () => (c < trDesc.length ? (q => q && quizItem(q))(descMatch(trDesc[c++], poolArr())) : null)
    ];
    for (let i = 0; made < 40 && fails < 20; i++) {
      const q = makers[i % makers.length]();
      if (q) { made++; fails = 0; yield q; } else fails++;
    }
  }

  /* ======================= review schedule ======================= */
  function saveReviews() { store.set("reviews", reviews); }
  function scheduleReview(it) {
    if (!it || !it.key || it.kind === "picture" || it.kind === "quiz" || reviews[it.key]) return;
    if (!it.text && !it.desc && !it.img) return;
    reviews[it.key] = { item: slim(it), box: 0, due: dayPlus(REVIEW_DAYS[0]) };
    saveReviews();
  }
  function gradeReview(key, ok) {
    const r = reviews[key];
    if (!r) return;
    r.box = ok ? Math.min(r.box + 1, REVIEW_DAYS.length - 1) : 0;
    r.due = dayPlus(REVIEW_DAYS[r.box]);
    saveReviews();
  }
  function dueReviews() {
    const t = todayKey();
    return Object.values(reviews).filter((r) => r.due <= t).sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0));
  }
  function recordAnswer(ok) {
    qstats.n++;
    if (ok) qstats.ok++;
    store.set("qstats", qstats);
  }

  /* Mixes several sources by a repeating pattern; a dead or missing source falls back to the next one. */
  async function* mix(groups, PAT, fallback) {
    const rr = {};
    const alive = () => Object.keys(groups).some((k) => groups[k].length);
    let i = 0, lastErr = null, misses = 0;
    while (alive()) {
      let key = PAT[i++ % PAT.length];
      while (key && !(groups[key] && groups[key].length)) key = fallback[key];
      if (!key) {
        if (++misses < PAT.length) continue;
        key = Object.keys(groups).find((k) => groups[k].length);
      }
      misses = 0;
      const arr = groups[key];
      const idx = (rr[key] = (rr[key] == null ? 0 : rr[key] + 1)) % arr.length;
      const g = arr[idx];
      let r;
      try { r = await g.next(); } catch (e) { lastErr = e; arr.splice(idx, 1); continue; }
      if (r.done) { arr.splice(idx, 1); continue; }
      yield r.value;
    }
    if (lastErr) throw lastErr;
  }
  const FALLBACK = { quiz: "random", liked: "topic", topic: "random", random: "trend", featured: "trend", otd: "trend", news: "trend" };
  function forYouGen() {
    return mix(
      { news: [newsGen()], trend: [trendGen()], featured: [featuredGen()], otd: [otdGen()], random: [randomGen()], topic: topicGens(), liked: likedGens(), quiz: [quizGen()] },
      ["news", "trend", "featured", "random", "otd", "liked", "quiz", "trend", "topic", "news", "random", "liked", "trend", "otd", "topic", "quiz", "random", "featured", "liked", "trend", "news", "random", "otd", "topic", "trend", "liked", "random"],
      FALLBACK
    );
  }
  function exploreGen() {
    return mix(
      { trend: [trendGen()], random: [randomGen()], featured: [featuredGen()], topic: topicGens(), liked: likedGens() },
      ["trend", "random", "topic", "trend", "liked", "random", "featured", "topic", "random", "trend", "liked", "random"],
      FALLBACK
    );
  }
  function makeGen(id) {
    if (id === "news") return newsGen();
    if (id === "trend") return trendGen();
    if (id === "otd") return otdGen();
    if (id === "random") return randomGen();
    if (id.startsWith("t:")) { const q = id.slice(2); return searchGen(q, "topic", q); }
    return forYouGen();
  }

  /* ======================= icons ======================= */
  const svg = (inner, opts) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + ((opts && opts.w) || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  const sized = (s, n) => s.replace("<svg ", '<svg width="' + n + '" height="' + n + '" ');
  const ICON = {
    heart: svg('<path d="M12 20.5s-7.2-4.4-9.3-8.9C1.3 8.4 3.3 4.8 6.9 4.8c2.2 0 3.7 1.2 5.1 3.1 1.4-1.9 2.9-3.1 5.1-3.1 3.6 0 5.6 3.6 4.2 6.8-2.1 4.5-9.3 8.9-9.3 8.9z"/>', { w: 1.9 }),
    save: svg('<path d="M6 3h12v18l-6-4.5L6 21z"/>', { w: 1.9 }),
    send: svg('<path d="M21.5 3 10.2 14.3"/><path d="M21.5 3l-6.8 18-4.5-6.7L3.5 9.8z"/>', { w: 1.9 }),
    related: svg('<circle cx="10" cy="14" r="6"/><path d="M2.5 6.2 22 2.6"/><circle cx="8.9" cy="8" r="1.3" fill="currentColor" stroke="none"/>', { w: 1.9 }),
    book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>', { w: 2 }),
    out: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>',
    shareIOS: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>',
    plusSq: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
  };
  const GLYPH = {
    news: svg('<path d="M5 6h14M5 10h14M5 14h14M5 18h9"/>', { w: 2.3 }),
    trend: svg('<path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/>', { w: 2.3 }),
    otd: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', { w: 2.1 }),
    featured: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>', { w: 2 }),
    picture: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>', { w: 2 }),
    random: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>', { w: 2 }),
    topic: svg('<path d="M10 4 8 20M16 4 14 20M5 9h15M4 15h15"/>', { w: 2.2 }),
    related: svg('<circle cx="10" cy="14" r="6"/><path d="M2.5 6.2 22 2.6"/>', { w: 2.2 }),
    quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17.2" r=".9" fill="currentColor"/>', { w: 2.1 }),
    review: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>', { w: 2.2 }),
    lesson: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>', { w: 2.1 })
  };

  /* ======================= toast ======================= */
  const toast = $("toast");
  let toastTimer = null;
  function showToast(msg, { busy = false, action = null, hideAfter = 0 } = {}) {
    clearTimeout(toastTimer);
    toast.textContent = "";
    if (busy) { const d = el("span", "dots"); d.append(el("b"), el("b"), el("b")); toast.append(d); }
    toast.append(el("span", null, msg));
    toast.classList.toggle("noaction", !action);
    if (action) {
      const b = el("button", null, action.label);
      b.type = "button";
      b.addEventListener("click", action.run);
      toast.append(b);
    }
    toast.hidden = false;
    if (hideAfter) toastTimer = setTimeout(() => { toast.hidden = true; }, hideAfter);
  }

  /* ======================= media ======================= */
  function mkImg(cls, img, alt) {
    const im = document.createElement("img");
    im.className = cls;
    im.alt = alt || "";
    im.decoding = "async";
    im.dataset.src = img.src;
    if (img.fallback) im.dataset.fallback = img.fallback;
    im.addEventListener("load", () => im.classList.add("in"));
    return im;
  }
  function loadImg(im) { if (im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; } }
  /* An <img> that walks a list of URLs until one loads, then gives up quietly. */
  function chainImg(srcs, alt, onFail) {
    const list = srcs.filter(Boolean);
    const im = document.createElement("img");
    im.alt = alt || "";
    im.decoding = "async";
    let k = 0;
    im.addEventListener("load", () => im.classList.add("in"));
    im.addEventListener("error", () => { k++; if (k < list.length) im.src = list[k]; else if (onFail) onFail(im); });
    if (list.length) im.src = list[0]; else if (onFail) setTimeout(() => onFail(im), 0);
    return im;
  }
  function addGhost(host, it) {
    let g = null;
    if (it.kind === "trend" && it.meta && it.meta.rank) g = String(it.meta.rank);
    else if (it.kind === "otd" && it.meta && Number.isFinite(it.meta.year)) g = yearText(it.meta.year);
    if (g && !host.querySelector(".ghost")) host.prepend(el("div", "ghost", g));
  }
  function attachMedia(host, it) {
    const img = it.img && it.img.src ? it.img : null;
    if (!img) { host.classList.add("noimg"); addGhost(host, it); return []; }
    const ratio = img.w && img.h ? img.w / img.h : 1;
    const wide = it.kind === "picture" || ratio >= 0.9 || /\.svg|\.png$/i.test(img.src);
    const imgs = [];
    if (wide) {
      host.classList.add("wide");
      const bg = mkImg("bgimg", img);
      bg.setAttribute("aria-hidden", "true");
      bg.addEventListener("error", () => bg.remove());
      imgs.push(bg);
      host.append(bg);
    }
    const ph = mkImg("photo", img, it.title);
    imgs.push(ph);
    host.append(ph);
    ph.addEventListener("error", () => {
      if (ph.dataset.fallback) {
        const f = ph.dataset.fallback;
        delete ph.dataset.fallback;
        imgs.forEach((i) => { if (i.isConnected) i.src = f; });
        return;
      }
      imgs.forEach((i) => i.remove());
      host.classList.remove("wide");
      host.classList.add("noimg");
      addGhost(host, it);
      checkClip(host);
    });
    return imgs;
  }
  function sparkline(vals) {
    const NS = "http://www.w3.org/2000/svg";
    const w = 40, h = 13;
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("width", w); s.setAttribute("height", h);
    s.setAttribute("viewBox", "0 0 " + w + " " + h);
    s.setAttribute("class", "spark");
    s.setAttribute("aria-hidden", "true");
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 4) + 2, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
    const pl = document.createElementNS(NS, "polyline");
    pl.setAttribute("points", pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "));
    pl.setAttribute("fill", "none"); pl.setAttribute("stroke", "currentColor");
    pl.setAttribute("stroke-width", "1.6"); pl.setAttribute("stroke-linejoin", "round"); pl.setAttribute("stroke-linecap", "round");
    const dot = document.createElementNS(NS, "circle");
    const lp = pts[pts.length - 1];
    dot.setAttribute("cx", lp[0]); dot.setAttribute("cy", lp[1]); dot.setAttribute("r", "2.1"); dot.setAttribute("fill", "currentColor");
    s.append(pl, dot);
    return s;
  }
  /* Writes text into a node, wrapping numbers (or one given phrase) in <mark> like a highlighter. */
  const NUM_RE = /(\b\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d+(?:\.\d+)?)(\s?(?:%|percent|per cent|million|billion|trillion|thousand|km|kilometres|kilometers|miles|metres|meters|years|°C|°F|kg|tonnes|light-years))?/g;
  function markText(node, text, phrase, avoid) {
    text = String(text || "");
    if (phrase) {
      const at = text.indexOf(phrase);
      if (at >= 0) { node.append(text.slice(0, at), el("mark", null, phrase), text.slice(at + phrase.length)); return node; }
      node.append(text);
      return node;
    }
    const blocked = [];
    if (avoid) { let k = -1; while ((k = text.indexOf(avoid, k + 1)) >= 0) blocked.push([k, k + avoid.length]); }
    let last = 0, n = 0;
    for (const m of text.matchAll(NUM_RE)) {
      const s0 = m.index, s1 = m.index + m[0].length;
      if (n >= 2 || blocked.some(([a, z]) => s0 < z && s1 > a)) continue;
      if (/^\d$/.test(m[1]) && !m[2]) continue;
      if (/[-\u2013/:]$/.test(text.slice(0, s0)) || /^[-\u2013/:]\d/.test(text.slice(s1))) continue;
      if (s0 > last) node.append(text.slice(last, s0));
      node.append(el("mark", null, m[0]));
      last = s1;
      n++;
    }
    if (last < text.length) node.append(text.slice(last));
    return node;
  }
  function fillBlank(node, text) {
    const parts = String(text).split("____");
    parts.forEach((p, i) => { node.append(p); if (i < parts.length - 1) node.append(el("span", "blank", "\u2003")); });
    return node;
  }

  /* ======================= questions (shared by feed cards and lessons) ======================= */
  function buildQuestion(q, onAnswer) {
    const wrap = el("div", "qwrap");
    if (q.context) wrap.append(fillBlank(el("p", "qctx"), q.context));
    const pics = q.type === "pics";
    const box = el("div", pics ? "qpics" : "qopts");
    let done = false;
    const btns = q.options.map((o, idx) => {
      const b = el("button", pics ? "qpic" : "qopt");
      b.type = "button";
      if (pics) {
        b.setAttribute("aria-label", "Picture " + (idx + 1));
        b.append(chainImg([o.src, o.fallback], "", (im) => { im.remove(); b.classList.add("broken"); }));
      } else {
        b.append(el("span", "qletter", "ABCD"[idx]), el("span", "qtext", o));
      }
      b.addEventListener("click", (e) => { e.stopPropagation(); pick(idx); });
      box.append(b);
      return b;
    });
    wrap.append(box);
    const fb = el("div", "qfb");
    fb.hidden = true;
    wrap.append(fb);
    function pick(idx) {
      if (done) return;
      done = true;
      const ok = idx === q.answer;
      btns.forEach((b, k) => { b.disabled = true; b.classList.add(k === q.answer ? "right" : k === idx ? "wrong" : "dim"); });
      if (pics) btns.forEach((b, k) => b.append(el("span", "qlabel", q.options[k].label)));
      fb.hidden = false;
      fb.append(el("b", "qres " + (ok ? "ok" : "no"), ok ? "Correct" : "Not quite"));
      fb.append(markText(el("p", "qexp"), q.explain, q.mark));
      recordAnswer(ok);
      if (onAnswer) onAnswer(ok, fb);
    }
    wrap._pick = pick;
    wrap._done = () => done;
    return wrap;
  }

  /* ======================= reel ======================= */
  function whoEl(it) {
    const k = KINDS[it.kind] || KINDS.random;
    const m = it.meta || {};
    const row = el("div", "who");
    const ava = el("span", "ava");
    ava.innerHTML = GLYPH[it.kind] || GLYPH.random;
    row.append(ava);
    let name = k.label, sub = "", topic = null;
    if (it.kind === "trend") {
      if (m.rank) name = "Trending #" + m.rank;
      if (Number.isFinite(m.views)) sub = nf.format(m.views) + " reads";
    } else if (it.kind === "otd" && Number.isFinite(m.year)) {
      const ago = NOW_YEAR - m.year;
      sub = yearText(m.year) + (ago > 0 ? " · " + ago + "y ago" : "");
    } else if (it.kind === "featured" || it.kind === "picture") {
      sub = m.date || "";
    } else if (it.kind === "topic" && m.label) {
      name = "#" + m.label;
      topic = m.label;
    } else if (it.kind === "related" && m.label) {
      name = (m.why === "liked" ? "Because you liked " : "Related to ") + m.label;
      topic = m.label;
    }
    row.append(el("b", "name", name));
    if (sub) row.append(el("span", "sub", sub));
    if (it.kind === "trend" && m.hist && m.hist.length > 2) row.append(sparkline(m.hist));
    if (topic) {
      const f = el("button", "follow");
      f.type = "button";
      f.dataset.topic = topic;
      setFollow(f);
      f.addEventListener("click", (e) => { e.stopPropagation(); toggleFollow(topic); });
      row.append(f);
    }
    return row;
  }

  function ctaRow(it) {
    const row = el("div", "ctas");
    if (it.kind !== "picture") {
      const learn = el("button", "readpill primary");
      learn.type = "button";
      learn.innerHTML = sized(ICON.book, 16) + "<span>" + (lessons[it.title] && lessons[it.title].done ? "Learn again" : "Learn this") + "</span>";
      learn.addEventListener("click", (e) => { e.stopPropagation(); openLesson(it); });
      row.append(learn);
    }
    const read = el("a", "readpill");
    read.href = it.url;
    read.target = "_blank";
    read.rel = "noopener";
    read.innerHTML = "<span>" + (it.kind === "picture" ? "View full image" : "Wikipedia") + "</span>" + ICON.out;
    row.append(read);
    return row;
  }

  function captionEl(it, host, opts) {
    opts = opts || {};
    const sentence = it.kind === "news" || it.kind === "otd";
    const cap = el("div", "cap");
    if (!opts.story) cap.append(whoEl(it));
    cap.append(el("h2", "hook", it.hook || it.title));
    if (sentence) {
      const subj = el("p", "subject");
      subj.append(el("b", null, it.title));
      if (it.desc) subj.append(document.createTextNode(" "), el("span", null, it.desc));
      cap.append(subj);
    } else if (it.desc) {
      cap.append(el("p", "desc", it.desc));
    }
    if (it.text) {
      const t = el("p", "text", it.text);
      cap.append(t);
      if (!opts.story) {
        const more = el("button", "more", "more");
        more.type = "button";
        const toggle = (e) => {
          e.stopPropagation();
          const open = host.classList.toggle("open");
          more.textContent = open ? "less" : "more";
          if (!open) { cap.scrollTop = 0; checkClip(host); }
        };
        more.addEventListener("click", toggle);
        t.addEventListener("click", (e) => { if (host.classList.contains("clipped") || host.classList.contains("open")) toggle(e); });
        cap.append(more);
      }
    }
    if (it.kind === "picture" && it.meta && (it.meta.credit || it.meta.license)) {
      cap.append(el("p", "credit", [it.meta.credit ? "Image: " + it.meta.credit : "", it.meta.license].filter(Boolean).join(" · ")));
    }
    if (!opts.story) cap.append(ctaRow(it));
    if (opts.hint) {
      const h = el("div", "hint");
      h.innerHTML = ICON.up + "<span>Swipe up · double-tap to like</span>";
      cap.append(h);
    }
    return cap;
  }

  function railBtn(cls, icon, label, key) {
    const b = el("button", "rb " + cls);
    b.type = "button";
    b.innerHTML = icon;
    b.append(el("span", null, label));
    b.setAttribute("aria-label", label);
    if (key != null) b.dataset.key = key;
    return b;
  }
  function setPressed(b, on) { b.setAttribute("aria-pressed", on ? "true" : "false"); }

  function reelEl(it, feed, hint) {
    if (it.kind === "quiz") return quizReelEl(it);
    const k = KINDS[it.kind] || KINDS.random;
    const art = el("article", "reel k-" + it.kind);
    art.dataset.key = it.key;
    art.style.setProperty("--h", k.h);
    art._item = it;
    if (it.kind === "news" || it.kind === "otd") art.classList.add("sentence");
    attachMedia(art, it);
    art.append(el("div", "shade-top"), el("div", "shade"));
    art.append(captionEl(it, art, { hint }));

    const rail = el("div", "rail");
    const like = railBtn("like", ICON.heart, "Like", it.key);
    setPressed(like, liked.has(it.key));
    like.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(it); });
    rail.append(like);
    if (it.kind !== "picture") {
      const rel = railBtn("rel", ICON.related, "Related");
      rel.addEventListener("click", (e) => { e.stopPropagation(); loadRelated(it, art, rel, feed); });
      rail.append(rel);
    }
    const sh = railBtn("share", ICON.send, "Share");
    sh.addEventListener("click", (e) => { e.stopPropagation(); share(it); });
    rail.append(sh);
    const sv = railBtn("save", ICON.save, "Save", it.key);
    setPressed(sv, saved.has(it.key));
    sv.addEventListener("click", (e) => { e.stopPropagation(); toggleSave(it); });
    rail.append(sv);
    art.append(rail);
    return art;
  }

  function quizReelEl(it) {
    const q = it.q;
    const review = it.meta && it.meta.review;
    const art = el("article", "reel quiz noimg" + (review ? " is-review" : ""));
    art.dataset.key = it.key;
    art.style.setProperty("--h", review ? 150 : KINDS.quiz.h);
    art._item = it;
    const box = el("div", "qcard");
    const who = el("div", "who");
    const ava = el("span", "ava");
    ava.innerHTML = review ? GLYPH.review : GLYPH.quiz;
    who.append(ava, el("b", "name", review ? "Review" : "Quick quiz"), el("span", "sub", q.kicker));
    box.append(who, el("h2", "qprompt", q.prompt));
    box.append(buildQuestion(q, (ok, fb) => {
      if (review && it.subject) gradeReview(it.subject.key, ok);
      if (review) fb.append(el("p", "qnext", ok ? "Next review in " + REVIEW_DAYS[(reviews[it.subject.key] || { box: 0 }).box] + " days." : "It'll come back tomorrow."));
      if (it.subject && it.subject.title) {
        const row = el("div", "ctas");
        const learn = el("button", "readpill primary");
        learn.type = "button";
        learn.innerHTML = sized(ICON.book, 16) + "<span>Learn about " + it.subject.title + "</span>";
        learn.addEventListener("click", (e) => { e.stopPropagation(); openLesson(it.subject); });
        row.append(learn);
        fb.append(row);
      }
      updateLearnBadges();
    }));
    art.append(el("div", "shade-top"), box);
    return art;
  }

  function checkClip(card) {
    requestAnimationFrame(() => {
      if (card.classList.contains("open")) return;
      const t = card.querySelector(".cap .text"), h = card.querySelector(".cap .hook");
      const over = (n) => n && n.scrollHeight > n.clientHeight + 2;
      card.classList.toggle("clipped", !!(over(t) || over(h)));
    });
  }

  function messageReel({ ghost, kicker, title, body, buttons }) {
    const art = el("article", "reel util noimg");
    if (ghost) art.append(el("div", "ghost", ghost));
    const cap = el("div", "cap");
    const who = el("div", "who");
    const ava = el("span", "ava");
    ava.innerHTML = GLYPH.related;
    who.append(ava, el("b", "name", kicker));
    cap.append(who, el("h2", "hook", title));
    if (body) cap.append(el("p", "text", body));
    const actions = el("div", "actions");
    for (const b of buttons || []) {
      const btn = el("button", "ubtn" + (b.primary ? " primary" : ""), b.label);
      btn.type = "button";
      btn.addEventListener("click", (e) => { e.stopPropagation(); b.run(art); });
      actions.append(btn);
    }
    cap.append(actions);
    art.append(cap);
    return art;
  }
  function skeletonReel() {
    const art = el("article", "reel loading noimg");
    art.style.setProperty("--h", 285);
    art.setAttribute("aria-label", "Loading");
    const cap = el("div", "cap");
    const widths = [["44%", "1.6rem"], ["90%", "2rem"], ["70%", "2rem"], ["100%", "0.95rem"], ["84%", "0.95rem"], ["38%", "2.2rem"]];
    for (const [w, h] of widths) { const b = el("div", "sk"); b.style.width = w; b.style.height = h; cap.append(b); }
    art.append(cap);
    return art;
  }

  /* ======================= feed engine ======================= */
  class Feed {
    constructor(sc, opts) {
      this.sc = sc;
      this.opts = opts || {};
      this.gen = null;
      this.factory = null;
      this.token = 0;
      this.loading = false;
      this.exhausted = false;
      this.shown = new Set();
      this.skipRead = false;
      this.timers = new Map();
      this.io = new IntersectionObserver((es) => this.onSeen(es), { root: sc, threshold: 0.6 });
      this.imgIO = new IntersectionObserver((es) => {
        for (const e of es) if (e.isIntersecting) { this.imgIO.unobserve(e.target); loadImg(e.target); }
      }, { root: sc, rootMargin: "150% 0px" });
      let tick = false;
      sc.addEventListener("scroll", () => {
        if (tick) return;
        tick = true;
        requestAnimationFrame(() => { tick = false; this.maybeMore(); });
      }, { passive: true });
      let last = 0, lx = 0, ly = 0;
      sc.addEventListener("click", (e) => {
        const card = e.target.closest(".reel[data-key]");
        if (!card || card.classList.contains("quiz") || e.target.closest("button, a, .cap")) { last = 0; return; }
        const now = Date.now();
        if (now - last < 330 && Math.abs(e.clientX - lx) < 44 && Math.abs(e.clientY - ly) < 44) {
          last = 0;
          doubleTapLike(card, e.clientX, e.clientY);
        } else { last = now; lx = e.clientX; ly = e.clientY; }
      });
      sc.addEventListener("dblclick", (e) => e.preventDefault());
    }
    start(factory, { skipRead = false } = {}) {
      this.stop();
      this.sc.textContent = "";
      this.sc.scrollTop = 0;
      this.shown = new Set();
      this.skipRead = skipRead;
      this.factory = factory;
      this.gen = factory();
      this.exhausted = false;
      this.loadMore(5);
    }
    stop() {
      this.token++;
      this.loading = false;
      this.timers.forEach(clearTimeout);
      this.timers.clear();
      this.io.disconnect();
      this.imgIO.disconnect();
    }
    clear() { this.stop(); this.gen = null; this.sc.textContent = ""; }
    add(it, before) {
      this.shown.add(it.key);
      addPool(it);
      const hint = !!(this.opts.hint && !this.sc.querySelector(".reel[data-key]"));
      const c = reelEl(it, this, hint);
      this.sc.insertBefore(c, before || null);
      this.io.observe(c);
      c.querySelectorAll("img[data-src]").forEach((i) => this.imgIO.observe(i));
      checkClip(c);
      return c;
    }
    async loadMore(n) {
      if (this.loading || this.exhausted || !this.gen) return;
      this.loading = true;
      const my = this.token, g = this.gen;
      const sk = skeletonReel();
      this.sc.append(sk);
      let added = 0, skipped = 0, failed = false;
      const wasEmpty = !this.sc.querySelector(".reel[data-key]");
      try {
        while (added < n) {
          const r = await g.next();
          if (my !== this.token) return;
          if (r.done) { this.exhausted = true; break; }
          const it = r.value;
          if (!it || this.shown.has(it.key)) continue;
          if (this.skipRead && readSet.has(it.key) && skipped < 80) { skipped++; continue; }
          this.add(it, sk);
          if (wasEmpty && added === 0) this.sc.scrollTop = 0;
          added++;
        }
      } catch (e) {
        failed = true;
      } finally {
        if (my === this.token) {
          sk.remove();
          this.loading = false;
          if (failed) { this.exhausted = true; this.sc.append(this.errorReel()); }
          else if (this.exhausted) this.sc.append(this.opts.end ? this.opts.end() : caughtUp());
          else this.maybeMore();
        }
      }
    }
    maybeMore() { if (this.sc.scrollTop + this.sc.clientHeight * 3.5 >= this.sc.scrollHeight) this.loadMore(5); }
    errorReel() {
      const first = !this.sc.querySelector(".reel[data-key]");
      return messageReel({
        ghost: "?",
        kicker: "No connection",
        title: first ? "Couldn't reach Wikipedia." : "The feed stalled.",
        body: navigator.onLine === false ? "You're offline. Connect to the internet and try again." : "Wikipedia didn't answer. Check your connection, then try again.",
        buttons: [{ label: "Try again", primary: true, run: (art) => { art.remove(); this.exhausted = false; this.gen = this.factory(); this.loadMore(5); } }]
      });
    }
    onSeen(entries) {
      for (const e of entries) {
        const c = e.target, key = c.dataset.key;
        if (!key || c.classList.contains("quiz")) continue;
        if (e.isIntersecting) {
          if (!this.timers.has(c)) this.timers.set(c, setTimeout(() => { this.timers.delete(c); markRead(key); }, 1500));
        } else {
          if (this.timers.has(c)) { clearTimeout(this.timers.get(c)); this.timers.delete(c); }
          if (c.classList.contains("open")) {
            c.classList.remove("open");
            const m = c.querySelector(".more"); if (m) m.textContent = "more";
            const cp = c.querySelector(".cap"); if (cp) cp.scrollTop = 0;
            checkClip(c);
          }
        }
      }
    }
    index() { return Math.round(this.sc.scrollTop / Math.max(1, this.sc.clientHeight)); }
    current() { return this.sc.children[this.index()] || this.sc.firstElementChild; }
    scrollTo(node) { if (node) this.sc.scrollTo({ top: node.offsetTop, behavior: reduced ? "auto" : "smooth" }); }
    step(d) { const kids = this.sc.children; const i = Math.min(kids.length - 1, Math.max(0, this.index() + d)); this.scrollTo(kids[i]); }
    recheck() { this.sc.querySelectorAll(".reel[data-key]").forEach(checkClip); }
  }
  function caughtUp() {
    return messageReel({
      ghost: "✓",
      kicker: "Tangent",
      title: "You're all caught up.",
      body: "That's everything here for now. Head back, or go explore something new.",
      buttons: [{ label: "Back", primary: true, run: () => history.back() }]
    });
  }

  /* ======================= actions ======================= */
  function slim(it) {
    return { key: it.key, kind: it.kind === "quiz" ? "topic" : it.kind, title: it.title, hook: it.hook, desc: it.desc, text: String(it.text || "").slice(0, 2000), img: it.img, url: it.url, meta: it.meta || {} };
  }
  function syncKey(key) {
    const sel = '[data-key="' + esc(key) + '"]';
    document.querySelectorAll(".rb.like" + sel).forEach((b) => setPressed(b, liked.has(key)));
    document.querySelectorAll(".rb.save" + sel).forEach((b) => setPressed(b, saved.has(key)));
  }
  function popLike(key) {
    if (reduced) return;
    document.querySelectorAll('.rb.like[data-key="' + esc(key) + '"]').forEach((b) => { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
  }
  function toggleLike(it, forceOn) {
    if (liked.has(it.key) && !forceOn) liked.delete(it.key);
    else if (!liked.has(it.key)) { liked.set(it.key, slim(it)); popLike(it.key); scheduleReview(it); }
    store.set("liked", [...liked.values()].slice(-500));
    syncKey(it.key);
    if (tab === "you") renderYou();
  }
  function doubleTapLike(card, x, y) {
    const it = card._item;
    if (!it) return;
    toggleLike(it, true);
    const r = card.getBoundingClientRect();
    const b = el("div", "burst");
    b.innerHTML = ICON.heart;
    b.style.left = (x - r.left) + "px";
    b.style.top = (y - r.top) + "px";
    card.append(b);
    setTimeout(() => b.remove(), 950);
  }
  function toggleSave(it) {
    if (saved.has(it.key)) { saved.delete(it.key); showToast("Removed from saved", { hideAfter: 1400 }); }
    else { saved.set(it.key, slim(it)); scheduleReview(it); showToast("Saved. It'll come back in your review.", { hideAfter: 1800 }); }
    store.set("saved", [...saved.values()].slice(-500));
    syncKey(it.key);
    if (tab === "you") renderYou();
  }
  function setFollow(btn) {
    const on = hasTopic(btn.dataset.topic);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "Following" : "Follow";
  }
  function toggleFollow(t) {
    const on = hasTopic(t);
    if (on) topics = topics.filter((x) => x.toLowerCase() !== String(t).toLowerCase());
    else topics = [String(t).trim(), ...topics].slice(0, 12);
    store.set("topics", topics);
    document.querySelectorAll(".follow[data-topic]").forEach(setFollow);
    if (on && mode.toLowerCase() === ("t:" + t).toLowerCase()) setMode("foryou"); else renderTabs();
    storiesDirty = true;
    if (tab === "you") renderYou();
    showToast(on ? "Unfollowed #" + t : "Following #" + t + ". It's in your tabs now.", { hideAfter: 2200 });
  }
  async function loadRelated(it, art, btn, feed) {
    if (btn.disabled || !feed) return;
    btn.disabled = true;
    showToast("Finding articles like " + it.title + "…", { busy: true });
    try {
      const r = await searchBatch("morelike:" + it.title, 0, 12);
      let anchor = art.nextSibling, made = 0, first = null;
      for (const p of r.pages) {
        const rel = fromAction(p, "related");
        if (!rel || feed.shown.has(rel.key) || !solid(rel, 100)) continue;
        rel.meta = { label: it.title };
        const c = feed.add(rel, anchor);
        c.classList.add("fresh");
        if (!first) first = c;
        if (++made >= 6) break;
      }
      if (!made) { showToast("No new related articles for this one.", { hideAfter: 2400 }); btn.disabled = false; return; }
      showToast("Added " + made + " related " + (made === 1 ? "article" : "articles"), { hideAfter: 1800 });
      setTimeout(() => feed.scrollTo(first), 200);
    } catch (e) {
      showToast("Couldn't load related articles. Try again.", { hideAfter: 2600 });
      btn.disabled = false;
    }
  }
  async function share(it) {
    const text = it.hook && it.hook !== it.title ? it.hook : it.desc || it.title;
    if (navigator.share) {
      try { await navigator.share({ title: it.title, text, url: it.url }); } catch (e) {}
      return;
    }
    try { await navigator.clipboard.writeText(it.url); showToast("Link copied", { hideAfter: 1600 }); }
    catch (e) { showToast(it.url, { hideAfter: 5000 }); }
  }

  /* ======================= reading stats ======================= */
  function markRead(key) {
    if (!readSet.has(key)) { readSet.add(key); store.set("read", [...readSet].slice(-5000)); }
    const tk = todayKey();
    if (daily.d !== tk) daily = { d: tk, ids: [] };
    if (!daily.ids.includes(key)) { daily.ids.push(key); store.set("daily", daily); }
    markActiveDay();
    maybeNudgeInstall();
  }
  function markActiveDay() {
    const tk = todayKey();
    if (!days.has(tk)) { days.add(tk); store.set("days", [...days].slice(-400)); }
  }
  function streak() {
    const d = new Date();
    if (!days.has(d.toLocaleDateString("en-CA"))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(d.toLocaleDateString("en-CA"))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const lessonsDone = () => Object.keys(lessons).filter((t) => lessons[t] && lessons[t].done);

  /* ======================= overlays & back button ======================= */
  const overlays = [];
  function pushOverlay(close) {
    overlays.push(close);
    try { history.pushState({ tangent: overlays.length }, ""); } catch (e) {}
  }
  function back() { if (overlays.length) history.back(); }
  window.addEventListener("popstate", () => { const close = overlays.pop(); if (close) close(); });

  /* ======================= home ======================= */
  const app = $("app");
  let tab = "home";
  const homeFeed = new Feed($("home-feed"), {
    hint: firstVisit,
    end: () => messageReel({
      ghost: "✓",
      kicker: "Tangent",
      title: "You're all caught up.",
      body: mode === "news" ? "That's the news from the last few days." : "That's everything in this feed for now.",
      buttons: [
        { label: "Back to For you", primary: true, run: () => setMode("foryou") },
        { label: "Explore", run: () => showTab("explore") }
      ]
    })
  });

  function setMode(id, { force } = {}) {
    if (!validMode(id)) id = "foryou";
    if (id === mode && !force && homeFeed.sc.childElementCount) { homeTap(); return; }
    mode = id;
    store.set("mode", id);
    homeFeed.start(() => makeGen(id), { skipRead: id === "foryou" });
    renderTabs();
  }
  function homeTap() {
    if (homeFeed.sc.scrollTop > 8) { homeFeed.sc.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); return; }
    dayCache.clear();
    setMode(mode, { force: true });
    showToast("Fresh from Wikipedia", { hideAfter: 1400 });
  }
  function renderTabs() {
    const bar = $("tabs");
    bar.textContent = "";
    const mk = (id, name) => {
      const b = el("button", "tab", name);
      b.type = "button";
      b.setAttribute("aria-pressed", mode === id ? "true" : "false");
      b.addEventListener("click", () => setMode(id));
      bar.append(b);
    };
    for (const m of MODES) mk(m.id, m.name);
    for (const t of topics) mk("t:" + t, "#" + t);
    const add = el("button", "tab add", "+ Topic");
    add.type = "button";
    add.addEventListener("click", () => { showTab("explore"); $("search-input").focus(); });
    bar.append(add);
    const active = bar.querySelector('[aria-pressed="true"]');
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /* ======================= tabs ======================= */
  const SCROLLERS = { explore: "explore-scroll", learn: "learn-scroll", you: "you-scroll" };
  function showTab(t) {
    if (t === tab) {
      if (t === "home") homeTap();
      else if (t === "explore" && exploreView !== "home") resetSearch();
      else $(SCROLLERS[t]).scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      return;
    }
    tab = t;
    app.dataset.tab = t;
    for (const name of ["home", "explore", "learn", "you"]) $("screen-" + name).hidden = t !== name;
    document.querySelectorAll(".nav-btn").forEach((b) => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    toast.hidden = true;
    if (t === "explore") initExplore();
    if (t === "learn") renderLearn();
    if (t === "you") renderYou();
  }
  document.querySelectorAll(".nav-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

  /* ======================= viewer ======================= */
  const viewerFeed = new Feed($("viewer-feed"), {});
  function openViewer(title, factory) {
    $("viewer-title").textContent = title;
    $("viewer").hidden = false;
    viewerFeed.start(factory);
    pushOverlay(() => { $("viewer").hidden = true; viewerFeed.clear(); });
  }
  $("viewer-back").addEventListener("click", back);
  function openArticle(title) {
    openViewer(title, () => (async function* () {
      const j = await getJSON(actionUrl(Object.assign({ titles: title, redirects: 1 }, PAGE)));
      const p = ((j.query && j.query.pages) || [])[0];
      const it = fromAction(p, "topic");
      if (it) { it.meta = { label: it.title }; yield it; }
      yield* searchGen("morelike:" + ((it && it.title) || title), "related", (it && it.title) || title);
    })());
  }

  /* ======================= grids ======================= */
  const imgObs = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { imgObs.unobserve(e.target); loadImg(e.target); } }, { rootMargin: "400px 0px" });
  class Grid {
    constructor(container, foot, title) {
      this.c = container;
      this.foot = foot;
      this.title = title;
      this.items = [];
      this.keys = new Set();
      this.gen = null;
      this.done = true;
      this.pending = null;
      this.onOpen = null;
    }
    reset(factory, title) {
      if (title) this.title = title;
      this.items = [];
      this.keys = new Set();
      this.c.textContent = "";
      this.factory = factory;
      this.gen = factory ? factory() : null;
      this.done = !this.gen;
      this.pending = null;
      this.token = (this.token || 0) + 1;
      this.setFoot("idle");
    }
    setItems(items) {
      this.reset(null);
      for (const it of items) this.push(it);
    }
    more(n) {
      if (this.pending) return this.pending;
      if (this.done) return Promise.resolve(0);
      const my = this.token;
      this.setFoot("loading");
      this.pending = (async () => {
        let added = 0;
        try {
          while (added < n) {
            const r = await this.gen.next();
            if (my !== this.token) return 0;
            if (r.done) { this.done = true; break; }
            const it = r.value;
            if (!it || this.keys.has(it.key)) continue;
            this.push(it);
            added++;
          }
          if (my === this.token) this.setFoot(this.done ? (this.items.length ? "end" : "empty") : "idle");
        } catch (e) {
          if (my === this.token) { this.done = true; this.setFoot("error"); }
        }
        return added;
      })().finally(() => { if (my === this.token) this.pending = null; });
      return this.pending;
    }
    push(it) {
      const i = this.items.length;
      this.items.push(it);
      this.keys.add(it.key);
      addPool(it);
      this.c.append(tileEl(it, i, this));
    }
    setFoot(state) {
      if (!this.foot) return;
      this.foot.textContent = "";
      if (state === "loading") this.foot.append(el("div", "spin"));
      else if (state === "empty") this.foot.append(el("span", null, "No articles found. Try another word."));
      else if (state === "error") {
        const b = el("button", "ubtn", "Couldn't load. Try again");
        b.type = "button";
        b.addEventListener("click", () => { this.done = false; this.gen = this.factory(); this.more(12); });
        this.foot.append(b);
      }
    }
    open(i) {
      if (this.onOpen) { this.onOpen(this.items[i], i); return; }
      const grid = this;
      openViewer(this.title, () => (async function* () {
        let j = i;
        for (;;) {
          if (j < grid.items.length) { yield grid.items[j++]; continue; }
          if (grid.done) return;
          await grid.more(9);
          if (j >= grid.items.length && grid.done) return;
        }
      })());
    }
  }
  function tileEl(it, i, grid) {
    const k = KINDS[it.kind] || KINDS.random;
    const b = el("button", "tile");
    b.type = "button";
    b.style.setProperty("--h", k.h);
    b.setAttribute("aria-label", it.title);
    if (i % 10 === 2 || i % 10 === 6) b.classList.add("tall");
    if (it.img && it.img.src) {
      const im = mkImg("", { src: it.img.src }, "");
      im.addEventListener("error", () => {
        if (it.img.fallback && im.src !== it.img.fallback) { im.src = it.img.fallback; return; }
        im.remove(); b.classList.add("noimg"); b.append(el("span", null, it.title));
      });
      b.append(im);
      imgObs.observe(im);
    } else {
      b.classList.add("noimg");
      b.append(el("span", null, it.kind === "news" || it.kind === "otd" ? it.hook : it.title));
    }
    const tagKind = grid.onOpen ? "lesson" : ["trend", "news", "otd", "picture"].includes(it.kind) ? it.kind : null;
    if (tagKind) {
      const tag = el("span", "tag");
      tag.innerHTML = GLYPH[tagKind];
      b.append(tag);
    }
    b.addEventListener("click", () => grid.open(i));
    return b;
  }
  function watchFoot(grid, scroller) {
    const io = new IntersectionObserver(async (es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      for (let tries = 0; tries < 4; tries++) {
        const added = await grid.more(12);
        if (!added) break;
        const r = grid.foot.getBoundingClientRect(), s = scroller.getBoundingClientRect();
        if (r.top > s.bottom + 400) break;
      }
    }, { root: scroller, rootMargin: "500px 0px" });
    io.observe(grid.foot);
  }

  /* ======================= explore ======================= */
  const exploreGrid = new Grid($("grid"), $("grid-foot"), "Explore");
  const resultsGrid = new Grid($("rgrid"), $("rgrid-foot"), "");
  let exploreReady = false, storiesDirty = true, exploreView = "home", currentQuery = "";
  watchFoot(exploreGrid, $("explore-scroll"));
  watchFoot(resultsGrid, $("explore-scroll"));
  function initExplore() {
    if (!exploreReady) {
      exploreReady = true;
      exploreGrid.reset(exploreGen, "Explore");
      exploreGrid.more(18);
    }
    if (storiesDirty) renderStories();
  }
  function setExploreView(v) {
    exploreView = v;
    $("explore-home").hidden = v !== "home";
    $("suggest").hidden = v !== "suggest";
    $("results").hidden = v !== "results";
    $("search-cancel").hidden = v === "home";
  }
  function resetSearch() {
    $("search-input").value = "";
    $("search-input").blur();
    suggestToken++;
    setExploreView("home");
  }
  let suggestToken = 0, suggestTimer = null;
  $("search-input").addEventListener("input", () => {
    clearTimeout(suggestTimer);
    const q = $("search-input").value.trim();
    if (!q) { setExploreView("home"); return; }
    suggestTimer = setTimeout(() => suggest(q), 220);
  });
  $("search-input").addEventListener("focus", () => { $("search-cancel").hidden = false; });
  $("search-cancel").addEventListener("click", resetSearch);
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("search-input").value.trim();
    if (q) showResults(q);
  });
  async function suggest(q) {
    const my = ++suggestToken;
    const list = $("suggest");
    const render = (pages) => {
      list.textContent = "";
      const row = (thumb, title, small, run) => {
        const li = el("li");
        const b = el("button");
        b.type = "button";
        const th = el("span", "th");
        if (typeof thumb === "string") th.innerHTML = thumb; else th.append(thumb);
        const tx = el("span", "tx");
        tx.append(el("b", null, title));
        if (small) tx.append(el("small", null, small));
        b.append(th, tx);
        b.addEventListener("click", run);
        li.append(b);
        list.append(li);
      };
      row(ICON.search, q, "See all articles about this", () => showResults(q));
      for (const p of pages) {
        let th = GLYPH.topic;
        if (p.thumbnail && p.thumbnail.source) { const im = new Image(); im.alt = ""; im.src = p.thumbnail.source; th = im; }
        row(th, p.title, p.description || "", () => { $("search-input").blur(); openArticle(p.title); });
      }
    };
    setExploreView("suggest");
    render([]);
    try {
      const j = await getJSON(actionUrl({ generator: "prefixsearch", gpssearch: q, gpsnamespace: 0, gpslimit: 8, prop: "pageimages|description", piprop: "thumbnail", pithumbsize: 120, pilimit: 8, pilicense: "any" }));
      if (my !== suggestToken) return;
      const pages = ((j.query && j.query.pages) || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
      render(pages);
    } catch (e) { /* keep the "see all" row */ }
  }
  function showResults(q) {
    q = q.replace(/\s+/g, " ").trim().slice(0, 100);
    if (!q) return;
    suggestToken++;
    currentQuery = q;
    $("search-input").value = q;
    $("search-input").blur();
    $("results-title").textContent = "#" + q;
    const f = $("results-follow");
    f.dataset.topic = q;
    setFollow(f);
    setExploreView("results");
    $("explore-scroll").scrollTop = 0;
    resultsGrid.reset(() => searchGen(q, "topic", q), "#" + q);
    resultsGrid.more(18);
  }
  $("results-follow").addEventListener("click", () => { if (currentQuery) toggleFollow(currentQuery); });

  /* ---------- story rings ---------- */
  const STORY_BASE = [
    { id: "today", name: "Today", kind: "featured" },
    { id: "news", name: "News", kind: "news" },
    { id: "trend", name: "Trending", kind: "trend" },
    { id: "otd", name: "On this day", kind: "otd" },
    { id: "random", name: "Random", kind: "random" }
  ];
  const storyCache = new Map();
  const storyDefs = () => STORY_BASE.concat(topics.map((t) => ({ id: "t:" + t, name: t, kind: "topic" })));
  function storyItems(id) {
    if (storyCache.has(id)) return storyCache.get(id);
    const p = (async () => {
      if (id.startsWith("t:")) {
        const q = id.slice(2);
        const r = await searchBatch(q, 0, 14);
        return r.pages.map((x) => { const it = fromAction(x, "topic"); if (it) it.meta = { label: q }; return it; }).filter((it) => it && solid(it, 100)).slice(0, 8);
      }
      if (id === "random") return (await takeRandom()).slice(0, 8);
      const d = await today();
      if (!d) throw new Error("offline");
      if (id === "today") return [d.tfa, d.picture].filter(Boolean);
      if (id === "news") return d.news.slice(0, 8);
      if (id === "trend") return d.trend.slice(0, 10);
      if (id === "otd") return d.otd.slice().sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0)).slice(0, 10);
      return [];
    })();
    storyCache.set(id, p);
    p.catch(() => { if (storyCache.get(id) === p) storyCache.delete(id); });
    return p;
  }
  function renderStories() {
    storiesDirty = false;
    const row = $("stories");
    row.textContent = "";
    for (const def of storyDefs()) {
      const k = KINDS[def.kind];
      const b = el("button", "story-btn");
      b.type = "button";
      b.dataset.story = def.id;
      b.style.setProperty("--h", k.h);
      b.setAttribute("aria-label", def.name + " story");
      if (storySeen[def.id] === todayKey()) b.classList.add("seen");
      const ring = el("span", "ring");
      const inner = el("span", "in");
      inner.innerHTML = GLYPH[def.kind];
      ring.append(inner);
      b.append(ring, el("span", "nm", def.name));
      b.addEventListener("click", () => openStory(def.id));
      row.append(b);
      storyItems(def.id).then((items) => {
        const withImg = items.find((x) => x.img && x.img.src);
        if (withImg) {
          const im = new Image();
          im.alt = "";
          im.onload = () => { inner.textContent = ""; inner.append(im); };
          im.src = withImg.img.src;
        }
        if (!items.length) b.classList.add("empty");
      }).catch(() => b.classList.add("empty"));
    }
  }

  /* ======================= story viewer ======================= */
  const st = { defs: [], gi: 0, si: 0, items: null, elapsed: 0, last: 0, paused: false, hold: false, raf: 0, dur: 8000, open: false, holdT: 0, down: null, readT: 0, loadTok: 0 };
  const storyEl = $("story"), stage = $("st-stage");
  $("st-like").innerHTML = ICON.heart;
  $("st-share").innerHTML = ICON.send;
  $("st-learn").insertAdjacentHTML("afterbegin", sized(ICON.book, 17));
  function openStory(id) {
    st.defs = storyDefs();
    st.open = true;
    storyEl.hidden = false;
    pushOverlay(closeStoryNow);
    showGroup(Math.max(0, st.defs.findIndex((d) => d.id === id)), 0);
  }
  function closeStoryNow() {
    st.open = false;
    cancelAnimationFrame(st.raf);
    clearTimeout(st.readT);
    clearTimeout(st.holdT);
    storyEl.hidden = true;
    stage.textContent = "";
    document.querySelectorAll(".story-btn").forEach((b) => b.classList.toggle("seen", storySeen[b.dataset.story] === todayKey()));
  }
  async function showGroup(gi, si) {
    st.gi = gi;
    st.items = null;
    cancelAnimationFrame(st.raf);
    const def = st.defs[gi];
    const tok = ++st.loadTok;
    $("st-name").textContent = def.name;
    $("st-when").textContent = "";
    const ava = $("st-ava");
    ava.style.setProperty("--h", KINDS[def.kind].h);
    ava.innerHTML = GLYPH[def.kind];
    $("st-bars").textContent = "";
    stage.textContent = "";
    const ld = el("div", "st-loading");
    ld.append(el("div", "spin"));
    stage.append(ld);
    let items = [];
    try { items = await storyItems(def.id); } catch (e) { items = []; }
    if (!st.open || tok !== st.loadTok) return;
    if (!items.length) {
      if (gi + 1 < st.defs.length) return showGroup(gi + 1, 0);
      return back();
    }
    st.items = items;
    storySeen[def.id] = todayKey();
    store.set("storySeen", storySeen);
    const bars = $("st-bars");
    for (let i = 0; i < items.length; i++) { const b = el("div", "st-bar"); b.append(el("i")); bars.append(b); }
    const cover = items.find((x) => x.img && x.img.src);
    if (cover) { const im = new Image(); im.alt = ""; im.onload = () => { ava.textContent = ""; ava.append(im); }; im.src = cover.img.src; }
    showSlide(Math.min(si, items.length - 1));
  }
  function showSlide(si) {
    st.si = si;
    const def = st.defs[st.gi];
    const it = st.items[si];
    const m = it.meta || {};
    let when = "";
    if (it.kind === "trend" && m.rank) when = "#" + m.rank + (Number.isFinite(m.views) ? " · " + nf.format(m.views) + " reads" : "");
    else if (it.kind === "otd" && Number.isFinite(m.year)) when = yearText(m.year);
    else if (m.date) when = m.date;
    else if (def.id === "random") when = "Random";
    $("st-when").textContent = when;
    stage.textContent = "";
    const slide = el("div", "reel k-" + it.kind);
    slide.style.setProperty("--h", (KINDS[it.kind] || KINDS.random).h);
    if (it.kind === "news" || it.kind === "otd") slide.classList.add("sentence");
    attachMedia(slide, it).forEach(loadImg);
    slide.append(el("div", "shade-top"), el("div", "shade"));
    slide.append(captionEl(it, slide, { story: true }));
    stage.append(slide);
    const bars = $("st-bars").children;
    for (let i = 0; i < bars.length; i++) bars[i].firstChild.style.width = i < si ? "100%" : "0%";
    const read = $("st-read");
    read.href = it.url;
    read.setAttribute("aria-label", it.kind === "picture" ? "View full image" : "Read on Wikipedia");
    $("st-learn").hidden = it.kind === "picture";
    const like = $("st-like");
    like.dataset.key = it.key;
    setPressed(like, liked.has(it.key));
    const next = st.items[si + 1];
    if (next && next.img && next.img.src) { const pre = new Image(); pre.src = next.img.src; }
    st.elapsed = 0;
    st.last = performance.now();
    st.hold = false;
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(storyTick);
    clearTimeout(st.readT);
    st.readT = setTimeout(() => markRead(it.key), 2000);
  }
  function storyTick(now) {
    if (!st.open || !st.items) return;
    const dt = now - st.last;
    st.last = now;
    if (!st.paused && !st.hold && !document.hidden) st.elapsed += dt;
    const p = Math.min(1, st.elapsed / st.dur);
    const bar = $("st-bars").children[st.si];
    if (bar) bar.firstChild.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) { storyNext(); return; }
    st.raf = requestAnimationFrame(storyTick);
  }
  function storyNext() {
    if (!st.items) return;
    if (st.si + 1 < st.items.length) showSlide(st.si + 1);
    else if (st.gi + 1 < st.defs.length) showGroup(st.gi + 1, 0);
    else back();
  }
  function storyPrev() {
    if (!st.items) return;
    if (st.si > 0) showSlide(st.si - 1);
    else if (st.gi > 0) showGroup(st.gi - 1, 0);
    else showSlide(0);
  }
  stage.addEventListener("pointerdown", (e) => {
    st.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    clearTimeout(st.holdT);
    st.holdT = setTimeout(() => { st.hold = true; storyEl.classList.add("held"); }, 220);
  });
  stage.addEventListener("pointerup", (e) => {
    clearTimeout(st.holdT);
    const d = st.down;
    st.down = null;
    storyEl.classList.remove("held");
    st.hold = false;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = performance.now() - d.t;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { back(); return; }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) { if (st.gi + 1 < st.defs.length) showGroup(st.gi + 1, 0); else back(); }
      else if (st.gi > 0) showGroup(st.gi - 1, 0);
      return;
    }
    if (dt < 260) { const r = stage.getBoundingClientRect(); if (e.clientX - r.left < r.width * 0.3) storyPrev(); else storyNext(); }
  });
  stage.addEventListener("pointercancel", () => { clearTimeout(st.holdT); st.down = null; st.hold = false; storyEl.classList.remove("held"); });
  stage.addEventListener("contextmenu", (e) => e.preventDefault());
  $("st-close").addEventListener("click", back);
  $("st-like").addEventListener("click", () => { const it = st.items && st.items[st.si]; if (it) toggleLike(it); });
  $("st-share").addEventListener("click", () => { const it = st.items && st.items[st.si]; if (it) { st.paused = true; share(it).finally(() => { st.paused = false; }); } });
  $("st-read").addEventListener("click", () => { st.paused = true; setTimeout(() => { st.paused = false; }, 1500); });
  $("st-learn").addEventListener("click", () => { const it = st.items && st.items[st.si]; if (it) openLesson(it); });

  /* ======================= lessons ======================= */
  const SKIP_SEC = /^(see also|references|notes|external links|further reading|bibliography|sources|citations|footnotes|gallery|works cited|explanatory notes|notes and references|references and notes|primary sources|secondary sources|literature|publications|selected works|selected publications|filmography|discography|awards|awards and honou?rs|honou?rs|works|cited sources|general and cited sources|general sources|list of works|in popular culture|popular culture)$/i;
  const ICON_FILE = /(icon|logo|flag of|symbol|commons-logo|wiki(pedia|data|quote|source|books|media)|disambig|padlock|question_book|edit-clear|ambox|crystal_clear|nuvola|loudspeaker|speaker|sound-icon|portal|folder|text-x|gnome|emblem|red_pog|blue_pog|location_dot|map_pin|signature)/i;
  function parseSections(text) {
    const secs = [{ title: "", level: 1, idx: 0, paras: [] }];
    let n = 0;
    for (const raw of String(text || "").split("\n")) {
      const line = raw.trim();
      const m = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
      if (m) { n++; secs.push({ title: m[2], level: m[1].length, idx: n, paras: [] }); }
      else if (line) secs[secs.length - 1].paras.push(line);
    }
    return secs;
  }
  function groupSections(secs) {
    const groups = [];
    for (const s of secs.slice(1)) {
      if (s.level === 2 || !groups.length) groups.push({ title: s.title, ids: [s.idx], paras: s.paras.slice(), order: groups.length });
      else { const g = groups[groups.length - 1]; g.ids.push(s.idx); g.paras.push(...s.paras); }
    }
    return groups.filter((g) => !SKIP_SEC.test(g.title));
  }
  function excerpt(paras, maxChars, maxSent) {
    const ss = sentences(paras.join(" ")).filter((s) => s.length > 20);
    const out = [];
    let len = 0;
    for (const s of ss) {
      if (out.length >= maxSent || (out.length && len + s.length > maxChars)) break;
      out.push(s);
      len += s.length;
    }
    return out;
  }
  function mediaSrcs(m) {
    const ss = ((m && m.srcset) || []).map((s) => s && s.src).filter(Boolean).map((u) => (u.startsWith("//") ? "https:" + u : u));
    if (!ss.length) return null;
    return [resizeThumb(ss[0], THUMB_W), resizeThumb(ss[0], 500), ss[ss.length - 1], ss[0]].filter(Boolean);
  }
  async function buildLesson(seed) {
    const title = seed.title;
    const [j, media] = await Promise.all([
      getJSON(actionUrl({ titles: title, redirects: 1, prop: "extracts|pageimages|description", explaintext: 1, exsectionformat: "wiki", piprop: "thumbnail", pithumbsize: THUMB_W, pilicense: "any" }), 20000),
      getJSON(REST + "/page/media-list/" + encodeURIComponent(String(title).replace(/ /g, "_")), 12000).catch(() => null)
    ]);
    const p = ((j.query && j.query.pages) || [])[0];
    if (!p || p.missing || !p.extract) throw new Error("missing");
    const secs = parseSections(p.extract);
    const leadText = secs[0].paras.join("\n");
    const item = {
      key: p.title, kind: seed.kind && seed.kind !== "quiz" && seed.kind !== "picture" ? seed.kind : "topic",
      title: p.title, hook: p.title, desc: p.description || seed.desc || "", text: leadText.slice(0, 2000),
      img: p.thumbnail && p.thumbnail.source ? { src: p.thumbnail.source, w: p.thumbnail.width, h: p.thumbnail.height } : (seed.img || null),
      url: mobileUrl(p.title), meta: seed.meta || {}
    };

    const bySec = new Map();
    for (const m of (media && media.items) || []) {
      if (!m || m.type !== "image" || m.showInGallery === false || ICON_FILE.test(m.title || "")) continue;
      const srcs = mediaSrcs(m);
      if (!srcs) continue;
      const sid = Number(m.section_id) || 0;
      if (!bySec.has(sid)) bySec.set(sid, []);
      bySec.get(sid).push({ srcs, caption: (m.caption && m.caption.text) || "", photo: /\.jpe?g$/i.test(m.title || "") });
    }
    const used = new Set();
    const takeImg = (ids) => {
      for (const id of ids) for (const im of bySec.get(id) || []) if (!used.has(im.srcs[0])) { used.add(im.srcs[0]); return im; }
      return null;
    };
    const leadImg = item.img ? { srcs: [item.img.src, item.img.fallback], caption: "", photo: !/\.svg|\.png/i.test(item.img.src) } : takeImg([0]);
    if (leadImg) used.add(leadImg.srcs[0]);
    const leadFile = item.img && item.img.src ? decodeURIComponent(item.img.src.split("/").pop().replace(/^\d+px-/, "")) : "";
    for (const list of bySec.values()) for (const im of list) if (leadFile && decodeURIComponent(im.srcs[0].split("/").pop().replace(/^\d+px-/, "")) === leadFile) used.add(im.srcs[0]);

    const slides = [];
    const intro = excerpt(secs[0].paras, 460, 3);
    let words = intro.join(" ").split(/\s+/).length;
    if (intro.length) slides.push({ t: "text", kicker: "In short", lead: intro[0], rest: intro.slice(1).join(" "), img: takeImg([0]) || null });

    let groups = groupSections(secs).map((g) => {
      const ex = excerpt(g.paras, 440, 3);
      const len = ex.join(" ").length;
      const hasImg = g.ids.some((id) => (bySec.get(id) || []).length);
      return Object.assign(g, { ex, score: (len >= 180 ? 2 : len >= 90 ? 1 : 0) + (hasImg ? 1.5 : 0) });
    }).filter((g) => g.ex.length && g.ex.join(" ").length >= 90);
    if (groups.length > 6) groups = groups.slice().sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 6).sort((a, b) => a.order - b.order);
    groups.forEach((g, i) => {
      words += g.ex.join(" ").split(/\s+/).length;
      slides.push({ t: "text", kicker: pad(i + 1) + " · " + g.title, lead: g.ex[0], rest: g.ex.slice(1).join(" "), img: takeImg(g.ids) });
    });
    if (!slides.length) throw new Error("empty");

    const qs = [];
    const usedSent = new Set();
    for (const s of shuffle(slides.filter((x) => x.t === "text"))) {
      if (qs.length >= 2) break;
      const q = yearCloze(s.lead + " " + s.rest, item);
      if (q && !usedSent.has(q.explain)) { usedSent.add(q.explain); qs.push(q); }
    }
    const dq = descMatch(item, poolArr());
    if (dq) qs.push(dq);
    qs.forEach((q, i) => slides.push({ t: "quiz", q, qi: i, qn: qs.length }));

    const minutes = Math.max(1, Math.round((words + qs.length * 25) / 180));
    slides.unshift({ t: "cover", img: leadImg, minutes, count: slides.length });
    slides.push({ t: "end" });
    return { item, slides, minutes };
  }

  const ls = { open: false, mode: "lesson", title: "", item: null, slides: [], i: 0, answered: {}, tok: 0, down: null, hue: 265, fromStory: false, minutes: 1 };
  const lessonEl = $("lesson"), lsStage = $("ls-stage");
  function lessonShell(title, hue) {
    ls.hue = hue;
    lessonEl.style.setProperty("--h", hue);
    $("ls-title").textContent = title;
    $("ls-bars").textContent = "";
  }
  function openOverlayLesson() {
    if (ls.open) return;
    ls.open = true;
    lessonEl.hidden = false;
    ls.fromStory = st.open;
    if (st.open) st.paused = true;
    pushOverlay(closeLessonNow);
  }
  function closeLessonNow() {
    ls.open = false;
    ls.tok++;
    lessonEl.hidden = true;
    lsStage.textContent = "";
    if (ls.fromStory && st.open) st.paused = false;
    homeFeed.sc.querySelectorAll(".ctas .readpill.primary span").forEach((s) => {
      const card = s.closest(".reel");
      if (card && card._item && lessons[card._item.title] && lessons[card._item.title].done) s.textContent = "Learn again";
    });
    if (tab === "learn") renderLearn();
    if (tab === "you") renderYou();
  }
  function lsLoading(msg) {
    lsStage.textContent = "";
    const card = el("div", "ls-card t-loading");
    const body = el("div", "ls-body center");
    body.append(el("div", "spin"), el("p", "ls-muted", msg));
    card.append(body);
    lsStage.append(card);
  }
  function lsError(msg, retry) {
    lsStage.textContent = "";
    const card = el("div", "ls-card t-end");
    const body = el("div", "ls-body center");
    body.append(el("h2", "ls-h", "Couldn't build this one."), el("p", "ls-muted", msg));
    const row = el("div", "ls-actions");
    if (retry) { const b = el("button", "ls-btn primary", "Try again"); b.type = "button"; b.addEventListener("click", retry); row.append(b); }
    const c = el("button", "ls-btn", "Close"); c.type = "button"; c.addEventListener("click", back); row.append(c);
    body.append(row);
    card.append(body);
    lsStage.append(card);
  }
  async function openLesson(seed, opts) {
    if (!seed || !seed.title) return;
    opts = opts || {};
    const tok = ++ls.tok;
    ls.mode = "lesson";
    ls.answered = {};
    ls.slides = [];
    lessonShell(seed.title, (KINDS[seed.kind] || KINDS.lesson).h);
    openOverlayLesson();
    lsLoading("Turning “" + seed.title + "” into a lesson…");
    try {
      const L = await buildLesson(seed);
      if (tok !== ls.tok) return;
      ls.item = L.item;
      ls.title = L.item.title;
      ls.slides = L.slides;
      ls.minutes = L.minutes;
      $("ls-title").textContent = L.item.title;
      const prev = lessons[L.item.title];
      const start = !opts.restart && prev && !prev.done && prev.slide > 0 && prev.slide < L.slides.length - 1 ? prev.slide : 0;
      lessons[L.item.title] = Object.assign({}, prev || {}, { item: slim(L.item), total: L.slides.length, at: Date.now(), slide: start, done: !!(prev && prev.done) });
      store.set("lessons", lessons);
      renderBars();
      lsShow(start);
    } catch (e) {
      if (tok !== ls.tok) return;
      lsError(navigator.onLine === false ? "You're offline. Connect and try again." : "Wikipedia didn't send the full article. Try again in a moment.", () => openLesson(seed, opts));
    }
  }
  function openSession(kind, title, slides, hue) {
    ls.tok++;
    ls.mode = kind;
    ls.item = null;
    ls.title = title;
    ls.answered = {};
    ls.slides = slides;
    lessonShell(title, hue);
    openOverlayLesson();
    renderBars();
    lsShow(0);
  }
  function renderBars() {
    const bars = $("ls-bars");
    bars.textContent = "";
    ls.slides.forEach((s) => { if (s.t !== "end") bars.append(el("i")); });
  }
  function syncBars() {
    const bars = $("ls-bars").children;
    for (let k = 0; k < bars.length; k++) bars[k].classList.toggle("on", k <= ls.i);
  }
  function lsCard(s) {
    const card = el("div", "ls-card t-" + s.t);
    card.style.setProperty("--h", ls.hue);
    return card;
  }
  function lsMedia(img, cls) {
    const fig = el("figure", "ls-media" + (img.photo ? " is-photo" : "") + (cls ? " " + cls : ""));
    fig.append(chainImg(img.srcs, "", () => { fig.remove(); }));
    return fig;
  }
  function lsShow(i) {
    i = Math.max(0, Math.min(ls.slides.length - 1, i));
    ls.i = i;
    const s = ls.slides[i];
    lsStage.textContent = "";
    const card = lsCard(s);
    const body = el("div", "ls-body");
    if (s.t === "cover") {
      if (s.img) card.append(lsMedia(s.img, "tall"));
      else card.classList.add("noimg");
      const it = ls.item;
      body.append(el("div", "ls-kicker", "Lesson · " + s.count + " cards · about " + s.minutes + " min"));
      body.append(el("h2", "ls-cover-title", it.title));
      if (it.desc) body.append(el("p", "ls-desc", cap1(it.desc)));
      const row = el("div", "ls-actions");
      const prev = lessons[it.title];
      const b = el("button", "ls-btn primary", prev && prev.done ? "Start again" : "Start");
      b.type = "button";
      b.addEventListener("click", (e) => { e.stopPropagation(); lsNext(); });
      row.append(b);
      body.append(row, el("p", "ls-hint", "Tap the right side to go forward, the left side to go back."));
    } else if (s.t === "text") {
      if (s.img) {
        card.append(lsMedia(s.img));
      } else card.classList.add("noimg");
      body.append(el("div", "ls-kicker", s.kicker));
      const avoid = ls.item ? ls.item.title : "";
      body.append(markText(el("p", "ls-lead"), s.lead, null, avoid));
      if (s.rest) body.append(markText(el("p", "ls-rest"), s.rest, null, avoid));
      if (s.img && s.img.caption) body.append(el("p", "ls-caption", s.img.caption));
      if (i === 1) body.append(el("p", "ls-hint", "Tap to continue"));
    } else if (s.t === "quiz") {
      body.append(el("div", "ls-kicker", (ls.mode === "lesson" ? "Quick check" : s.q.kicker) + " · " + (s.qi + 1) + " of " + s.qn));
      body.append(el("h2", "ls-q", s.q.prompt));
      const prior = ls.answered[i];
      const qnode = buildQuestion(s.q, (ok, fb) => {
        ls.answered[i] = ok;
        if (ls.mode === "review" && s.q.subject) gradeReview(s.q.subject.key, ok);
        const nx = el("button", "ls-btn primary", "Continue");
        nx.type = "button";
        nx.addEventListener("click", (e) => { e.stopPropagation(); lsNext(); });
        fb.append(nx);
        updateLearnBadges();
      });
      body.append(qnode);
      if (prior != null) body.append(el("p", "ls-muted", "You've answered this one. Tap to continue."));
      card._q = qnode;
      if (prior != null) qnode.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    } else if (s.t === "end") {
      body.classList.add("center");
      lsFinish(body);
    }
    card.append(body);
    lsStage.append(card);
    syncBars();
    if (ls.mode === "lesson" && ls.item) {
      const rec = lessons[ls.item.title] || {};
      rec.slide = i;
      rec.at = Date.now();
      lessons[ls.item.title] = rec;
      store.set("lessons", lessons);
    }
    const nb = s.t === "cover" ? null : body.querySelector("button");
    if (nb && s.t === "quiz") nb.focus({ preventScroll: true });
  }
  function scoreLine() {
    let n = 0, ok = 0;
    ls.slides.forEach((s, i) => { if (s.t === "quiz") { n++; if (ls.answered[i] === true) ok++; } });
    return { n, ok };
  }
  function lsFinish(body) {
    const { n, ok } = scoreLine();
    const ring = el("div", "ls-done");
    ring.innerHTML = ICON.check;
    body.append(ring);
    markActiveDay();
    if (ls.mode === "lesson") {
      const it = ls.item;
      const rec = lessons[it.title] || {};
      const first = !rec.done;
      rec.done = true;
      rec.score = n ? ok + "/" + n : null;
      rec.at = Date.now();
      lessons[it.title] = rec;
      store.set("lessons", lessons);
      scheduleReview(it);
      body.append(el("h2", "ls-h", "Lesson complete"));
      body.append(el("p", "ls-muted", (n ? "You got " + ok + " of " + n + " right. " : "") + (first ? it.title + " comes back for a quick review tomorrow." : "Nice refresher.")));
      const row = el("div", "ls-actions col");
      const nextB = el("button", "ls-btn primary", "Next lesson");
      nextB.type = "button";
      nextB.addEventListener("click", (e) => { e.stopPropagation(); nextLesson(it, nextB); });
      const read = el("a", "ls-btn", "Read the full article");
      read.href = it.url;
      read.target = "_blank";
      read.rel = "noopener";
      const done = el("button", "ls-btn quiet", "Done");
      done.type = "button";
      done.addEventListener("click", (e) => { e.stopPropagation(); back(); });
      row.append(nextB, read, done);
      body.append(row);
    } else {
      if (ls.mode === "daily") { dailyQuiz = { d: todayKey(), ok, n }; store.set("dailyQuiz", dailyQuiz); }
      body.append(el("h2", "ls-h", ls.mode === "review" ? "Review done" : "Quiz done"));
      const left = dueReviews().length;
      body.append(el("p", "ls-muted", "You got " + ok + " of " + n + " right." + (ls.mode === "review" ? (left ? " " + left + " still due." : " Nothing else is due today.") : "")));
      const row = el("div", "ls-actions col");
      const done = el("button", "ls-btn primary", "Done");
      done.type = "button";
      done.addEventListener("click", (e) => { e.stopPropagation(); back(); });
      row.append(done);
      body.append(row);
    }
    updateLearnBadges();
  }
  async function nextLesson(it, btn) {
    btn.disabled = true;
    btn.textContent = "Finding one…";
    try {
      const r = await searchBatch("morelike:" + it.title, 0, 8);
      const p = r.pages.find((x) => !(lessons[x.title] && lessons[x.title].done));
      if (!p) throw new Error("none");
      const seed = fromAction(p, "related") || { title: p.title, kind: "related" };
      openLesson(seed);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Next lesson";
      showToast("Couldn't find a related lesson. Try again.", { hideAfter: 2400 });
    }
  }
  function lsNext() {
    const s = ls.slides[ls.i];
    if (!s) return;
    if (s.t === "end") return;
    if (s.t === "quiz" && ls.answered[ls.i] == null) {
      const card = lsStage.querySelector(".ls-card");
      if (card && !reduced) { card.classList.remove("nudge"); void card.offsetWidth; card.classList.add("nudge"); }
      return;
    }
    lsShow(ls.i + 1);
  }
  function lsPrev() { if (ls.i > 0 && ls.slides[ls.i].t !== "end") lsShow(ls.i - 1); }
  lsStage.addEventListener("pointerdown", (e) => {
    ls.down = e.target.closest("button, a, input") ? null : { x: e.clientX, y: e.clientY };
  });
  lsStage.addEventListener("pointerup", (e) => {
    const d = ls.down;
    ls.down = null;
    if (!d || !ls.slides.length) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) lsNext(); else lsPrev(); return; }
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;
    const r = lsStage.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.28) lsPrev(); else lsNext();
  });
  lsStage.addEventListener("pointercancel", () => { ls.down = null; });
  $("ls-close").addEventListener("click", back);

  async function startDailyQuiz() {
    lessonShell("Daily quiz", KINDS.quiz.h);
    ls.tok++;
    ls.mode = "daily";
    ls.item = null;
    ls.answered = {};
    ls.slides = [];
    openOverlayLesson();
    lsLoading("Building today's quiz…");
    const tok = ls.tok;
    const d = await today();
    if (tok !== ls.tok) return;
    if (!d) { lsError("You're offline or Wikipedia didn't answer.", () => { back(); setTimeout(startDailyQuiz, 50); }); return; }
    const P = poolArr();
    const otd = shuffle(d.otd);
    const trImg = shuffle(d.trend.filter((x) => x.img));
    const trDesc = shuffle(d.trend.filter((x) => x.desc));
    const qs = [otdYear(otd[0]), trendTop(d.trend), picMatch(trImg[0], P), otdYear(otd[1]), descMatch(trDesc[0], P)].filter(Boolean);
    if (!qs.length) { lsError("There wasn't enough in today's feed to build questions.", null); return; }
    ls.slides = qs.map((q, i) => ({ t: "quiz", q, qi: i, qn: qs.length })).concat([{ t: "end" }]);
    renderBars();
    lsShow(0);
  }
  function startReview() {
    const due = dueReviews().slice(0, 10);
    const qs = [];
    for (const r of due) { const q = reviewQuestion(r.item); if (q) qs.push(q); else gradeReview(r.item.key, true); }
    if (!qs.length) {
      showToast(due.length ? "Nothing to quiz on yet. Like or save a few more cards." : "Nothing due. Like, save or learn something and it'll come back here.", { hideAfter: 3200 });
      updateLearnBadges();
      return;
    }
    openSession("review", "Review", qs.map((q, i) => ({ t: "quiz", q, qi: i, qn: qs.length })).concat([{ t: "end" }]), 150);
  }

  /* ======================= learn tab ======================= */
  const collectionCache = new Map();
  function loadCollection(c) {
    if (collectionCache.has(c.name)) return collectionCache.get(c.name);
    const p = (async () => {
      const j = await getJSON(actionUrl({ titles: c.titles.join("|"), redirects: 1, prop: "pageimages|description", piprop: "thumbnail", pithumbsize: 500, pilicense: "any" }));
      const q = j.query || {};
      const map = new Map();
      for (const pg of q.pages || []) if (pg && !pg.missing && !pg.invalid) map.set(pg.title, pg);
      const follow = (t) => {
        for (const n of q.normalized || []) if (n.from === t) t = n.to;
        for (const r of q.redirects || []) if (r.from === t) t = r.to;
        return t;
      };
      const out = [];
      for (const t of c.titles) {
        const pg = map.get(follow(t));
        if (!pg) continue;
        const it = { key: pg.title, kind: "lesson", title: pg.title, hook: pg.title, desc: pg.description || "", text: "", img: pg.thumbnail && pg.thumbnail.source ? { src: pg.thumbnail.source, w: pg.thumbnail.width, h: pg.thumbnail.height } : null, url: mobileUrl(pg.title), meta: { label: c.name } };
        out.push(it);
        addPool(it);
      }
      return out;
    })();
    collectionCache.set(c.name, p);
    p.catch(() => collectionCache.delete(c.name));
    return p;
  }
  function lessonCard(it, hue) {
    const b = el("button", "lcard");
    b.type = "button";
    b.style.setProperty("--h", hue);
    const cv = el("span", "cv");
    if (it.img && it.img.src) cv.append(chainImg([it.img.src, it.img.fallback], "", (im) => im.remove()));
    else cv.append(el("span", "cv-t", it.title));
    const rec = lessons[it.title];
    if (rec && (rec.done || rec.slide > 0)) {
      const bar = el("span", "pbar");
      const fill = el("i");
      fill.style.width = rec.done ? "100%" : Math.round(((rec.slide || 0) / Math.max(1, (rec.total || 1) - 1)) * 100) + "%";
      bar.append(fill);
      cv.append(bar);
    }
    if (rec && rec.done) { const ck = el("span", "cv-done"); ck.innerHTML = sized(ICON.check, 16); cv.append(ck); }
    b.append(cv, el("b", null, it.title));
    if (it.desc) b.append(el("small", null, cap1(it.desc)));
    b.addEventListener("click", () => openLesson(it));
    return b;
  }
  function updateLearnBadges() {
    const due = dueReviews().length;
    const nb = $("learn-badge");
    nb.textContent = due;
    nb.hidden = due === 0;
    $("rev-sub").textContent = due ? due + (due === 1 ? " card due" : " cards due") : Object.keys(reviews).length ? "All caught up" : "Like or save cards to start";
    const dq = dailyQuiz && dailyQuiz.d === todayKey();
    $("quiz-sub").textContent = dq ? "Done · " + dailyQuiz.ok + "/" + dailyQuiz.n : "5 questions from today";
    $("btn-quiz").classList.toggle("done", !!dq);
  }
  let learnBuilt = false;
  function renderLearn() {
    updateLearnBadges();
    const doneN = lessonsDone().length;
    $("learn-sub").textContent = doneN ? doneN + (doneN === 1 ? " lesson" : " lessons") + " done · " + streak() + "-day streak" : "Short visual lessons, built from Wikipedia.";
    const cont = Object.keys(lessons).map((t) => lessons[t]).filter((r) => r && r.item && !r.done && r.slide > 0).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 10);
    $("continue-sec").hidden = !cont.length;
    const shelf = $("continue-shelf");
    shelf.textContent = "";
    for (const r of cont) shelf.append(lessonCard(r.item, (KINDS[r.item.kind] || KINDS.lesson).h));
    if (learnBuilt) return;
    learnBuilt = true;
    const hero = $("today-lesson");
    hero.textContent = "";
    hero.append(el("div", "hero sk-hero"));
    today().then((d) => {
      hero.textContent = "";
      const it = d && d.tfa;
      if (!it) { hero.append(el("p", "learn-note", "Today's featured lesson shows up when you're online.")); return; }
      const b = el("button", "hero");
      b.type = "button";
      b.style.setProperty("--h", KINDS.featured.h);
      const cv = el("span", "hero-cv");
      if (it.img && it.img.src) cv.append(chainImg([it.img.src, it.img.fallback], "", (im) => im.remove()));
      const tx = el("span", "hero-tx");
      tx.append(el("span", "hero-k", "Featured on Wikipedia today"), el("b", null, it.title));
      if (it.desc) tx.append(el("small", null, cap1(it.desc)));
      tx.append(el("span", "hero-go", "Start lesson"));
      b.append(cv, tx);
      b.addEventListener("click", () => openLesson(it));
      hero.append(b);
    });
    const wrap = $("collections");
    wrap.textContent = "";
    for (const c of COLLECTIONS) {
      const sec = el("section", "shelf-sec");
      sec.append(el("h2", "shelf-title", c.name));
      const shelf2 = el("div", "shelf");
      for (let k = 0; k < 4; k++) { const ph = el("span", "lcard ph"); ph.append(el("span", "cv")); shelf2.append(ph); }
      sec.append(shelf2);
      wrap.append(sec);
      loadCollection(c).then((items) => {
        shelf2.textContent = "";
        for (const it of items) shelf2.append(lessonCard(it, c.h));
        if (!items.length) sec.remove();
      }).catch(() => {
        shelf2.textContent = "";
        const b = el("button", "ubtn", "Couldn't load. Try again");
        b.type = "button";
        b.addEventListener("click", () => { learnBuilt = false; renderLearn(); });
        shelf2.append(b);
      });
    }
  }
  $("btn-review").addEventListener("click", startReview);
  $("btn-quiz").addEventListener("click", startDailyQuiz);

  /* ======================= you ======================= */
  let youTab = "saved";
  const youGrid = new Grid($("ygrid"), null, "Saved");
  function renderYou() {
    $("stat-read").textContent = nf.format(readSet.size);
    $("stat-lessons").textContent = lessonsDone().length;
    $("stat-streak").textContent = streak();
    const sinceTxt = new Date(since).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
    const todayN = daily.d === todayKey() ? daily.ids.length : 0;
    const acc = qstats.n ? " Quiz accuracy " + Math.round((qstats.ok / qstats.n) * 100) + "% over " + qstats.n + (qstats.n === 1 ? " answer." : " answers.") : "";
    $("p-bio").textContent = "Learning instead of doomscrolling since " + sinceTxt + ". " + todayN + (todayN === 1 ? " card" : " cards") + " today." + acc;
    $("you-install").hidden = isStandalone();
    const fol = $("following");
    fol.textContent = "";
    for (const t of topics) {
      const c = el("span", "fchip");
      const go = el("button", "go", "#" + t);
      go.type = "button";
      go.addEventListener("click", () => { showTab("home"); setMode("t:" + t); });
      const rm = el("button", "rm");
      rm.type = "button";
      rm.innerHTML = ICON.x;
      rm.setAttribute("aria-label", "Unfollow " + t);
      rm.addEventListener("click", () => toggleFollow(t));
      c.append(go, rm);
      fol.append(c);
    }
    for (const name of ["saved", "liked", "lessons"]) $("gtab-" + name).setAttribute("aria-selected", youTab === name ? "true" : "false");
    let items;
    if (youTab === "lessons") {
      items = lessonsDone().map((t) => lessons[t]).filter((r) => r.item).sort((a, b) => (b.at || 0) - (a.at || 0)).map((r) => r.item);
      youGrid.onOpen = (it) => openLesson(it);
      youGrid.title = "Lessons";
    } else {
      items = [...(youTab === "saved" ? saved : liked).values()].reverse();
      youGrid.onOpen = null;
      youGrid.title = youTab === "saved" ? "Saved" : "Liked";
    }
    youGrid.setItems(items);
    const empty = $("ygrid-empty");
    empty.hidden = items.length > 0;
    empty.textContent = youTab === "saved" ? "Tap the bookmark on any card to keep it here. Saved cards work offline too."
      : youTab === "liked" ? "Double-tap a card or tap the heart. Likes teach For you what to show next."
      : "Finish a lesson and it lands here. Tap Learn this on any card to start one.";
  }
  for (const name of ["saved", "liked", "lessons"]) $("gtab-" + name).addEventListener("click", () => { youTab = name; renderYou(); });
  $("you-explore").addEventListener("click", () => { showTab("explore"); $("search-input").focus(); });

  /* ======================= install ======================= */
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  function isStandalone() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    store.set("installed", true);
    showToast("Tangent is on your home screen", { hideAfter: 3000 });
  });
  function renderInstall() {
    const body = $("install-body");
    body.textContent = "";
    if (isStandalone()) { body.append(el("p", null, "You're already in the installed app.")); return; }
    if (deferredPrompt) {
      body.append(el("p", null, "One tap and Tangent gets its own icon. It opens full screen like any other app."));
      const b = el("button", "bigbtn", "Install Tangent");
      b.type = "button";
      b.addEventListener("click", async () => {
        const p = deferredPrompt;
        if (!p) return;
        deferredPrompt = null;
        try { await p.prompt(); await p.userChoice; } catch (e) {}
        renderInstall();
      });
      body.append(b);
      return;
    }
    const steps = el("ol", "steps");
    const step = (html) => { const li = el("li"); const sp = el("span"); sp.innerHTML = html; li.append(sp); steps.append(li); };
    if (isIOS) {
      body.append(el("p", null, "On iPhone it takes three taps in Safari."));
      step("Tap the Share button " + ICON.shareIOS + " in the toolbar.");
      step("Scroll down and tap <b>Add to Home Screen</b> " + ICON.plusSq + ".");
      step("Tap <b>Add</b>. Tangent appears next to your other apps.");
      body.append(steps);
      body.append(el("p", null, "Using Chrome on iPhone? Tap the Share button next to the address bar, then Add to Home Screen."));
    } else if (isAndroid) {
      body.append(el("p", null, "On Android, in Chrome:"));
      step("Tap the menu " + ICON.dots + " at the top right.");
      step("Tap <b>Install app</b> or <b>Add to Home screen</b>.");
      step("Confirm. Tangent lands in your app drawer.");
      body.append(steps);
    } else {
      body.append(el("p", null, "Open this page on your phone to install it there. On a computer, use the install icon at the right end of Chrome or Edge's address bar."));
    }
  }
  const installSheet = $("install-sheet");
  function openInstall() {
    renderInstall();
    installSheet.hidden = false;
    installSheet.querySelector("[data-close]").focus();
    pushOverlay(() => { installSheet.hidden = true; });
  }
  installSheet.addEventListener("click", (e) => { if (e.target === installSheet || e.target.closest("[data-close]")) back(); });
  $("you-install").addEventListener("click", openInstall);
  function maybeNudgeInstall() {
    if (isStandalone() || store.get("nudged", false) || daily.ids.length < 4) return;
    if (!(isIOS || isAndroid || deferredPrompt)) return;
    store.set("nudged", true);
    showToast("Keep Tangent on your home screen", { action: { label: "How", run: () => { toast.hidden = true; openInstall(); } }, hideAfter: 7000 });
  }

  /* ======================= keyboard ======================= */
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!installSheet.hidden) { if (e.key === "Escape") back(); return; }
    if (!lessonEl.hidden) {
      const s = ls.slides[ls.i];
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { if (e.key !== "Enter" || !(s && s.t === "quiz")) { e.preventDefault(); lsNext(); } }
      else if (e.key === "ArrowLeft") lsPrev();
      else if (e.key === "Escape") back();
      else if (/^[1-4a-d]$/i.test(e.key) && s && s.t === "quiz") {
        const card = lsStage.querySelector(".ls-card");
        const idx = /\d/.test(e.key) ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
        if (card && card._q && idx < s.q.options.length) card._q._pick(idx);
      }
      return;
    }
    if (!storyEl.hidden) {
      if (e.key === "ArrowRight") storyNext();
      else if (e.key === "ArrowLeft") storyPrev();
      else if (e.key === " ") { e.preventDefault(); st.paused = !st.paused; }
      else if (e.key === "Escape") back();
      return;
    }
    const feed = !$("viewer").hidden ? viewerFeed : tab === "home" ? homeFeed : null;
    if (e.key === "Escape" && !$("viewer").hidden) { back(); return; }
    if (!feed) return;
    const cur = feed.current();
    if (e.key === "ArrowDown" || e.key === "j" || e.key === "PageDown") { e.preventDefault(); feed.step(1); }
    else if (e.key === "ArrowUp" || e.key === "k" || e.key === "PageUp") { e.preventDefault(); feed.step(-1); }
    else if (cur && cur._item && cur._item.kind !== "quiz") {
      if (e.key === "l") toggleLike(cur._item);
      else if (e.key === "s") toggleSave(cur._item);
      else if (e.key === "L") openLesson(cur._item);
      else if (e.key === "o") { const a = cur.querySelector("a.readpill"); if (a) a.click(); }
    }
  });

  /* ======================= freshness ======================= */
  let hiddenAt = 0, bootDay = todayKey();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    if (todayKey() !== bootDay || away > 3 * 3600 * 1000) {
      bootDay = todayKey();
      dayCache.clear();
      storyCache.clear();
      storiesDirty = true;
      learnBuilt = false;
      if (tab === "home" && $("viewer").hidden && storyEl.hidden && lessonEl.hidden) setMode(mode, { force: true });
    }
    updateLearnBadges();
  });
  let rz = null;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { homeFeed.recheck(); viewerFeed.recheck(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { homeFeed.recheck(); viewerFeed.recheck(); });

  /* ======================= start ======================= */
  safeDay(0);
  renderTabs();
  updateLearnBadges();
  setMode(mode, { force: true });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
  }

  // Hooks for automated tests; harmless in normal use.
  window.__tangent = { showTab, setMode, openStory, openLesson, startReview, startDailyQuiz, homeFeed, viewerFeed, exploreGrid, yearCloze, descMatch, picMatch, otdYear, trendTop, sentences, parseSections, groupSections, excerpt, dueReviews, scheduleReview, gradeReview, reviews, lessons, ls };
})();
