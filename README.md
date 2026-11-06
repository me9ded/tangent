# Tangent

Swipe through Wikipedia instead of doomscrolling. Tangent works like a short-video feed, except every card is something real to learn.

**Open it:** https://me9ded.github.io/tangent/

## What's in it

- **Home** is a full-screen feed you swipe up through. The tabs are For you, News, Trending, On this day, Random, plus any topics you follow.
- **Double-tap** a card to like it. The rail on the right has Like, Related, Share and Save.
- **Explore** has a search bar with live suggestions, story rings you tap through (Today, News, Trending, On this day, Random and your topics) and a photo grid.
- **Follow** a topic from a search, and it shows up as a tab and a story. For you starts mixing it in.
- **Likes shape For you.** Articles similar to the ones you liked start showing up.
- **You** shows how many cards you've read, your day streak, and grids of what you saved and liked.
- It works offline once it's installed. You get the app itself, your saved cards, and the last feeds you loaded.

## Where the content comes from

Everything loads live from Wikipedia in your browser. There's no server, account or tracking.

| Feed | Source |
| --- | --- |
| News, Trending, Featured article, Picture of the day, On this day | Wikimedia's daily featured feed (`/api/rest_v1/feed/featured/YYYY/MM/DD`) |
| More On this day events | `/api/rest_v1/feed/onthisday/events/MM/DD` |
| Random, search, topics, related | MediaWiki Action API (`generator=random`, `generator=search`, `morelike:`) |

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
