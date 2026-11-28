/* Overlays (the price page and sheets) close with the phone's back gesture: each one is a history entry. */
const overlays = [];
export function pushOverlay(close) {
  overlays.push(close);
  try { history.pushState({ tangent: overlays.length }, ""); } catch (e) {}
}
export const back = () => { if (overlays.length) history.back(); };
export const overlayCount = () => overlays.length;
export function initOverlays() {
  window.addEventListener("popstate", () => { const close = overlays.pop(); if (close) close(); });
}
