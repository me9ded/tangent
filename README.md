# Tangent

Live prices for the stocks you follow. One screen with your watchlist and a price page for each stock.

**Open it:** https://me9ded.github.io/tangent/

## What's in it

- **Watchlist** shows each stock's price, today's change and today's range. Sort it by biggest moves, A–Z, or your own order: in **Mine**, drag a stock by its handle (or focus the handle and use the arrow keys).
- **Live prices**: while the US market is open, trades stream in over Finnhub's WebSocket and the price flashes green or red as it ticks. Outside regular hours, or if the stream drops, prices refresh every minute instead.
- **Today's movers** at the top shows how many of your stocks are up and charts the biggest gainers and losers.
- **Tap a change pill** to switch every pill between percent and dollars.
- **Today's chart**: Finnhub's free plan has no intraday history, so Tangent records its own: the last price of each minute while it's open during market hours, for the two most recent trading days. The price page draws it against the previous close; hold a finger on it to read any minute. Times Tangent wasn't open are drawn dashed. Once a stock has ten minutes recorded, its watchlist row shows a sparkline instead of the range bar.
- **Price page**: tap a stock for its big live price, today's chart, today's range (with the open and previous close marked), the 52-week range, and the open, previous close, day high/low and 52-week high/low.
- **Add a stock** searches US-listed stocks and ETFs by name or ticker, share classes like BRK.B included. Remove one from its price page, and tap **Undo** if you didn't mean to.
- **Light and dark**: Tangent follows your phone's appearance.
- **Updates** never swap the app under you: when a new version is ready, a **Reload** button appears.
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

Plain HTML, CSS and JavaScript modules. There's no build step.

- `index.html` and `styles.css` are the page; `js/` holds the app as ES modules. `js/main.js` wires everything up, and the other modules only define things, so the unit tests can import them without a browser.
- `sw.js` is the service worker that keeps it working offline.
- `manifest.webmanifest` and `icons/` make it installable.
- `fonts/` holds Bricolage Grotesque, Literata and IBM Plex Mono, all under the SIL Open Font License.
- `tests/` holds the end-to-end tests. They're not part of the app.

## Deploys

Every push to `main` runs the tests and, if they pass, deploys to GitHub Pages. CI builds the site with `tests/build-site.js`, which copies only the app's files and stamps the service worker's `VERSION` with the commit. The tests run against that exact build, and the same build is what gets deployed. Phones with Tangent open get a **Reload** prompt. In the repo, `VERSION` stays `tangent-dev`; don't change it by hand.

## Running tests

The tests drive the real app in Android Chrome and iPhone Safari engines against a fake Finnhub, so they need no key and no network. They run on every push in GitHub Actions.

```sh
cd tests
npm ci
npx playwright install chromium webkit
npm run unit             # unit tests for the pure logic (Node only, no browser)
npm test                 # end-to-end tests
npm run check-shell      # sw.js precaches every file and module, and nothing missing
SHOTS=/some/folder npx playwright test theme --grep shots   # save light and dark screenshots
```

Earlier versions (the Wikipedia feed, lessons and stock news) are in the git history.
