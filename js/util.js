/* Small helpers shared by every module. Nothing here touches the page or storage until called. */

export const store = {
  get(k, d) { try { const v = localStorage.getItem("tangent." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("tangent." + k, JSON.stringify(v)); } catch (e) {} }
};
export const asArr = (v) => (Array.isArray(v) ? v : []);
export const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const $ = (id) => document.getElementById(id);
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const esc = (s) => (globalThis.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));
export const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const usd = (v) => (Number.isFinite(v) ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");
export const pct = (v) => (Number.isFinite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%" : "–");
export const signedUsd = (v) => (Number.isFinite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + usd(Math.abs(v)) : "–");
export const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function cleanName(s) {
  s = String(s || "").replace(/\b(inc|corp|corporation|ltd|limited|plc|co|holdings?|group|class [a-c]|cl [a-c]|sa|nv|ag|adr|sp|spons?|sponsored|ord|shs|common stock)\b\.?/gi, "").replace(/[-,/]+\s*$/, "").replace(/\s+/g, " ").trim();
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) || s;
}
export const initials = (name) => String(name || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
