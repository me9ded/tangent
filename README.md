# Tangent

Swipe through Wikipedia instead of doomscrolling. Tangent works like a short-video feed, except every card is something real to learn.

**Open it:** https://me9ded.github.io/tangent/

## What's in it

- **Home** is a full-screen feed you swipe up through. The tabs are For you, News, Trending, On this day, Random, plus any topics you follow.
- **Double-tap** a card to like it. The rail on the right has Like, Related, Share and Save.
- **Explore** has a search bar with live suggestions, story rings you tap through (Today, News, Trending, On this day, Random and your topics) and a photo grid.
- **Follow** a topic from a search, and it shows up as a tab and a story. For you starts mixing it in.
- **Likes shape For you.** Articles similar to the ones you liked start showing up.
- **You** shows how many cards you've read, lessons finished, your day streak, quiz accuracy, and grids of what you saved, liked and learned.

## Tech stocks

- **Stocks tab:** a live watchlist of 17 tech stocks to start. Big Tech (AAPL, MSFT, GOOGL, AMZN, META), chips and AI (NVDA, AMD, AVGO, TSM, ASML, INTC), Canadian tech (SHOP, CLS, OTEX) and other big names (TSLA, NFLX, PLTR). You get:
  - Market status, a movers chart, price and daily change, today's range, and the next earnings dates.
  - Sorting by Moves, A–Z or Mine. Add any US-listed stock by name or ticker.
- **Stock page:** price, today's and 52-week ranges, market cap, P/E, EPS, beta, dividend yield, next earnings with analyst estimates, and the latest news. Tap any stat label for a short lesson on what it means.
- **For you leans on your stocks:** about half the cards are your watchlist's news, the daily movers chart, upcoming earnings, Wikipedia cards about those companies, and quick quizzes on today's moves and tickers. Home also has a dedicated **Stocks** tab.
- **Watchlist story** in Explore, and **Tech stocks 101** and **The companies you watch** lessons in Learn.
- Data comes from [Finnhub](https://finnhub.io)'s free plan. You paste your own free key into the Stocks tab, and it's stored only on your phone, never in this repo. Tangent stays under 50 requests a minute and gives things you tap priority over background loading. This is for keeping an eye on things and learning, not investment advice.

## Learning

- **Lessons:** tap **Learn this** on any card or story. The full Wikipedia article becomes a short tap-through lesson: a cover, an "In short" card, then up to six of the article's sections, each illustrated with a picture from that same section. Numbers are highlighted, and lessons resume where you left off.
- **Quick checks:** each lesson ends with questions taken straight from what you just read. There are fill-in-the-year questions and a "which best describes it?" question.
- **Quiz cards in For you:** On this day "what year?", "which picture goes with this article?", "which was most read yesterday?" and "what is it?". They're all built from live data, so the answers are always right.
- **Daily quiz:** five questions from today's Wikipedia, under the **Learn** tab.
- **Review:** anything you like, save or learn comes back as a question after 1, 3, 7, 16, 35 and 90 days. Get it wrong and it comes back tomorrow.
- **Learn tab:** today's featured lesson, your unfinished lessons, and collections: The universe, Computers and code, How your mind works, Ancient worlds, Money and Planet Earth.
- It works offline once it's installed. You get the app itself, your saved cards, and the last feeds you loaded.

## Where the content comes from

Everything loads live from Wikipedia in your browser. There's no server, account or tracking.

| Feed | Source |
| --- | --- |
| News, Trending, Featured article, Picture of the day, On this day | Wikimedia's daily featured feed (`/api/rest_v1/feed/featured/YYYY/MM/DD`) |
| More On this day events | `/api/rest_v1/feed/onthisday/events/MM/DD` |
| Random, search, topics, related | MediaWiki Action API (`generator=random`, `generator=search`, `morelike:`) |
| Stock prices, profiles, news, earnings, metrics | Finnhub REST API (`/quote`, `/stock/profile2`, `/company-news`, `/calendar/earnings`, `/stock/metric`, `/search`, `/stock/market-status`) with your own key |
| Lessons | Full article text (`prop=extracts&explaintext&exsectionformat=wiki`) plus section pictures (`/api/rest_v1/page/media-list/{title}`) |

Images are requested at 960px, which is one of Wikimedia's standard thumbnail sizes.

## Install on your phone

- **iPhone:** open the link in Safari, tap **Share**, then tap **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the **⋮** menu, then tap **Install app**.

## Files

Plain HTML, CSS and JavaScript. There's no build step.

- `index.html`, `styles.css`, `app.js` are the app.
- `sw.js` is the service worker that keeps it working offline.
- `manifest.webmanifest` and `icons/` make it installable.
- `fonts/` holds Bricolage Grotesque, Literata and IBM Plex Mono, all under the SIL Open Font License.

Wikipedia content is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Tangent isn't affiliated with Wikipedia or the Wikimedia Foundation.
