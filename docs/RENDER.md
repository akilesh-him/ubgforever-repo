# Render deployment

Slipstream must run as a **Web Service**, not a Static Site. Static sites cannot run the Node routes that provide AI, game proxying, Wisp and the browser engine assets from installed dependencies. Changing a static publish directory to `dist` fixes the engine files but still does not run Wisp or AI.

The checked-in `render.yaml` provisions a Node 22 web service. In Render, create a Blueprint from this repository and select it. Alternatively, create a Web Service manually with:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Environment: `NODE_ENV=production`, `HOST=0.0.0.0`
- Health check: `/healthz`
- Server-only environment variable: `CLOUDFLARE_API_TOKEN` for AI
- `PUBLIC_ORIGINS=https://slipstream-fr.duckdns.org` if a CDN forwards a different Host header

Use Render's provided `PORT`. Do not set `HOST=127.0.0.1` on the hosted service. The free service can sleep when idle, so the first request can take longer. No paid plan is selected in the Blueprint.

Test the new service's Render URL before moving the domain. `/healthz` must return JSON identifying `slipstream`, `/scramjet/scramjet.all.js` and `/baremux/index.js` must return JavaScript, and `/scramjet/scramjet.wasm.wasm` must return WebAssembly. Browser should then receive a binary Wisp handshake through `/wisp` and open a page. `/api/ai` should return a JSON 405 to GET and handle POST with the configured key.

Once verified, move the custom domain to the new web service and update the DuckDNS/proxy destination as needed. Remove the old static site's association with the domain. If Cloudflare or another CDN sits in front, allow WebSocket upgrades and purge cached 404 responses for engine and API routes. Do not cache `/api/ai`, `/wisp`, `/game-proxy` or `/sw.js`.

Adding `render.yaml` alone does not convert an existing Static Site into a Web Service. That switch must be made in the Render dashboard. The domain must point to the server that actually runs `npm start`.

References: [Render web services](https://render.com/docs/web-services), [WebSockets](https://render.com/docs/websocket), [Blueprint specification](https://render.com/docs/blueprint-spec).
