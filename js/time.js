/* New York market time. Pure: safe to import anywhere, including the unit tests. */

/** Regular session, in minutes after midnight New York time: 9:30 to 4:00. */
export const OPEN_MIN = 570;
export const CLOSE_MIN = 960;

const nyFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "numeric", minute: "numeric", hour12: false });
const nyMemo = new Map();
/** New York date, weekday and minute of the day for a timestamp (memoized per minute: trades arrive fast). */
export function nyParts(ms) {
  const key = Math.floor(ms / 60000);
  let r = nyMemo.get(key);
  if (r) return r;
  const p = {};
  for (const x of nyFmt.formatToParts(new Date(key * 60000))) p[x.type] = x.value;
  r = { day: p.year + "-" + p.month + "-" + p.day, wd: p.weekday, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
  if (nyMemo.size > 8) nyMemo.clear();
  nyMemo.set(key, r);
  return r;
}
export const nyClock = () => nyParts(Date.now());

export const minLabel = (min) => { const h = Math.floor(min / 60), m = min % 60; return ((h + 11) % 12 + 1) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM"); };
export const dayLabel = (day, today = nyClock().day) => day === today ? "Today" : new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
