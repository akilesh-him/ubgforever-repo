# UBGForever v2

A console-style dashboard for games and apps. Static site, no build step.

## Structure

- `index.html`: markup for the study-site front page, the hub shell and every view
- `css/app.css`: the whole design system (themes are CSS variables set by `js/core.js`)
- `js/core.js`: helpers, themes, tab disguise, backend client
- `js/app.js`: routing, home, apps, search, app pages, player, settings
- `js/games.js` + `js/games-data.js`: 2,800+ games from `bubbls/ugs-singlefile`, favorites, recents, player
- `js/profile.js`: level, library, friends, challenges, customization, tools
- `js/links.js`, `js/proxy-links.js` (add Rammerhead links here), `js/browser.js`, `js/chat.js`, `js/storage.js`: links directory, proxy browser, peer-to-peer chat, local profile storage
- `links/`, `build-links.js`: link lists and the script that bundles them into `js/links-data.js`
- `supabase-*.sql`: database setup

## Routes

`#home`, `#games`, `#games/<search>`, `#apps`, `#category/<name>`, `#app/<id>`, `#play/<id>`, `#search/<text>`, `#settings`, `#links`, `#browser`, `#profile`

## Games

The game list ships as a snapshot (`js/games-data.js`) and refreshes from jsDelivr when reachable.
Games load on demand from the jsDelivr CDN, falling back to raw.githubusercontent.com.
