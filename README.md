# Slipstream

A games, web apps and proxied browsing portal, based on UBGForever. The original game provider, favorites, recents and profile data remain compatible.

## Local development

Requires Node 22.

```sh
npm install
cp .env.example .env
npm start
```

Open http://localhost:5186/. Set the server-only `CLOUDFLARE_API_TOKEN` in `.env` to enable AI. Keep `.env` private. The frontend contains no Cloudflare token.

```sh
npm test
npm run build
```

The build checks JavaScript syntax and copies public assets to `dist/`. AI and Wisp require the Node server. A static upload alone is insufficient.

## Contributing

Read [the development guide](docs/DEVELOPING.md) for module ownership, app/game extension recipes, styling and behavioral tests.

The frontend uses plain JavaScript. Each new lifecycle has a specific owner rather than being spread across the original router. Partner styling lives in `css/slipstream.css`, layered over the original `css/app.css`. The opening screen is separate.

## Features and services

- Original games catalog with local cover mappings and a local Wispcraft client.
- Curated apps in independent app-style windows, plus a local HTML editor.
- Scramjet and BareMux/Epoxy through `/wisp/`, with Startpage search.
- Cloudflare Workers AI `@cf/google/gemma-4-26b-a4b-it`, image/text attachments, Wikipedia and web search.
- Device-local profile and history, existing community chat, optional opt-in top-ten leaderboard.

Leaderboard SQL is in `supabase-leaderboard.sql`. It is supplied for manual application to the partner project. Browser-local XP is not authenticated competitive scoring, and local profile uploads are not public avatar hosting. Third-party sign-in, streaming and DRM depend on the service.

## Attribution

Game cover provenance is recorded in `tools/artwork-sources.json`. App logo sources are in `img/apps/SOURCES.md`. Wispcraft and its base client are documented in `apps/wispcraft/SOURCES.txt`. Opening assets are documented in `img/landing/SOURCES.txt`.

Local preview work is authorized. Push, merge, deployment and database migrations still require the user's explicit go.

## Azion deployment

See [the Azion guide](docs/AZION.md) for the configuration generator, containerized Node origin and required WebSocket Proxy setup. Static hosting alone cannot run AI or Wisp.

For Vercel, use the checked-in `vercel.json` and [Vercel setup guide](docs/VERCEL.md). Configure the server key and enable Fluid compute for Wisp WebSockets.

For Render, use a **Web Service** with the included `render.yaml`. See [Render setup](docs/RENDER.md). A Render Static Site cannot run Wisp or AI.

AI setup now requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Keep the Cloudflare account on Workers Free to stop at the free daily allowance. See [Workers AI setup](docs/WORKERS_AI.md).
