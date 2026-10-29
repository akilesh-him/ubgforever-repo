# Developing Slipstream

Slipstream is plain HTML, CSS and JavaScript served by Node 22. There is no frontend framework, bundler or generated application source. The four direct runtime packages provide the proxy stack. Do not add a framework to make a small feature change.

## Run and verify

```sh
npm install
cp .env.example .env
npm start
npm test
npm run build
```

The preview is http://localhost:5186/. Set `GROQ_API_KEY` in `.env` for AI. Never put it in a public script. The build validates JavaScript syntax, checks local entry assets and module paths, and copies public assets to `dist/`. It does not replace the Node server needed for AI and Wisp. Reload the page after frontend edits. Restart Node after backend or shared AI policy changes.

## Ownership

| Change | Owner |
| --- | --- |
| Add a web app | `js/web-apps.js` |
| App window, loading, Close | `js/app-player.js` |
| Frame navigation history | `js/frame-history.js` |
| Scramjet and transport initialization | `js/proxy-runtime.js` |
| Browser toolbar and address/search | `js/browser.js` |
| Existing game catalog and player | `js/games.js` |
| Game title snapshot | `js/games-data.js` |
| Cover artwork mapping | `js/game-art.js` |
| Home rows and flips | `js/home-motion.mjs` |
| Taskbar and effects switch | `js/taskbar.js` |
| AI messages, request lifecycle | `js/ai.js` |
| AI uploads and pasted images | `js/ai-attachments.mjs` |
| AI scrolling | `js/ai-scroll.mjs` |
| AI model and limits, client and server | `js/ai-policy.mjs` |
| Groq and research tools | `ai-service.mjs` |
| Profile image validation/cropping | `js/profile-picture.mjs` |
| Shared motion preference and effects toggle | `js/ui-preferences.mjs` |
| Profile and settings panels | `js/profile.js`, `js/core.js` |
| Modal/search keyboard handling | `js/overlay-controls.js` |
| Startup screen | `js/entrance.js`, `css/entrance.css` |
| Partner UI styles | `css/slipstream.css` |
| HTTP, public-file routing, Wisp | `server.mjs` |

`js/app.js` retains the original application routing, catalog rendering and detail pages. New feature lifecycles should live with the owning component instead of expanding that controller. Browser and app windows share the proxy runtime but do not mount each other's interfaces.

## Loading and integration

The original application uses classic scripts and global compatibility APIs. Their explicit order is in `index.html`. `proxy-runtime.js` and `frame-history.js` load before either frame interface. `web-apps.js` loads before `app.js`. `taskbar.js` imports the Home motion module and shared UI preferences. AI uses a module script and imports its policy, attachments and scroll helpers.

Keep the existing public APIs, storage keys, IDs and backend payload names unless a change includes migration. Modules using ESM have `.mjs` extensions so Node tests can import them directly. No browser-only object is accessed at module evaluation in the pure controllers.

## Add an app

Add a record to `js/web-apps.js`:

```js
{
  id: 'slipstream-example',
  name: 'Example',
  category: 'Tools',
  developer: 'Example',
  img: 'img/apps/example.svg',
  description: 'A factual description of what the app does.',
  proxy_url: 'https://example.com/'
}
```

Use `proxy_url` for external sites and `app_url` for local documents such as `/apps/editor.html`. Do not fetch a local document and convert it to `srcdoc`, which changes relative URL behavior. `html_code` remains supported for existing backend records. Bundle the actual logo and record its source in `img/apps/SOURCES.md`. App window Close routes to `#apps`. Back and Forward navigate only the embedded app.

## Add a game or artwork

The original provider list is refreshed by `setGames()` in `js/games.js`. Covers are independent of the game provider. Add known artwork to `js/game-art.js`, save it under `game-pictures/`, and record provenance. Missing artwork uses the first two alphanumeric title characters. The catalog sorts real covers first, then alphabetically. Recents retain chronology.

Wispcraft is the explicit local-game exception in `games.js`. Its local document must keep its relative bootstrap/assets paths. Source details are in `apps/wispcraft/SOURCES.txt`. A future second local game should introduce a small local-game registry rather than another scattered ID check.

## Change Home motion

`HomeRow` owns its track animation and active flips. `reset()` cancels motion and restores three base cards. `dispose()` also prevents restarting. The mount controller reconciles replacement rows and resets travel on resize. Always cancel a departing card's flip before removing it. Do not attach animation state directly to DOM elements.

Travel is 36 layout pixels per second, top left and bottom right. Flips run every 2400 ms. Text and cover move together. Hidden/offscreen/player/reduced-effects states pause row travel. Native tests cover recycle, pause/resume and cancellation without a real browser.

## Change AI attachments

`createAttachmentQueue()` serializes reads. Submit must await `ready()` before building the request, and New chat calls `reset()` to invalidate old reads. Both picker and clipboard use this same path. The request lifecycle disables attachment selection during submission. Failures restore the sent attachments and input.

`ai-policy.mjs` is the shared source of limits and model. Image parts are validated again server-side. Do not put data URLs in rendered HTML strings. Previews use DOM image properties. The attachment queue accepts an injected reader for deterministic tests.

## Change styling

Load order is `app.css` (original project), `slipstream.css` (partner UI), then `entrance.css` (startup screen). The retired glass/polish patch files must not be reintroduced. Keep current component rules in `slipstream.css` and edit the existing declaration instead of appending another correction. Responsive and accessibility conditions remain separate rules.

Search for the component selector before editing. Shared surfaces and input groups intentionally have combined selectors. Preserve reduced motion, reduced transparency, forced colors, focus indicators and themed horizontal scrollbars. The approved dock uses `#dock-lens` from `index.html`, affecting only its backdrop. Keep labels outside the distortion filter.

## Verification scope

`tests/frontend-lifecycle.test.mjs` covers attachment readiness/reset/limits, scroll-follow behavior, frame history, proxy setup independence and row lifecycle. `tests/slipstream.test.mjs` covers backend validation/tools, HTTP boundaries, worker initialization, entrance gating and leaderboard rendering.

For UI changes also review desktop and a narrow phone layout. Exercise failure/recovery states relevant to the feature. Tests do not prove third-party login, video DRM, every game, a Supabase migration, physical-device frame rate or accessibility certification.

## Contribution style

Use readable multiline source and descriptive ownership. Default to no comments. Keep only short lowercase explanations of a non-obvious constraint or workaround, without semicolons or em dashes. Preserve original/vendor comments and attribution. Avoid generic emoji icons, decorative slogans, fake statistics and arbitrary gradients. A handoff must describe current behavior, not ask the next developer to reconstruct previous implementations.
