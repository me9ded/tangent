# Tangent

Live prices for the stocks you follow. One screen with your watchlist and a price page for each stock.

**Open it:** https://me9ded.github.io/tangent/

## What's in it

- **Watchlist** shows each stock's price, today's change and today's range. Sort it by biggest moves, A–Z, or your own order.
- **Live prices**: while the US market is open, trades stream in over Finnhub's WebSocket and the price flashes green or red as it ticks. Outside regular hours, or if the stream drops, prices refresh every minute instead.
- **Today's movers** at the top shows how many of your stocks are up and charts the biggest gainers and losers.
- **Tap a change pill** to switch every pill between percent and dollars.
- **Price page**: tap a stock for its big live price, today's range (with the open and previous close marked), the 52-week range, and the open, previous close, day high/low and 52-week high/low.
- **Add a stock** searches US-listed stocks and ETFs by name or ticker. Remove one from its price page.
- It works offline once installed and shows the last prices it saw.

## Prices

Prices come from [Finnhub](https://finnhub.io). Their free plan is enough: create an account, copy your API key, and paste it into Tangent. The key is saved only on your phone and is sent only to Finnhub.

| What | Finnhub endpoint |
| --- | --- |
| Live trades | `wss://ws.finnhub.io` (subscribe per symbol) |
| Price, change, day range | `/quote` |
| 52-week range | `/stock/metric?metric=all` |
| Logos | `/stock/profile2` |
| Search | `/search` |
| Market open or closed | `/stock/market-status?exchange=US` |

The free plan allows 60 calls a minute. Tangent stays under 50 and holds background work (logos) to 34, so anything you tap still goes through right away.

Prices can lag a little. Tangent isn't investment advice.

## Install on your phone

- **iPhone:** open the link in Safari, tap **Share**, then tap **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the **⋮** menu, then tap **Install app**.

## Files

Plain HTML, CSS and JavaScript. There's no build step.

- `index.html`, `styles.css`, `app.js` are the app.
- `sw.js` is the service worker that keeps it working offline.
- `manifest.webmanifest` and `icons/` make it installable.
- `fonts/` holds Bricolage Grotesque, Literata and IBM Plex Mono, all under the SIL Open Font License.

Earlier versions (the Wikipedia feed, lessons and stock news) are in the git history.
