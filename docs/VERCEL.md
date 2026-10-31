# Vercel deployment

Import the repository as an Other framework project using Node 22. The checked-in `vercel.json` runs `npm run build`, serves `dist/`, and routes game proxy and Wisp requests to Node functions. Vercel selects `server.mjs` as the root entrypoint, so it must default-export an HTTP server. `/api/ai` is a native function route. Do not add a catch-all rewrite to `index.html`: it returns HTML to API clients and breaks the browser transport.

Set `CLOUDFLARE_API_TOKEN` in Vercel environment variables for the desired environments, then redeploy. Never expose the key in a public variable. Leave `PUBLIC_ORIGINS` empty for normal same-origin deployments. If another CDN changes the forwarded Host, add the exact public HTTPS origin there.

Enable Fluid compute in project settings for WebSocket support. The Wisp function exports the existing HTTP server and its upgrade listener. WebSocket connections end at the function duration limit, so long browser sessions can require reconnecting. The configured duration is 300 seconds. This differs from the long-running Node origin recommended for Azion.

Vercel request size limits still apply before the app receives a message. The app's attachment limit does not override the platform body limit. AI now explains HTML routing errors and host 413 responses instead of displaying a JSON parser exception.

After deployment, verify `/api/ai` returns JSON (GET should return 405), `/wisp/` upgrades to WebSocket status 101, and Browser opens an external page. Then test AI with the server key configured. The local tests validate adapters and error handling, not the live account or infrastructure.

The AI rate limiter is per function instance and socket address, not a distributed per-user quota. Configure shared authenticated rate limits for a busy public deployment.

References: [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [project configuration](https://vercel.com/docs/project-configuration/vercel-json).

Wisp uses `/wisp` without a trailing slash so Vercel cannot redirect the WebSocket handshake before upgrading it. The Node server accepts both slash forms and normalizes them to the Wisp protocol path internally.

If your host cannot run Wisp, set build-time `WISP_URL` to your own backend's secure WebSocket URL, for example `wss://origin.example.com/wisp`, then rebuild/redeploy. This URL is public configuration, not a secret. Configure that backend's `PUBLIC_ORIGINS` to accept your frontend origin. Do not put a normal HTTPS page URL there. The browser now checks for a Wisp handshake before opening a frame and displays a connection error if the backend is missing.
